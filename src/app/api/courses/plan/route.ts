import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAnthropicClient } from "@/lib/anthropic/client";
import {
  CourseGenerationError,
  MAX_DIAGNOSTIC_QUESTIONS,
  buildCoursePlan,
  generateAdaptiveDiagnosticQuestion,
  generateFreeDiagnosticQuestion,
  isTopicPlausible,
} from "@/lib/courses/generate";
import {
  AnalysisSchema,
  ResearchExtractionSchema,
  ProgrammeSchema,
} from "@/lib/courses/schemas";
import { isOnFreePlan } from "@/lib/courses/plan";
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

  // Prompt 06.40 (demande explicite : "le diagnostic intelligent se fait
  // dans tous les plans tant que ça ne fait pas d'appel à mon compte
  // Anthropic, le plan Pro lui pourra faire des appels Anthropic mais pas
  // le plan gratuit") : seule vérification de plan lue UNE FOIS ici,
  // réutilisée pour les 3 actions ci-dessous — jamais une 2ᵉ lecture.
  const isFree = await isOnFreePlan(supabase, user.id);

  // Prompt 06.40 : le plan gratuit ne doit JAMAIS pouvoir déclencher
  // buildCoursePlan (vrai appel Claude), même par un appel direct à cette
  // route qui contournerait l'interface (qui, elle, ne propose jamais ce
  // bouton à un compte gratuit — voir course-generator.tsx,
  // `triggerFreeUpsell`). Vérifié ICI, côté serveur, pas seulement côté UI.
  if (isFree && body.action !== "question") {
    return NextResponse.json(
      { error: "Le plan gratuit ne permet pas de construire une vraie formation. Passe au plan Pro pour continuer." },
      { status: 403 },
    );
  }

  try {
    if (body.action === "question") {
      // Prompt 06.40 : le plan gratuit reste à ZÉRO appel Claude pour le
      // diagnostic (demande explicite) — heuristique + banque figée par
      // catégorie, jamais le client Anthropic. Le plan Pro, lui, est
      // désormais autorisé à appeler Claude pour un diagnostic réellement
      // adaptatif (compréhension du sujet + questions personnalisées).
      if (isFree) {
        if (!isTopicPlausible(body.topic)) {
          return NextResponse.json({ question: null, unclear: true });
        }
        const question = generateFreeDiagnosticQuestion(body.topic, body.previousAnswers);
        return NextResponse.json({ question });
      }

      const client = createAnthropicClient();
      const { question, unclear } = await generateAdaptiveDiagnosticQuestion(
        client,
        body.topic,
        body.previousAnswers,
      );
      return NextResponse.json({ question, unclear });
    }

    // Prompt 06.35 (suite à un signalement utilisateur réel : une clé
    // ANTHROPIC_API_KEY absente ou vide en production faisait planter cet
    // appel AVANT ce try/catch — exception non interceptée, renvoyée par
    // Netlify/Next.js comme une page d'erreur HTML brute au lieu d'un JSON,
    // provoquant côté navigateur "Unexpected token '<' ... is not valid
    // JSON" au lieu du message propre attendu). Création du client
    // désormais À L'INTÉRIEUR du try : toute erreur ici (y compris cette
    // variable d'environnement manquante) retombe sur le même message
    // générique ci-dessous, jamais une page brute.
    const client = createAnthropicClient();

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
