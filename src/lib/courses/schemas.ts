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
  moduleCount: z
    .number()
    .int()
    .describe(
      "Nombre de modules recommandé selon la complexité réelle du sujet, entre 2 et 4 (2 pour un sujet plus étroit, 4 pour un sujet riche qui justifie une progression en plusieurs étapes)",
    ),
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

/**
 * Plan détaillé d'une formation structurée en modules (Prompt 05.9).
 * Chaque module a son propre titre, son propre objectif pédagogique, et sa
 * propre liste de leçons — la formation n'est plus un simple fil de
 * chapitres, mais une hiérarchie modules → leçons, comme la sauvegarde et
 * l'interface le supportent déjà depuis 0008/05.6/05.7.
 */
export const ProgrammeSchema = z.object({
  introduction: z
    .string()
    .describe("Présentation du sujet, 2-4 paragraphes, markdown"),
  objectives: z
    .array(z.string())
    .describe("Ce que l'utilisateur saura faire après la formation"),
  modules: z.array(
    z.object({
      title: z.string().min(1).describe("Titre précis de ce module (jamais vide)"),
      objective: z
        .string()
        .min(1)
        .describe(
          "Véritable objectif pédagogique de ce module (jamais vide) : ce que l'apprenant saura faire précisément après l'avoir terminé",
        ),
      chapters: z.array(
        z.object({
          title: z.string(),
          summary: z
            .string()
            .describe("Résumé de ce que cette leçon doit couvrir, pour guider sa rédaction"),
          exampleIndex: z
            .number()
            .int()
            .nullable()
            .describe(
              "Index de l'exemple vérifié à utiliser (parmi ceux fournis), ou null si aucun ne convient",
            ),
        }),
      ).describe("Entre 3 et 5 leçons cohérentes et suffisamment développées pour ce module"),
    }),
  ).describe(
    "Entre 2 et 4 modules en progression pédagogique logique, sans répétition de contenu entre eux",
  ),
  summaryAngle: z
    .string()
    .describe("Angle à adopter pour le résumé final"),
});
export type Programme = z.infer<typeof ProgrammeSchema>;
export type ProgrammeModule = Programme["modules"][number];

// --- Diagnostic adaptatif avant génération (Prompt 05.18.1) ---

/**
 * Une question de diagnostic, posée une à la fois : la question suivante
 * est générée en tenant compte de la réponse à celle-ci (voir
 * `generateDiagnosticQuestion` dans generate.ts) — jamais une liste figée
 * décidée d'avance.
 */
export const DiagnosticQuestionSchema = z.object({
  id: z.string().min(1).describe("Identifiant court et stable de cette question (slug)"),
  question: z.string().min(1),
  type: z.enum(["single_choice", "text"]),
  /** Uniquement pour `type === "single_choice"` ; `null` pour `"text"`. */
  choices: z.array(z.string()).nullable(),
});
export type DiagnosticQuestion = z.infer<typeof DiagnosticQuestionSchema>;

/**
 * Décision du modèle à chaque étape du diagnostic : soit une question de
 * plus, soit `done: true` (assez d'informations recueillies). Le CODE
 * (jamais seulement ce champ) impose en plus un minimum de 3 et un maximum
 * de 5 questions au total — voir `generateDiagnosticQuestion`.
 */
export const DiagnosticStepSchema = z.object({
  done: z.boolean(),
  question: DiagnosticQuestionSchema.nullable(),
});

/** Une question déjà répondue par l'utilisateur, transmise au tour suivant. */
export type DiagnosticAnswer = {
  questionId: string;
  question: string;
  answer: string;
};

export const ChapterContentSchema = z.object({
  // Consignes de profondeur/structure (Prompt 05.11, suite à l'audit 05.10)
  // transmises ici, au niveau du schéma : s'appliquent donc à TOUT appelant
  // de ChapterContentSchema, pas seulement au prompt actuel de writeChapter.
  explanation: z
    .string()
    .describe(
      "Explication approfondie, progressive et structurée du chapitre, en markdown (sous-titres ## autorisés, pas de titre de niveau 1 ; tableaux au format GFM autorisés quand ils apportent une vraie valeur comparative — jamais systématiques). Pour une notion complexe, simplifie-la avec une analogie ou un contre-exemple quand c'est pertinent. Distingue clairement ce qui est essentiel de ce qui n'est que secondaire (par exemple en mettant l'essentiel en **gras** ou dans un paragraphe dédié). La profondeur doit refléter la complexité réelle du sujet : ni superficielle sur un sujet riche, ni allongée artificiellement sur un sujet simple.",
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
  // Exercice pratique FACULTATIF (Prompt 05.11) : généré dans ce même appel
  // (jamais un appel IA séparé), uniquement quand le sujet s'y prête
  // réellement. `null` est le cas attendu et normal pour une notion trop
  // abstraite ou trop courte pour justifier un exercice — jamais imposé
  // artificiellement.
  exercise: z
    .object({
      prompt: z
        .string()
        .min(1)
        .describe(
          "Consigne claire de l'exercice, posée à partir d'une situation concrète à résoudre (jamais vide)",
        ),
      solution: z
        .string()
        .min(1)
        .describe(
          "Correction détaillée et pédagogique de l'exercice : pas seulement la réponse, mais le raisonnement pour l'obtenir (jamais vide)",
        ),
    })
    .nullable()
    .describe(
      "Exercice pratique pour cette leçon, UNIQUEMENT si le sujet s'y prête réellement (sinon null) : jamais un exercice artificiel plaqué sur une notion qui ne s'y prête pas",
    ),
});
export type ChapterContent = z.infer<typeof ChapterContentSchema>;

export const CourseSummarySchema = z.object({
  summary: z.string().describe("Résumé final, markdown, 2-4 paragraphes"),
  keyPoints: z.array(z.string()).describe("Points essentiels à retenir de toute la formation"),
});
export type CourseSummary = z.infer<typeof CourseSummarySchema>;

/**
 * Schéma de sortie IA pour le quiz FINAL (Prompt 05.8), évaluation globale
 * de toute la formation. Délibérément permissif (mêmes raisons que
 * `ModuleQuizSchema` ci-dessous) : la validation stricte est faite
 * séparément, côté application, après réception — voir `generate.ts`.
 * `chapterIndex` reste une métadonnée additive (non affichée côté
 * interface aujourd'hui, voir `QuizQuestion`), conservée pour ne rien
 * retirer du fonctionnement existant.
 */
export const FinalQuizSchema = z.object({
  questions: z.array(
    z.object({
      chapterIndex: z
        .number()
        .int()
        .nullable()
        .describe(
          "Index (0-based) du chapitre principalement concerné par la question, ou null si elle porte sur plusieurs chapitres/modules à la fois",
        ),
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
        .describe(
          "Explication de la bonne réponse, basée uniquement sur le contenu fourni",
        ),
    }),
  ),
});
export type FinalQuiz = z.infer<typeof FinalQuizSchema>;

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
  /**
   * Exercice pratique facultatif (Prompt 05.11) : `null`/absent pour une
   * leçon qui n'en a pas (cas normal, pas une anomalie — ni généré pour un
   * sujet qui ne s'y prête pas, ni présent dans une formation générée avant
   * cette évolution). Colonnes `course_chapters.exercise_prompt`/
   * `exercise_solution` (migration 0015), nullable, donc toujours
   * compatible avec les anciennes formations.
   */
  exercise?: { prompt: string; solution: string } | null;
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
  /**
   * Identifiant réel du quiz de ce module (`quizzes.kind = 'module'`, voir
   * 0010_quizzes.sql et 0012/0013_save_generated_course...sql), chargé
   * depuis la base par `getCourseById` via `quizzes.module_id` — jamais
   * déduit par position. Absent juste après une génération fraîche (pas
   * encore sauvegardée/relue), même logique que `GeneratedChapter.id`.
   */
  quizId?: string | null;
  /**
   * Questions de ce quiz de module. Produites directement par le
   * générateur (Prompt 05.9, une par module réellement généré) ou
   * rechargées depuis la base par `getCourseById` — vide si ce module n'a
   * pas de quiz.
   */
  quiz?: QuizQuestion[];
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
   * Regroupement par modules — un ou plusieurs selon la complexité du
   * sujet (Prompt 05.9). Produit directement par `generateCourse()`
   * (chapitres ET quiz de chaque module) ; rechargé depuis la base par
   * `getCourseById` une fois la formation sauvegardée. `chapters`
   * ci-dessus reste la liste plate faisant autorité pour le chat, la
   * progression et le verrouillage du plan gratuit — `modules` n'est qu'un
   * regroupement, jamais une structure parallèle indépendante.
   */
  modules?: GeneratedModule[];
  summary: string;
  keyPoints: string[];
  quiz: QuizQuestion[];
  /**
   * Identifiant du quiz FINAL (table `quizzes`, `kind = 'final'`), pour
   * démarrer/soumettre une tentative (voir 0011_quiz_attempts.sql). `null`
   * si la formation n'a pas de quiz ; absent juste après une génération
   * fraîche (même logique que `modules`/`chapter.id`).
   */
  quizId?: string | null;
};

// Prompt 05.20.1 : "finition" (quiz de module + résumé) et "quizFinal" et
// "assemblage" (sauvegarde) sont de nouvelles étapes introduites par
// l'architecture à étapes courtes — chacune correspond maintenant à
// plusieurs appels HTTP successifs (un par leçon/quiz) plutôt qu'à une
// seule section du code comme avant ; la granularité d'affichage augmente
// mais la progression reste strictement dans le même ordre qu'avant.
export type GenerationStage =
  | "analyse"
  | "recherche"
  | "programme"
  | "chapitres"
  | "finition"
  | "quizFinal"
  | "assemblage"
  | "pret";

export const STAGE_LABELS: Record<GenerationStage, string> = {
  analyse: "Analyse du sujet...",
  recherche: "Recherche d'exemples et de sources...",
  programme: "Construction du programme...",
  chapitres: "Création des chapitres...",
  finition: "Résumé et quiz de module...",
  quizFinal: "Création du quiz final...",
  assemblage: "Enregistrement de la formation...",
  pret: "Formation prête.",
};
