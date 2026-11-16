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

export const QuizSchema = z.object({
  questions: z.array(
    z.object({
      chapterIndex: z
        .number()
        .int()
        .nullable()
        .describe("Index (0-based) du chapitre dont la question est tirée"),
      question: z.string(),
      choices: z
        .array(z.string())
        .describe("4 choix de réponse, une seule bonne réponse parmi eux"),
      correctChoiceIndex: z
        .number()
        .int()
        .describe("Index (0-based) du choix correct dans `choices`"),
      explanation: z
        .string()
        .describe(
          "Explication de la bonne réponse, basée uniquement sur le contenu fourni",
        ),
    }),
  ),
});
export type Quiz = z.infer<typeof QuizSchema>;

// --- Formation assemblée, prête à être affichée / persistée ---

export type GeneratedChapter = {
  /**
   * Identifiant réel en base. Absent juste après une génération fraîche
   * (pas encore sauvegardée/relue) ; présent dès que la formation est
   * chargée via `getCourseById`. Nécessaire pour marquer une leçon comme
   * terminée (`lesson_progress.chapter_id`).
   */
  id?: string;
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
  /**
   * Leçon marquée comme terminée par l'utilisateur (table
   * `lesson_progress`). Toujours `false` juste après une génération
   * fraîche ; reflète l'état réel dès que la formation est relue depuis la
   * base.
   */
  completed?: boolean;
};

export type QuizQuestion = {
  position: number;
  chapterIndex: number | null;
  question: string;
  choices: string[];
  correctChoiceIndex: number;
  explanation: string;
};

/**
 * Regroupement pédagogique de leçons (= chapitres) au sein d'une formation.
 * `chapters` référence les mêmes objets que `GeneratedCourse.chapters`
 * (même position globale, même contenu) — ce n'est qu'un regroupement, pas
 * une structure parallèle : `GeneratedCourse.chapters` reste la liste plate
 * faisant autorité pour tout le code existant (chat, progression, quiz,
 * verrouillage du plan gratuit).
 */
export type GeneratedModule = {
  position: number;
  title: string;
  chapters: GeneratedChapter[];
};

export type GeneratedCourse = {
  topic: string;
  title: string;
  domain: string;
  level: string;
  introduction: string;
  objectives: string[];
  chapters: GeneratedChapter[];
  /**
   * Regroupement par modules, pour la nouvelle architecture pédagogique.
   * Absent juste après une génération fraîche (le pipeline IA n'est pas
   * modifié par cette architecture) ; présent dès que la formation est
   * relue depuis la base via `getCourseById`, une fois sauvegardée.
   */
  modules?: GeneratedModule[];
  summary: string;
  keyPoints: string[];
  quiz: QuizQuestion[];
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
