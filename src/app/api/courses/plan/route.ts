import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAnthropicClient } from "@/lib/anthropic/client";
import {
  CourseGenerationError,
  MAX_DIAGNOSTIC_QUESTIONS,
  buildCoursePlan,
  generateDiagnosticQuestion,
} from "@/lib/courses/generate";
import {
  AnalysisSchema,
  ResearchExtractionSchema,
  ProgrammeSchema,
} from "@/lib/courses/schemas";
import { checkRequestOrigin } from "@/lib/security/origin-check";

export const dynamic = "force-dynamic";
// Diagnostic (une question à la fois) et construction du plan (analyse +
// éventuelle recherche web + programme) : nettement plus rapide qu'une
// génération complète, mais la recherche d'exemples réels peut prendre un
// moment — marge raisonnable, bien inférieure au maxDuration=540 de la
// génération complète.
export const maxDuration = 120;

const MAX_TOPIC_LENGTH = 500;
const MAX_ANSWER_LENGTH = 500;
const MAX_ADJUSTMENT_LENGTH = 500;

const DiagnosticAnswerSchema = z.object({
  questionId: z.string().min(1).max(100),
  question: z.string().min(1).max(500),
  answer: z.string().min(1).max(MAX_ANSWER_LENGTH),
});

// Prompt 05.18.1 : le diagnostic et la construction/ajustement du plan ne
// consomment JAMAIS de réservation de quota (voir generate.ts et le
// rapport de ce prompt) — contrairement à /api/courses/generate, cette
// route n'appelle jamais reserveGenerationSlot(). Seule la génération
// complète, déclenchée APRÈS validation du plan, réserve un quota.
const QuestionBodySchema = z.object({
  action: z.literal("question"),
  topic: z.string().trim().min(1).max(MAX_TOPIC_LENGTH),
  previousAnswers: z.array(DiagnosticAnswerSchema).max(MAX_DIAGNOSTIC_QUESTIONS),
});

const BuildBodySchema = z.object({
  action: z.literal("build"),
  topic: z.string().trim().min(1).max(MAX_TOPIC_LENGTH),
  diagnosticAnswers: z.array(DiagnosticAnswerSchema).max(MAX_DIAGNOSTIC_QUESTIONS),
});

const AdjustBodySchema = z.object({
  action: z.literal("adjust"),
  topic: z.string().trim().min(1).max(MAX_TOPIC_LENGTH),
  diagnosticAnswers: z.array(DiagnosticAnswerSchema).max(MAX_DIAGNOSTIC_QUESTIONS),
  adjustmentRequest: z.string().trim().min(1).max(MAX_ADJUSTMENT_LENGTH),
  analysis: AnalysisSchema,
  verifiedExamples: ResearchExtractionSchema.shape.examples,
  programme: ProgrammeSchema,
});

const BodySchema = z.discriminatedUnion("action", [
  QuestionBodySchema,
  BuildBodySchema,
  AdjustBodySchema,
]);

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

  const client = createAnthropicClient();

  try {
    if (body.action === "question") {
      const question = await generateDiagnosticQuestion(client, body.topic, body.previousAnswers);
      return NextResponse.json({ question });
    }

    if (body.action === "build") {
      const plan = await buildCoursePlan(client, body.topic, {
        diagnosticAnswers: body.diagnosticAnswers,
      });
      return NextResponse.json(plan);
    }

    // action === "adjust"
    const plan = await buildCoursePlan(client, body.topic, {
      diagnosticAnswers: body.diagnosticAnswers,
      adjustmentRequest: body.adjustmentRequest,
      previousAnalysis: body.analysis,
      previousVerifiedExamples: body.verifiedExamples,
      previousProgramme: body.programme,
    });
    return NextResponse.json(plan);
  } catch (error) {
    // Même principe que /api/courses/generate (correctif E3, audit 05.16) :
    // seule une erreur explicitement conçue pour être affichée conserve
    // son message, tout le reste reste générique côté navigateur.
    const message =
      error instanceof CourseGenerationError
        ? error.message
        : "Une erreur est survenue. Réessaie dans un instant.";
    if (!(error instanceof CourseGenerationError)) {
      console.error("Erreur inattendue pendant la construction du plan :", error);
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
