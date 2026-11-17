import { z } from "zod";

// --- Étape 1 : cadrage de l'analyse ---

export const AnalysisBriefSchema = z.object({
  title: z.string().describe("Titre clair de l'analyse approfondie"),
  domain: z
    .string()
    .describe("Domaine du sujet (ex: finance, e-commerce, tech, énergie...)"),
  introduction: z
    .string()
    .describe(
      "Présentation de l'analyse : ce qu'elle va couvrir et pourquoi ces cas sont instructifs, 2-3 paragraphes, markdown",
    ),
  researchAngle: z
    .string()
    .describe(
      "Angle de recherche : quels types de cas réels chercher (parcours d'entrepreneurs, entreprises, investisseurs, stratégies, réussites, échecs, événements, données) et pourquoi, pour ce sujet précis",
    ),
  caseCount: z
    .number()
    .int()
    .describe("Nombre de cas réels à analyser en profondeur, entre 4 et 7 selon la richesse du sujet"),
  searchQueries: z
    .array(z.string())
    .describe(
      "Entre 4 et 6 requêtes de recherche web distinctes et complémentaires (ex: angles réussite/échec/stratégie/données chiffrées) pour rassembler des cas réels variés",
    ),
});
export type AnalysisBrief = z.infer<typeof AnalysisBriefSchema>;

// --- Étape 2 : extraction des cas réels vérifiés à partir de la recherche web ---

export const CaseExtractionSchema = z.object({
  cases: z.array(
    z.object({
      name: z
        .string()
        .describe("Nom de la personne, de l'entreprise ou de l'événement analysé"),
      summary: z
        .string()
        .describe("Ce qui s'est passé, basé uniquement sur les notes de recherche fournies"),
      outcome: z
        .enum(["succès", "échec", "mixte"])
        .describe("Résultat global de ce cas, pour varier les enseignements (pas uniquement des succès)"),
      sourceUrl: z
        .string()
        .describe("URL exacte, copiée telle quelle depuis les sources fournies"),
      sourceTitle: z.string(),
    }),
  ),
});
export type CaseExtraction = z.infer<typeof CaseExtractionSchema>;
export type VerifiedCase = CaseExtraction["cases"][number];

// --- Étape 3 : rédaction d'une section d'analyse par cas ---

export const DeepSectionSchema = z.object({
  content: z
    .string()
    .describe(
      "Analyse pédagogique détaillée et approfondie en markdown (sous-titres ## autorisés), structurée en plusieurs parties : contexte, ce qui s'est passé, la stratégie ou les décisions clés, pourquoi ça a marché ou échoué (avec des explications causales concrètes, pas de généralités), et ce qu'on peut en tirer. Plus long et plus développé qu'un chapitre de formation classique.",
    ),
  lessons: z
    .array(z.string())
    .describe("3 à 5 enseignements concrets et transférables tirés de ce cas précis"),
});
export type DeepSectionContent = z.infer<typeof DeepSectionSchema>;

// --- Étape 4 : synthèse pédagogique finale ---

export const DeepSynthesisSchema = z.object({
  synthesis: z
    .string()
    .describe(
      "Synthèse pédagogique finale en markdown (3-5 paragraphes) : motifs récurrents entre les cas analysés, ce qui distingue les réussites des échecs, enseignements transversaux",
    ),
  keyLessons: z
    .array(z.string())
    .describe("5 à 8 enseignements clés transversaux, applicables au-delà des cas précis analysés"),
});
export type DeepSynthesis = z.infer<typeof DeepSynthesisSchema>;

// --- Analyse assemblée, prête à être affichée / persistée ---

export type DeepAnalysisSource = {
  index: number;
  url: string;
  title: string;
};

export type DeepAnalysisSection = {
  position: number;
  name: string;
  outcome: "succès" | "échec" | "mixte";
  content: string;
  lessons: string[];
  source: DeepAnalysisSource;
};

export type GeneratedDeepAnalysis = {
  topic: string;
  title: string;
  domain: string;
  introduction: string;
  sections: DeepAnalysisSection[];
  synthesis: string;
  keyLessons: string[];
  sources: DeepAnalysisSource[];
};

// Prompt 05.20.1 : "assemblage" (sauvegarde) est une nouvelle étape
// introduite par l'architecture à étapes courtes.
export type DeepAnalysisStage =
  | "cadrage"
  | "recherche"
  | "redaction"
  | "synthese"
  | "assemblage"
  | "pret";

export const DEEP_STAGE_LABELS: Record<DeepAnalysisStage, string> = {
  cadrage: "Cadrage du sujet...",
  recherche: "Recherche de cas réels sur le web...",
  redaction: "Rédaction de l'analyse...",
  synthese: "Synthèse pédagogique...",
  assemblage: "Enregistrement de l'analyse...",
  pret: "Analyse prête.",
};
