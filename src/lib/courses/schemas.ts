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

/**
 * Schéma de sortie IA pour le quiz d'un module (Prompt 05.6), délibérément
 * permissif (champs nullables plutôt que des règles conditionnelles que
 * l'API de sortie structurée ne pourrait pas faire respecter de façon
 * fiable). La validation stricte (bornes d'index, cohérence du type de
 * question, nombre de choix pour "true_false"...) est faite séparément,
 * côté application, avec un schéma Zod dédié appliqué question par
 * question après réception — voir `generate.ts`.
 */
export const ModuleQuizSchema = z.object({
  questions: z.array(
    z.object({
      questionType: z
        .enum(["single_choice", "multiple_choice", "true_false"])
        .describe("Le type le plus adapté à cette question précise"),
      question: z.string(),
      choices: z
        .array(z.string())
        .describe("2 choix pour true_false, sinon 4 choix"),
      correctChoiceIndex: z
        .number()
        .int()
        .nullable()
        .describe(
          "Index (0-based) du choix correct, pour single_choice/true_false uniquement ; null pour multiple_choice",
        ),
      correctChoiceIndexes: z
        .array(z.number().int())
        .nullable()
        .describe(
          "TOUS les index corrects (0-based), pour multiple_choice uniquement ; null pour les deux autres types",
        ),
      explanation: z
        .string()
        .describe("Explication de la bonne réponse, basée uniquement sur le contenu du module fourni"),
    }),
  ),
});
export type ModuleQuiz = z.infer<typeof ModuleQuizSchema>;

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

/**
 * Les trois types prévus par 0010_quizzes.sql. `single_choice` et
 * `true_false` utilisent `correctChoiceIndex` ; `multiple_choice` utilise
 * `correctChoiceIndexes` (toutes les bonnes réponses, sans réponse
 * supplémentaire, exactement comme le vérifie déjà `submit_quiz_attempt`
 * côté base de données).
 */
export type QuestionType = "single_choice" | "multiple_choice" | "true_false";

export type QuizQuestion = {
  /**
   * Identifiant réel en base. Absent juste après une génération fraîche ;
   * présent dès que la formation est chargée via `getCourseById`.
   * Nécessaire pour soumettre une tentative de quiz (`quiz_attempts`,
   * voir 0011_quiz_attempts.sql) : le serveur recalcule le score à partir
   * de cet identifiant, jamais à partir d'une valeur envoyée par le
   * navigateur.
   */
  id?: string;
  position: number;
  chapterIndex: number | null;
  question: string;
  choices: string[];
  correctChoiceIndex: number;
  /**
   * Uniquement pour `questionType === "multiple_choice"` ; `null`/absent
   * pour les deux autres types. Toutes les bonnes réponses, dans n'importe
   * quel ordre.
   */
  correctChoiceIndexes?: number[] | null;
  /**
   * Absent pour une formation fraîchement générée (le générateur IA ne
   * produit encore que des questions à choix unique, non modifié par
   * cette évolution) : traiter comme `"single_choice"` dans ce cas, comme
   * le fait déjà la colonne SQL correspondante (défaut `'single_choice'`).
   */
  questionType?: QuestionType;
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

/**
 * Quiz généré pour UN module (Prompt 05.6), avant sauvegarde. `modulePosition`
 * identifie sans ambiguïté le module concerné au sein de la formation (même
 * valeur que `GeneratedModule.position`/`course_modules.position`) : c'est
 * cette position, et non un index de tableau, que `saveCourse` utilise pour
 * associer ce quiz au bon module réellement créé en base.
 */
export type GeneratedModuleQuiz = {
  modulePosition: number;
  questions: QuizQuestion[];
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
  /**
   * Un quiz par module (Prompt 05.6). Absent juste après une génération
   * fraîche faite par un pipeline qui ne les produit pas encore ; présent
   * dès que le pipeline de génération les produit, avant toute sauvegarde.
   * `getCourseById` ne les relit pas encore depuis la base (l'intégration
   * visuelle en lecture viendra dans un prompt séparé) — ce champ ne sert
   * donc, pour l'instant, qu'entre la génération et `saveCourse`.
   */
  moduleQuizzes?: GeneratedModuleQuiz[];
  /**
   * Identifiant du quiz FINAL (table `quizzes`, `kind = 'final'`), pour
   * démarrer/soumettre une tentative (voir 0011_quiz_attempts.sql). `null`
   * si la formation n'a pas de quiz ; absent juste après une génération
   * fraîche (même logique que `modules`/`chapter.id`).
   */
  quizId?: string | null;
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
