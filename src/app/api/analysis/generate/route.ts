import { NextResponse } from "next/server";
import { createAnthropicClient } from "@/lib/anthropic/client";
import { createClient } from "@/lib/supabase/server";
import {
  AnalysisGenerationError,
  assembleAnalysisFromProgress,
  decideNextAnalysisStep,
  EMPTY_ANALYSIS_PROGRESS,
  performAnalysisStepUnit,
  stageForAnalysisUnit,
  type AnalysisStepInput,
  type AnalysisStepProgress,
} from "@/lib/analysis/generate";
import { saveDeepAnalysis } from "@/lib/analysis/persist";
import { DEEP_STAGE_LABELS } from "@/lib/analysis/schemas";
import { quotaExceededMessage, releaseReservation } from "@/lib/courses/reservation";
import {
  claimGenerationStep,
  commitGenerationStep,
  failGenerationStep,
  startGenerationTask,
} from "@/lib/generation/engine";
import { AnalysisStepInputSchema, AnalysisStepProgressSchema } from "@/lib/generation/progress-schemas";
import { checkRequestOrigin } from "@/lib/security/origin-check";
import { z } from "zod";

export const dynamic = "force-dynamic";
// Prompt 05.20.1 : même architecture à étapes courtes que
// /api/courses/generate (voir ce fichier pour le détail) — les analyses
// approfondies doivent bénéficier du même niveau de fiabilité que les
// formations, jamais d'un traitement à part. Chaque appel effectue au
// plus UNE unité de travail (cadrage, recherche de cas réels, rédaction
// d'UNE section, synthèse, ou sauvegarde finale).
export const maxDuration = 120;

const MAX_TOPIC_LENGTH = 500;

const StartBodySchema = z.object({
  action: z.literal("start"),
  idempotencyKey: z.string().min(1).max(200),
  topic: z.string().optional().default(""),
});

const StepBodySchema = z.object({
  action: z.literal("step"),
  reservationId: z.string().uuid(),
});

const BodySchema = z.discriminatedUnion("action", [StartBodySchema, StepBodySchema]);

function isProgressEmpty(value: unknown): boolean {
  return typeof value === "object" && value !== null && Object.keys(value).length === 0;
}

export async function POST(request: Request) {
  const originError = checkRequestOrigin(request);
  if (originError) return originError;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const rawBody = await request.json().catch(() => null);
  const parsedBody = BodySchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const body = parsedBody.data;

  if (body.action === "start") {
    return handleStart(supabase, body);
  }
  return handleStep(supabase, body.reservationId);
}

async function handleStart(
  supabase: Awaited<ReturnType<typeof createClient>>,
  body: z.infer<typeof StartBodySchema>,
) {
  const topic = body.topic.trim();
  if (!topic) {
    return NextResponse.json({ error: "Le sujet ne peut pas être vide." }, { status: 400 });
  }
  if (topic.length > MAX_TOPIC_LENGTH) {
    return NextResponse.json({ error: "Sujet trop long." }, { status: 400 });
  }

  const input: AnalysisStepInput = { topic };
  const parsedInput = AnalysisStepInputSchema.safeParse(input);
  if (!parsedInput.success) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  let result;
  try {
    result = await startGenerationTask(supabase, "analysis", body.idempotencyKey, parsedInput.data);
  } catch {
    return NextResponse.json(
      { error: "Impossible de vérifier ton quota pour le moment. Réessaie dans un instant." },
      { status: 503 },
    );
  }

  if (!result.ok) {
    return NextResponse.json(
      { error: quotaExceededMessage("analysis", result.isPro, result.limitCount) },
      { status: 403 },
    );
  }

  return NextResponse.json({ reservationId: result.reservationId });
}

async function handleStep(
  supabase: Awaited<ReturnType<typeof createClient>>,
  reservationId: string,
) {
  const claimToken = crypto.randomUUID();
  const claim = await claimGenerationStep(supabase, reservationId, claimToken);

  if (!claim.claimed) {
    if (claim.reason === "not_found") {
      return NextResponse.json({ error: "Analyse introuvable." }, { status: 404 });
    }
    if (claim.reason === "already_resolved") {
      return NextResponse.json({ done: true, alreadyResolved: true });
    }
    return NextResponse.json({ done: false, busy: true });
  }

  const parsedInput = AnalysisStepInputSchema.safeParse(claim.input);
  if (!parsedInput.success) {
    console.error("Progression d'analyse corrompue (entrée) :", parsedInput.error);
    await failGenerationStep(supabase, reservationId, claimToken, "input_corrupted");
    await releaseReservation(supabase, reservationId);
    return NextResponse.json({
      done: true,
      fatalError: "L'analyse a été interrompue de façon inattendue. Réessaie.",
    });
  }

  let progress: AnalysisStepProgress;
  if (isProgressEmpty(claim.progress)) {
    progress = EMPTY_ANALYSIS_PROGRESS;
  } else {
    const parsedProgress = AnalysisStepProgressSchema.safeParse(claim.progress);
    if (!parsedProgress.success) {
      console.error("Progression d'analyse corrompue :", parsedProgress.error);
      await failGenerationStep(supabase, reservationId, claimToken, "progress_corrupted");
      await releaseReservation(supabase, reservationId);
      return NextResponse.json({
        done: true,
        fatalError: "L'analyse a été interrompue de façon inattendue. Réessaie.",
      });
    }
    progress = parsedProgress.data;
  }

  const input = parsedInput.data;
  const unit = decideNextAnalysisStep(progress);

  if (unit.kind === "assemble") {
    let analysis;
    try {
      analysis = assembleAnalysisFromProgress(input, progress);
    } catch (error) {
      console.error("Assemblage de l'analyse impossible :", error);
      await failGenerationStep(supabase, reservationId, claimToken, "assembly_failed");
      await releaseReservation(supabase, reservationId);
      return NextResponse.json({
        done: true,
        fatalError: "L'analyse a été interrompue de façon inattendue. Réessaie.",
      });
    }

    let analysisId: string | null = null;
    let saveWarning: string | null = null;
    try {
      analysisId = await saveDeepAnalysis(supabase, analysis, reservationId);
    } catch (saveError) {
      console.error("Échec de l'enregistrement de l'analyse :", saveError);
      saveWarning =
        "L'analyse a été générée mais n'a pas pu être enregistrée. Réessaie, ou contacte le support si le problème persiste.";
      await releaseReservation(supabase, reservationId);
    }

    await commitGenerationStep(supabase, reservationId, claimToken, { stage: "pret" });
    return NextResponse.json({ done: true, analysisId, analysis, saveWarning });
  }

  try {
    const patch = await performAnalysisStepUnit(createAnthropicClient(), input, progress, unit);
    const stage = stageForAnalysisUnit(unit);
    const commitResult = await commitGenerationStep(supabase, reservationId, claimToken, {
      ...patch,
      stage,
    });

    if (!commitResult.ok) {
      return NextResponse.json({ done: false, busy: true });
    }

    let label: string = DEEP_STAGE_LABELS[stage];
    if (unit.kind === "section" && progress.verifiedCases) {
      const total = progress.verifiedCases.length;
      const doneCount = Object.keys(patch.sections ?? progress.sections).length;
      label = `${DEEP_STAGE_LABELS[stage]} (${doneCount}/${total})`;
    }

    return NextResponse.json({ done: false, stage, label });
  } catch (error) {
    if (error instanceof AnalysisGenerationError) {
      await failGenerationStep(supabase, reservationId, claimToken, error.message);
      await releaseReservation(supabase, reservationId);
      return NextResponse.json({ done: true, fatalError: error.message });
    }

    console.error("Erreur transitoire pendant une étape de génération d'analyse :", error);
    await failGenerationStep(supabase, reservationId, claimToken, "transient_error");
    return NextResponse.json({ done: false, transientError: true });
  }
}
