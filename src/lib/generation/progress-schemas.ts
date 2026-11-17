// Schémas Zod de la progression persistée (Prompt 05.20.1, architecture à
// étapes courtes). `generation_progress.input`/`.progress` (voir
// supabase/migrations/0023_generation_progress.sql) sont des colonnes
// jsonb NON validées structurellement côté SQL (seulement bornées en
// taille) : TOUTE lecture/écriture passe par ces schémas côté TypeScript,
// jamais par un simple cast — même principe que le reste du projet
// ("jamais se fier uniquement au texte envoyé/reçu sans le vérifier en
// code"). Une valeur qui ne correspond pas à ces schémas est rejetée avant
// d'être utilisée ou persistée, qu'elle vienne d'une écriture précédente
// malformée ou d'une anomalie quelconque.
import { z } from "zod";
import {
  AnalysisSchema,
  ProgrammeSchema,
  ResearchExtractionSchema,
} from "@/lib/courses/schemas";
import { AnalysisBriefSchema, CaseExtractionSchema } from "@/lib/analysis/schemas";

// --- Formations ---

const StoredChapterSchema = z.object({
  position: z.number().int(),
  title: z.string(),
  explanation: z.string(),
  keyTakeaway: z.string(),
  example: z.object({
    isReal: z.boolean(),
    description: z.string(),
    sourceUrl: z.string().nullable(),
    sourceTitle: z.string().nullable(),
  }),
  exercise: z.object({ prompt: z.string(), solution: z.string() }).nullable().optional(),
});

const StoredQuizQuestionSchema = z.object({
  position: z.number().int(),
  chapterIndex: z.number().int().nullable(),
  question: z.string(),
  choices: z.array(z.string()),
  correctChoiceIndex: z.number().int(),
  correctChoiceIndexes: z.array(z.number().int()).nullable().optional(),
  questionType: z.enum(["single_choice", "multiple_choice", "true_false"]).optional(),
  explanation: z.string(),
});

const CourseStageSchema = z.enum([
  "analyse",
  "recherche",
  "programme",
  "chapitres",
  "finition",
  "quizFinal",
  "assemblage",
  "pret",
]);

export const CourseStepInputSchema = z.object({
  topic: z.string().min(1).max(500),
  analysis: AnalysisSchema,
  verifiedExamples: ResearchExtractionSchema.shape.examples,
  programme: ProgrammeSchema,
});

export const CourseStepProgressSchema = z.object({
  stage: CourseStageSchema,
  chapters: z.record(z.string(), StoredChapterSchema),
  moduleQuizzes: z.record(z.string(), z.array(StoredQuizQuestionSchema)),
  summary: z.object({ summary: z.string(), keyPoints: z.array(z.string()) }).optional(),
  finalQuiz: z.array(StoredQuizQuestionSchema).optional(),
});

// --- Analyses approfondies ---

const StoredSectionSchema = z.object({
  position: z.number().int(),
  name: z.string(),
  outcome: z.enum(["succès", "échec", "mixte"]),
  content: z.string(),
  lessons: z.array(z.string()),
  source: z.object({ index: z.number().int(), url: z.string(), title: z.string() }),
});

const AnalysisStageSchema = z.enum([
  "cadrage",
  "recherche",
  "redaction",
  "synthese",
  "assemblage",
  "pret",
]);

export const AnalysisStepInputSchema = z.object({
  topic: z.string().min(1).max(500),
});

// L'état de recherche (Prompt 05.20.2) contient l'historique brut des
// messages Anthropic (texte, blocs d'usage d'outil serveur, résultats de
// recherche web) nécessaire pour reprendre un tour en pause — une
// structure interne au SDK, jamais interprétée ni affichée côté client,
// donc volontairement non re-typée champ par champ ici : seule la forme
// d'ensemble (tableau de messages) et les champs qu'on lit réellement
// (resumes, findings, realSources, done) sont vérifiés.
const ResearchTurnStateSchema = z.object({
  messages: z.array(z.record(z.string(), z.unknown())),
  resumes: z.number().int().min(0),
  findings: z.string(),
  realSources: z.array(z.object({ url: z.string(), title: z.string() })),
  done: z.boolean(),
});

export const AnalysisStepProgressSchema = z.object({
  stage: AnalysisStageSchema,
  brief: AnalysisBriefSchema.optional(),
  research: ResearchTurnStateSchema.optional(),
  verifiedCases: CaseExtractionSchema.shape.cases.optional(),
  sections: z.record(z.string(), StoredSectionSchema),
  synthesis: z.object({ synthesis: z.string(), keyLessons: z.array(z.string()) }).optional(),
});
