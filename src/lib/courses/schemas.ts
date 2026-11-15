import { z } from "zod";

export const LEVELS = ["débutant", "intermédiaire", "avancé"] as const;

export const AnalysisSchema = z.object({
  title: z.string().describe("Titre clair et accrocheur de la formation"),
  domain: z
    .string()
    .describe(
      "Domaine du sujet (ex: finance, histoire, e-commerce, science, langues...)",
    ),
  level: z.enum(LEVELS),
  angle: z
    .string()
    .describe("Angle pédagogique : sous quel fil conducteur traiter le sujet"),
  usesRealWorldExamples: z
    .boolean()
    .describe(
      "true si de vraies entreprises/personnes/événements sont pertinents pour ce sujet, false sinon (ex: notions mathématiques pures)",
    ),
  chapterCount: z
    .number()
    .int()
    .describe("Nombre de chapitres recommandé, entre 4 et 6"),
});
export type Analysis = z.infer<typeof AnalysisSchema>;

export const ResearchExtractionSchema = z.object({
  examples: z.array(
    z.object({
      theme: z
        .string()
        .describe("Aspect ou sous-thème du sujet que cet exemple illustre"),
      description: z
        .string()
        .describe("Ce que l'exemple montre, basé uniquement sur la recherche"),
      sourceUrl: z
        .string()
        .describe("URL exacte, copiée telle quelle depuis les résultats de recherche fournis"),
      sourceTitle: z.string(),
    }),
  ),
});
export type ResearchExtraction = z.infer<typeof ResearchExtractionSchema>;
export type VerifiedExample = ResearchExtraction["examples"][number];

export const ProgrammeSchema = z.object({
  introduction: z
    .string()
    .describe("Présentation du sujet, 2-4 paragraphes, markdown"),
  objectives: z
    .array(z.string())
    .describe("Ce que l'utilisateur saura faire après la formation"),
  chapters: z.array(
    z.object({
      title: z.string(),
      summary: z
        .string()
        .describe("Résumé de ce que ce chapitre doit couvrir, pour guider sa rédaction"),
      exampleIndex: z
        .number()
        .int()
        .nullable()
        .describe(
          "Index de l'exemple vérifié à utiliser (parmi ceux fournis), ou null si aucun ne convient",
        ),
    }),
  ),
  summaryAngle: z
    .string()
    .describe("Angle à adopter pour le résumé final"),
});
export type Programme = z.infer<typeof ProgrammeSchema>;

export const ChapterContentSchema = z.object({
  explanation: z
    .string()
    .describe(
      "Explication détaillée, pédagogique et progressive du chapitre, en markdown (sous-titres ## autorisés, pas de titre de niveau 1)",
    ),
  example: z.object({
    isReal: z
      .boolean()
      .describe("true uniquement si basé sur l'exemple vérifié fourni, false si fictif/illustratif"),
    description: z.string(),
    sourceUrl: z.string().nullable(),
    sourceTitle: z.string().nullable(),
  }),
  keyTakeaway: z
    .string()
    .describe("Encadré « à retenir » : 2-4 phrases synthétiques"),
});
export type ChapterContent = z.infer<typeof ChapterContentSchema>;

export const CourseSummarySchema = z.object({
  summary: z.string().describe("Résumé final, markdown, 2-4 paragraphes"),
  keyPoints: z.array(z.string()).describe("Points essentiels à retenir de toute la formation"),
});
export type CourseSummary = z.infer<typeof CourseSummarySchema>;

// --- Formation assemblée, prête à être affichée / persistée ---

export type GeneratedChapter = {
  position: number;
  title: string;
  explanation: string;
  keyTakeaway: string;
  example: {
    isReal: boolean;
    description: string;
    sourceUrl: string | null;
    sourceTitle: string | null;
  };
};

export type GeneratedCourse = {
  topic: string;
  title: string;
  domain: string;
  level: Analysis["level"];
  introduction: string;
  objectives: string[];
  chapters: GeneratedChapter[];
  summary: string;
  keyPoints: string[];
};

export type GenerationStage =
  | "analyse"
  | "recherche"
  | "programme"
  | "chapitres"
  | "pret";

export const STAGE_LABELS: Record<GenerationStage, string> = {
  analyse: "Analyse du sujet...",
  recherche: "Recherche d'exemples et de sources...",
  programme: "Construction du programme...",
  chapitres: "Création des chapitres...",
  pret: "Formation prête.",
};
