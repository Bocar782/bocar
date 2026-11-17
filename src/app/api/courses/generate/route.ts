import { NextResponse } from "next/server";
import { z } from "zod";
import { createAnthropicClient } from "@/lib/anthropic/client";
import { createClient } from "@/lib/supabase/server";
import {
  assembleCourseFromProgress,
  buildCoursePlan,
  CourseGenerationError,
  decideNextCourseStep,
  EMPTY_COURSE_PROGRESS,
  flattenModulePlans,
  performCourseStepUnit,
  stageForCourseUnit,
  validateProgrammeStructure,
  type CourseStepInput,
  type CourseStepProgress,
} from "@/lib/courses/generate";
import { saveCourse } from "@/lib/courses/persist";
import { quotaExceededMessage, releaseReservation } from "@/lib/courses/reservation";
import {
  AnalysisSchema,
  ProgrammeSchema,
  ResearchExtractionSchema,
  STAGE_LABELS,
} from "@/lib/courses/schemas";
import {
  claimGenerationStep,
  commitGenerationStep,
  failGenerationStep,
  IdempotencyPayloadMismatchError,
  startGenerationTask,
} from "@/lib/generation/engine";
import { CourseStepInputSchema, CourseStepProgressSchema } from "@/lib/generation/progress-schemas";
import { checkRequestOrigin } from "@/lib/security/origin-check";

export const dynamic = "force-dynamic";
// Prompt 05.20.1 (remplace le streaming NDJSON d'une seule requête pouvant
// durer plusieurs minutes, risque critique identifié par l'audit
// 05.19/05.20 face aux limites réelles des fonctions Netlify synchrones) :
// chaque appel à cette route effectue au plus UNE unité de travail (un
// seul appel Anthropic dans la quasi-totalité des cas : une leçon, un quiz
// de module, le résumé, le quiz final, ou la sauvegarde finale) puis
// répond — largement sous n'importe quelle limite Netlify plausible. 120s
// reste une marge très confortable, jamais la garantie structurelle de
// fiabilité elle-même (c'est l'architecture à étapes courtes qui l'assure).
export const maxDuration = 120;

const MAX_TOPIC_LENGTH = 500;

const PlanContextSchema = z.object({
  analysis: AnalysisSchema,
  verifiedExamples: ResearchExtractionSchema.shape.examples,
  programme: ProgrammeSchema,
});

const StartBodySchema = z.object({
  action: z.literal("start"),
  // Générée une seule fois côté client, AVANT le premier appel réseau, et
  // persistée en sessionStorage avant même d'envoyer la requête (voir
  // course-generator.tsx) : si cette requête "start" est rejouée (perte
  // réseau, rechargement survenu avant même d'avoir reçu la réponse) avec
  // la MÊME clé, start_generation_task renvoie la réservation déjà créée
  // au lieu d'en créer une seconde — jamais de double consommation de
  // quota pour une seule intention de génération.
  idempotencyKey: z.string().min(1).max(200),
  topic: z.string().optional().default(""),
  plan: PlanContextSchema.optional(),
});

const StepBodySchema = z.object({
  action: z.literal("step"),
  reservationId: z.string().uuid(),
});

const BodySchema = z.discriminatedUnion("action", [StartBodySchema, StepBodySchema]);

function isCourseProgressEmpty(value: unknown): boolean {
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

  let courseInput: CourseStepInput;
  if (body.plan) {
    // Plan transmis par le client (diagnostic guidé, potentiellement
    // modifié à la main) : doit respecter EXACTEMENT les mêmes règles
    // strictes que celui produit automatiquement — vérifié AVANT toute
    // réservation de quota, jamais la peine de consommer une place pour
    // une structure qu'on sait déjà invalide.
    const structureErrors = validateProgrammeStructure(body.plan.programme);
    if (structureErrors.length > 0) {
      return NextResponse.json(
        {
          error:
            "Le plan modifié ne respecte pas les règles de structure (nombre de modules/leçons). Ajuste-le puis réessaie.",
        },
        { status: 400 },
      );
    }
    courseInput = {
      topic,
      analysis: body.plan.analysis,
      verifiedExamples: body.plan.verifiedExamples,
      programme: body.plan.programme,
    };
  } else {
    // Parcours "configuration rapide" (comportement inchangé) : construit
    // le plan ici, synchroniquement — déjà court aujourd'hui (voir
    // /api/courses/plan, maxDuration=120, non remis en cause par cet
    // audit) et JAMAIS consommateur de quota, exactement comme avant.
    try {
      const { analysis, verifiedExamples, programme } = await buildCoursePlan(
        createAnthropicClient(),
        topic,
        {},
      );
      courseInput = { topic, analysis, verifiedExamples, programme };
    } catch (error) {
      const message =
        error instanceof CourseGenerationError
          ? error.message
          : "Une erreur est survenue pendant la préparation de la formation. Réessaie dans un instant.";
      if (!(error instanceof CourseGenerationError)) {
        console.error("Erreur inattendue pendant la construction du plan (configuration rapide) :", error);
      }
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  const parsedInput = CourseStepInputSchema.safeParse(courseInput);
  if (!parsedInput.success) {
    console.error("Entrée de génération invalide (incohérence interne) :", parsedInput.error);
    return NextResponse.json(
      { error: "Une erreur est survenue. Réessaie dans un instant." },
      { status: 502 },
    );
  }

  let result;
  try {
    result = await startGenerationTask(supabase, "course", body.idempotencyKey, parsedInput.data);
  } catch (error) {
    if (error instanceof IdempotencyPayloadMismatchError) {
      return NextResponse.json(
        {
          error:
            "Cette génération a déjà été démarrée avec un contenu différent. Recharge la page et réessaie.",
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Impossible de vérifier ton quota pour le moment. Réessaie dans un instant." },
      { status: 503 },
    );
  }

  if (!result.ok) {
    return NextResponse.json(
      { error: quotaExceededMessage("course", result.isPro, result.limitCount) },
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
      return NextResponse.json({ error: "Génération introuvable." }, { status: 404 });
    }
    if (claim.reason === "already_resolved") {
      return NextResponse.json({ done: true, alreadyResolved: true });
    }
    // "already_in_progress" (une autre invocation travaille activement) ou
    // toute autre raison inattendue : jamais traité comme une erreur fatale
    // côté client, qui doit simplement réessayer dans un instant.
    return NextResponse.json({ done: false, busy: true });
  }

  const parsedInput = CourseStepInputSchema.safeParse(claim.input);
  if (!parsedInput.success) {
    console.error("Progression de génération corrompue (entrée) :", parsedInput.error);
    await failGenerationStep(supabase, reservationId, claimToken, "input_corrupted");
    await releaseReservation(supabase, reservationId);
    return NextResponse.json(
      { done: true, fatalError: "La génération a été interrompue de façon inattendue. Réessaie." },
      { status: 200 },
    );
  }

  let progress: CourseStepProgress;
  if (isCourseProgressEmpty(claim.progress)) {
    progress = EMPTY_COURSE_PROGRESS;
  } else {
    const parsedProgress = CourseStepProgressSchema.safeParse(claim.progress);
    if (!parsedProgress.success) {
      console.error("Progression de génération corrompue :", parsedProgress.error);
      await failGenerationStep(supabase, reservationId, claimToken, "progress_corrupted");
      await releaseReservation(supabase, reservationId);
      return NextResponse.json(
        { done: true, fatalError: "La génération a été interrompue de façon inattendue. Réessaie." },
        { status: 200 },
      );
    }
    progress = parsedProgress.data;
  }

  const input = parsedInput.data;
  const unit = decideNextCourseStep(input, progress);

  if (unit.kind === "assemble") {
    let course;
    try {
      course = assembleCourseFromProgress(input, progress);
    } catch (error) {
      console.error("Assemblage de la formation impossible :", error);
      await failGenerationStep(supabase, reservationId, claimToken, "assembly_failed");
      await releaseReservation(supabase, reservationId);
      return NextResponse.json(
        { done: true, fatalError: "La génération a été interrompue de façon inattendue. Réessaie." },
        { status: 200 },
      );
    }

    let courseId: string | null = null;
    let saveWarning: string | null = null;
    try {
      courseId = await saveCourse(supabase, course, reservationId);
      await commitGenerationStep(supabase, reservationId, claimToken, { stage: "pret" });
    } catch (saveError) {
      console.error("Échec de l'enregistrement de la formation :", saveError);
      saveWarning =
        "La formation a été générée mais n'a pas pu être enregistrée. Réessaie, ou contacte le support si le problème persiste.";
      // Voir /api/analysis/generate/route.ts : on relâche la réclamation
      // plutôt que de committer un stage "pret" trompeur alors que
      // l'enregistrement a justement échoué.
      await failGenerationStep(supabase, reservationId, claimToken, "save_failed");
      await releaseReservation(supabase, reservationId);
    }

    return NextResponse.json({ done: true, courseId, course, saveWarning });
  }

  try {
    const patch = await performCourseStepUnit(createAnthropicClient(), input, progress, unit);
    const stage = stageForCourseUnit(unit);
    const commitResult = await commitGenerationStep(supabase, reservationId, claimToken, {
      ...patch,
      stage,
    });

    if (!commitResult.ok) {
      // La réclamation a expiré entre-temps (une autre invocation a repris
      // la main) : jamais appliquer un résultat devenu obsolète par-dessus
      // un travail plus récent. Le client doit simplement réessayer.
      return NextResponse.json({ done: false, busy: true });
    }

    let label: string = STAGE_LABELS[stage];
    if (unit.kind === "chapter") {
      const total = flattenModulePlans(input.programme.modules).length;
      const doneCount = Object.keys(patch.chapters ?? progress.chapters).length;
      label = `${STAGE_LABELS[stage]} (${doneCount}/${total})`;
    }

    return NextResponse.json({ done: false, stage, label });
  } catch (error) {
    if (error instanceof CourseGenerationError) {
      // Erreur métier/structurelle : jamais transitoire, ne vaut pas la
      // peine de réessayer la même unité. On libère immédiatement le
      // quota plutôt que de laisser l'utilisateur attendre 15 minutes.
      await failGenerationStep(supabase, reservationId, claimToken, error.message);
      await releaseReservation(supabase, reservationId);
      return NextResponse.json({ done: true, fatalError: error.message });
    }

    // Toute autre erreur (réseau, panne transitoire de l'API Anthropic...) :
    // jamais exposée telle quelle au navigateur, et jamais fatale ici — le
    // client réessaiera la MÊME unité de travail (decideNextCourseStep ne
    // dépend que de ce qui est déjà committé, jamais de ce qui a échoué).
    console.error("Erreur transitoire pendant une étape de génération de formation :", error);
    await failGenerationStep(supabase, reservationId, claimToken, "transient_error");
    return NextResponse.json({ done: false, transientError: true });
  }
}
