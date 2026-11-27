import { AI_MODEL, webSearchTool } from "@/lib/anthropic/model";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { createAnthropicClient } from "@/lib/anthropic/client";
import {
  isOfflineAI,
  offlineAnalysis,
  offlineChapter,
  offlineFinalQuiz,
  offlineModuleQuiz,
  offlineProgramme,
  offlineSummary,
} from "./offline";
import {
  AnalysisSchema,
  ChapterContentSchema,
  CourseSummarySchema,
  DiagnosticStepSchema,
  FinalQuizSchema,
  ModuleQuizSchema,
  ProgrammeSchema,
  ResearchExtractionSchema,
  STAGE_LABELS,
  type Analysis,
  type ChapterContent,
  type CourseSummary,
  type DiagnosticAnswer,
  type DiagnosticQuestion,
  type GeneratedChapter,
  type GeneratedCourse,
  type GeneratedModule,
  type GenerationStage,
  type Programme,
  type ProgrammeModule,
  type QuizQuestion,
  type VerifiedExample,
} from "./schemas";

const MODEL = AI_MODEL;

export class CourseGenerationError extends Error {}

type Progress = (stage: GenerationStage, detail?: string) => void;

// --- Règles de structure garanties en code (Prompt 05.9, corrigé) — ne
// jamais se fier uniquement au texte envoyé à l'IA pour ces limites, voir
// `validateProgrammeStructure` ci-dessous. Exportées (avec les fonctions
// pures ci-dessous) uniquement pour permettre aux tests automatisés
// (src/lib/courses/__tests__/) d'importer les vraies valeurs/fonctions du
// projet plutôt que de les recopier — aucun changement de comportement. ---
export const MIN_MODULE_COUNT = 2;
export const MAX_MODULE_COUNT = 4;
export const MIN_CHAPTERS_PER_MODULE = 3;
export const MAX_CHAPTERS_PER_MODULE = 5;

// Nombre maximal d'appels IA réellement en vol en même temps, tous types
// confondus (rédaction de leçons, quiz de module, résumé). Protège contre
// une limite de débit côté API et borne le coût/la charge instantanés
// d'une génération, quel que soit le nombre de modules/leçons.
export const MAX_CONCURRENT_AI_CALLS = 4;

/**
 * Limite le nombre d'appels passés à `run()` qui s'exécutent réellement en
 * parallèle à un instant donné, sans rien changer d'autre : `run(fn)`
 * attend qu'une place se libère si la limite est atteinte, puis appelle
 * `fn()` et libère sa place une fois `fn()` terminée (succès OU échec).
 * Une erreur de `fn()` se propage normalement à travers `run()` — rien
 * n'est avalé, le comportement "tout ou rien" de la génération reste
 * intact. Sémaphore à compteur minimal : pas de nouvelle dépendance pour
 * un besoin aussi simple (pas de p-limit, etc.).
 */
export class ConcurrencyLimiter {
  private active = 0;
  private readonly queue: (() => void)[] = [];

  constructor(private readonly limit: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.active += 1;
    try {
      return await fn();
    } finally {
      this.active -= 1;
      const next = this.queue.shift();
      if (next) next();
    }
  }
}

// Longueur plancher purement symbolique (Prompt 05.11, suite à l'audit
// 05.10) : ne sert qu'à détecter une réponse quasiment vide/cassée, jamais
// à exiger une "profondeur" précise — c'est volontairement le prompt de
// `writeChapter` qui porte la consigne qualitative de profondeur, jamais
// un seuil arbitraire en code (cf. consigne explicite : ne jamais rejeter
// une leçon courte si le sujet ne nécessite pas davantage).
const MIN_EXPLANATION_LENGTH = 40;

/**
 * Vérification légère du contenu d'UNE leçon après génération : champs
 * essentiels non vides, et cohérence de l'exercice facultatif (si présent,
 * consigne ET correction doivent être renseignées — jamais l'un sans
 * l'autre). Ne juge jamais la qualité pédagogique elle-même. Retourne la
 * liste des violations constatées (vide si le contenu est acceptable),
 * même esprit que `validateProgrammeStructure` (Prompt 05.9) : jamais se
 * fier uniquement au texte envoyé à l'IA pour ces garanties.
 */
export function validateChapterContent(content: ChapterContent, plan: FlatChapterPlan): string[] {
  const errors: string[] = [];
  const label = `Leçon "${plan.title}" (module "${plan.moduleTitle}")`;

  if (content.explanation.trim().length < MIN_EXPLANATION_LENGTH) {
    errors.push(`${label} : explication anormalement vide ou tronquée.`);
  }
  if (!content.keyTakeaway.trim()) {
    errors.push(`${label} : encadré "à retenir" manquant ou vide.`);
  }
  if (!content.example.description.trim()) {
    errors.push(`${label} : exemple manquant ou vide.`);
  }
  if (content.exercise && (!content.exercise.prompt.trim() || !content.exercise.solution.trim())) {
    errors.push(`${label} : exercice présent mais incomplet (consigne ou correction vide).`);
  }

  return errors;
}

function requireContent<T extends { stop_reason: string | null }>(
  response: T,
): T {
  if (response.stop_reason === "refusal") {
    throw new CourseGenerationError(
      "La génération a été refusée par le modèle pour ce sujet.",
    );
  }
  if (response.stop_reason === "max_tokens") {
    throw new CourseGenerationError(
      "Réponse tronquée (max_tokens atteint) : réessaie ou augmente la limite.",
    );
  }
  return response;
}

async function parseStructured<Schema extends z.ZodType>(
  client: Anthropic,
  args: {
    system: string;
    user: string;
    schema: Schema;
    maxTokens: number;
    effort?: "low" | "medium" | "high";
  },
): Promise<z.infer<Schema>> {
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: args.maxTokens,
    system: args.system,
    messages: [{ role: "user", content: args.user }],
    output_config: {
      format: zodOutputFormat(args.schema),
      ...(args.effort ? { effort: args.effort } : {}),
    },
  });
  requireContent(response);
  if (!response.parsed_output) {
    throw new CourseGenerationError(
      "Réponse du modèle non conforme au format attendu.",
    );
  }
  return response.parsed_output;
}

// --- Étape 1 : analyse du sujet ---

/**
 * Formate les réponses au diagnostic (Prompt 05.18.1) en un paragraphe
 * injecté dans les prompts d'analyse et de construction du programme —
 * jamais analysé/parsé, juste du contexte additionnel en langage naturel.
 * Chaîne vide si `answers` est vide ou absent : `analyzeTopic`/
 * `buildProgramme` produisent alors un prompt IDENTIQUE à avant cette
 * évolution (comportement du parcours "configuration rapide" inchangé).
 */
function formatDiagnosticContext(answers?: DiagnosticAnswer[]): string {
  if (!answers || answers.length === 0) return "";
  const qa = answers
    .map((a) => `- ${a.question} → ${a.answer}`)
    .join("\n");
  return `\n\nRéponses de l'utilisateur au diagnostic préalable (à prendre réellement en compte pour adapter le niveau, le contenu et les exemples) :\n${qa}`;
}

async function analyzeTopic(
  client: Anthropic,
  topic: string,
  diagnosticAnswers?: DiagnosticAnswer[],
): Promise<Analysis> {
  if (isOfflineAI()) return offlineAnalysis(topic, diagnosticAnswers);
  const result = await parseStructured(client, {
    system:
      "Tu es Tavyra, une experte en ingénierie pédagogique. Tu analyses une demande de formation pour en déterminer le domaine, le niveau cible et l'angle d'approche, avant qu'elle ne soit construite par d'autres étapes.",
    user: `Demande de l'utilisateur : "${topic}"\n\nAnalyse ce sujet. Recommande un nombre de modules entre ${MIN_MODULE_COUNT} et ${MAX_MODULE_COUNT} selon la richesse réelle du sujet (privilégie une formation complète : la plupart des sujets concrets, comme le e-commerce, le marketing ou la finance, justifient ${MAX_MODULE_COUNT} modules) : ${MIN_MODULE_COUNT} pour un sujet plus étroit, jusqu'à ${MAX_MODULE_COUNT} pour un sujet riche qui appelle une vraie progression en plusieurs étapes. Détermine si des exemples réels (vraies entreprises, personnes, événements, statistiques) sont pertinents pour ce sujet — ce n'est pas le cas pour des notions très abstraites ou purement techniques où un exemple fictif est plus clair.${formatDiagnosticContext(diagnosticAnswers)}`,
    schema: AnalysisSchema,
    maxTokens: 8000,
    effort: "low",
  });

  // Simple normalisation d'une VALEUR INDICATIVE envoyée ensuite dans le
  // prompt de buildProgramme — ne garantit rien sur la structure réelle
  // produite : c'est validateProgrammeStructure() qui fait foi.
  return {
    ...result,
    moduleCount: Math.min(MAX_MODULE_COUNT, Math.max(MIN_MODULE_COUNT, Math.round(result.moduleCount))),
  };
}

// --- Diagnostic (Prompt 06.40) ---

// Plafond de sécurité commun aux DEUX parcours ci-dessous (figé/gratuit et
// adaptatif/Pro) — jamais un nombre fixe imposé à chaque formation (demande
// explicite : "laisse champ libre"), seulement une limite haute pour éviter
// un diagnostic interminable. Utilisé aussi comme borne de validation des
// tableaux de réponses côté route.ts.
export const MAX_DIAGNOSTIC_QUESTIONS = 10;

// Mots/suites de lettres qu'un visiteur tape parfois pour "juste essayer"
// (constaté en réel : "caca") — jamais exhaustif, seulement les cas les
// plus courants. Volontairement limité au français/anglais générique :
// repéré au-delà de ça, un sujet reste accepté par défaut (mieux vaut
// laisser passer un sujet correct que bloquer un sujet valide).
const NONSENSE_TOPIC_BLOCKLIST = new Set([
  "caca", "pipi", "prout", "zut", "nimportequoi", "truc", "bidule", "chose",
  "lol", "mdr", "haha", "hihi", "blabla", "bla", "test", "testtest",
  "asdf", "asdfgh", "qwerty", "azerty", "xxx", "osef", "nan", "bof",
  "rien", "abc", "coucou", "salut", "quoi", "ouais", "nimportquoi",
]);

function normalizeTopicText(topic: string): string {
  return topic
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

const VOWEL_PATTERN = /[aeiouy]/;

// Une suite de lettres sans aucune voyelle (ex. "hddkd") ou un caractère
// martelé (ex. "aaaa") n'est jamais un vrai mot — repéré sans IA.
function looksLikeGibberishToken(token: string): boolean {
  if (token.length < 4) return false;
  if (!VOWEL_PATTERN.test(token)) return true;
  if (/^(.)\1{3,}$/.test(token)) return true;
  return false;
}

/**
 * Heuristique SANS AUCUN appel Claude (réservée au plan gratuit, voir
 * route.ts — le plan Pro laisse le vrai modèle juger lui-même de la
 * clarté du sujet). Volontairement limitée : elle repère le charabia
 * clavier et une courte liste de sujets-blagues courants, jamais une
 * compréhension réelle du sens — un sujet qui passe cette heuristique
 * n'est donc pas forcément un BON sujet de formation, seulement un sujet
 * qui n'est pas du charabia évident.
 */
export function isTopicPlausible(topic: string): boolean {
  const normalized = normalizeTopicText(topic);
  if (normalized.length < 2) return false;

  const compact = normalized.replace(/[^a-z0-9]+/g, "");
  if (NONSENSE_TOPIC_BLOCKLIST.has(compact)) return false;

  const tokens = normalized.split(/[^a-z0-9]+/).filter(Boolean);
  if (tokens.length === 0) return false;
  if (tokens.every((t) => NONSENSE_TOPIC_BLOCKLIST.has(t))) return false;
  if (tokens.every((t) => looksLikeGibberishToken(t))) return false;

  return true;
}

type TopicCategory =
  | "ecommerce"
  | "business"
  | "tech"
  | "langue"
  | "finance"
  | "sante"
  | "creatif"
  | "generic";

const CATEGORY_KEYWORDS: Record<Exclude<TopicCategory, "generic">, string[]> = {
  ecommerce: ["ecommerce", "e-commerce", "boutique en ligne", "boutique", "dropshipping", "shopify", "vente en ligne", "marketplace", "amazon fba", "etsy"],
  business: ["entreprise", "business", "entrepreneuriat", "startup", "marketing", "negociation", "management", "strategie", "freelance", "ventes", "commercial"],
  tech: ["programmation", "code", "developpement", "developpeur", "python", "javascript", "informatique", "intelligence artificielle", "data", "excel", "seo", "html", "css", "react", "sql", "cybersecurite"],
  langue: ["anglais", "espagnol", "allemand", "italien", "grammaire", "vocabulaire", "langue etrangere"],
  finance: ["bourse", "investissement", "investir", "argent", "finance", "crypto", "immobilier", "epargne", "budget"],
  sante: ["fitness", "musculation", "sport", "nutrition", "sante", "bien-etre", "meditation", "yoga", "sommeil"],
  creatif: ["dessin", "musique", "ecriture", "photographie", "photo", "art", "design", "guitare", "piano", "peinture"],
};

function detectTopicCategory(topic: string): TopicCategory {
  const normalized = normalizeTopicText(topic);
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [TopicCategory, string[]][]) {
    if (keywords.some((keyword) => normalized.includes(keyword))) return category;
  }
  return "generic";
}

type FreeDiagnosticStep = {
  id: string;
  build: (topic: string, lastAnswer: string | null) => { question: string; choices: string[] };
};

function niveauStep(topic: string): { question: string; choices: string[] } {
  return {
    question: `Où en es-tu aujourd'hui avec "${topic}" ?`,
    choices: [
      "Je découvre tout juste le sujet",
      "J'ai déjà quelques bases",
      "Je suis à l'aise, je veux progresser",
      "Je suis déjà expérimenté(e)",
    ],
  };
}

// Banques par catégorie (Prompt 06.40, zéro appel Claude pour le plan
// gratuit) : la 1ʳᵉ question ("niveau") est toujours la même, les
// suivantes sont écrites pour CE type de sujet précis et au moins l'une
// d'entre elles tient compte littéralement de la réponse précédente
// (`lastAnswer`), pour donner l'impression d'être réellement écouté même
// sans IA — jamais un nombre fixe de questions, chaque catégorie a sa
// propre longueur.
const CATEGORY_STEPS: Record<TopicCategory, FreeDiagnosticStep[]> = {
  ecommerce: [
    {
      id: "ventes",
      build: () => ({
        question: "As-tu déjà réalisé des ventes, même petites ?",
        choices: [
          "Non, jamais fait de vente",
          "Quelques ventes test seulement",
          "Oui, régulièrement",
          "Oui, c'est déjà mon activité principale",
        ],
      }),
    },
    {
      id: "plateforme",
      build: (topic, lastAnswer) =>
        lastAnswer?.startsWith("Non")
          ? {
              question: "Qu'est-ce qui t'empêche le plus de démarrer tes premières ventes ?",
              choices: ["Trouver les bons produits", "Créer ma boutique en ligne", "Trouver des clients", "La partie technique"],
            }
          : {
              question: `Tu as déjà vendu — sur quelle plateforme principalement, pour "${topic}" ?`,
              choices: ["Shopify ou un site perso", "Amazon ou une marketplace", "Instagram, TikTok ou les réseaux sociaux", "Un autre canal"],
            },
    },
    {
      id: "produit",
      build: () => ({
        question: "Quel type de produit veux-tu vendre (ou vends-tu déjà) ?",
        choices: [
          "Un produit physique que je fabrique",
          "Un produit physique que j'achète pour revendre",
          "Un produit numérique ou un service",
          "Je n'ai pas encore décidé",
        ],
      }),
    },
    {
      id: "objectif",
      build: () => ({
        question: "Quel est ton objectif principal avec le e-commerce ?",
        choices: [
          "Un revenu complémentaire",
          "En faire mon activité principale",
          "Tester une idée avant de me lancer vraiment",
          "Comprendre comment ça marche, par curiosité",
        ],
      }),
    },
    {
      id: "temps",
      build: () => ({
        question: "Combien de temps peux-tu y consacrer chaque semaine ?",
        choices: ["Quelques heures", "Plusieurs soirs par semaine", "Beaucoup de temps disponible", "Je ne sais pas encore"],
      }),
    },
  ],
  business: [
    {
      id: "activite",
      build: () => ({
        question: "As-tu déjà une activité ou une entreprise, même petite ?",
        choices: ["Non, c'est un projet pour l'instant", "Oui, en tout début d'activité", "Oui, depuis un moment déjà", "Non, je travaille pour quelqu'un d'autre"],
      }),
    },
    {
      id: "frein",
      build: (topic, lastAnswer) =>
        lastAnswer?.startsWith("Non, c'est un projet")
          ? {
              question: "Qu'est-ce qui te freine le plus pour démarrer ?",
              choices: ["Le manque de clarté sur l'offre", "Le manque de temps", "Le manque de confiance", "Le manque de moyens financiers"],
            }
          : {
              question: `Dans "${topic}", quelle est ta plus grande difficulté actuelle ?`,
              choices: ["Trouver des clients", "Gérer mon temps", "Fixer mes prix", "Développer une stratégie claire"],
            },
    },
    {
      id: "objectif",
      build: () => ({
        question: "Quel est ton objectif principal ?",
        choices: ["Me lancer", "Stabiliser mon activité actuelle", "Faire grandir ce que j'ai déjà", "Changer complètement de direction"],
      }),
    },
    {
      id: "secteur",
      build: () => ({
        question: "Ton projet s'adresse surtout à qui ?",
        choices: ["Des particuliers", "Des entreprises", "Les deux", "Je ne sais pas encore"],
      }),
    },
  ],
  tech: [
    {
      id: "pratique",
      build: () => ({
        question: "As-tu déjà écrit du code ou utilisé cet outil concrètement ?",
        choices: ["Jamais", "Un peu, en autodidacte", "Oui, sur des petits projets", "Oui, régulièrement"],
      }),
    },
    {
      id: "projet",
      build: (topic, lastAnswer) =>
        lastAnswer === "Jamais"
          ? {
              question: "Qu'est-ce qui t'attire le plus dans ce sujet ?",
              choices: ["Créer quelque chose de concret", "Changer de métier", "Comprendre comment ça marche", "On me le demande pour mon travail"],
            }
          : {
              question: `As-tu déjà un projet précis en tête pour "${topic}" ?`,
              choices: ["Oui, un projet concret", "Une idée pas encore précise", "Non, j'apprends pour l'instant sans projet", "C'est pour mon travail actuel"],
            },
    },
    {
      id: "niveau_technique",
      build: () => ({
        question: "À l'aise avec la logique/les bases techniques en général ?",
        choices: ["Pas du tout", "Un peu", "Oui, assez à l'aise", "Oui, très à l'aise"],
      }),
    },
    {
      id: "objectif",
      build: () => ({
        question: "Quel est ton objectif principal ?",
        choices: ["Un projet personnel", "Une reconversion professionnelle", "Une compétence utile pour mon poste actuel", "Par curiosité"],
      }),
    },
  ],
  langue: [
    {
      id: "pratique",
      build: () => ({
        question: "As-tu déjà l'occasion de pratiquer (voyage, travail, proches) ?",
        choices: ["Jamais", "Rarement", "De temps en temps", "Régulièrement"],
      }),
    },
    {
      id: "objectif",
      build: (topic, lastAnswer) =>
        lastAnswer === "Jamais" || lastAnswer === "Rarement"
          ? {
              question: "Dans quel contexte veux-tu pouvoir l'utiliser bientôt ?",
              choices: ["Un voyage prévu", "Le travail", "Discuter avec quelqu'un en particulier", "Pas de contexte précis, juste apprendre"],
            }
          : {
              question: `Dans quel contexte pratiques-tu déjà, ou veux-tu progresser avec "${topic}" ?`,
              choices: ["Le travail", "Des voyages", "Des échanges avec des proches", "Pour le plaisir d'apprendre"],
            },
    },
    {
      id: "competence",
      build: () => ({
        question: "Qu'est-ce qui te bloque le plus aujourd'hui ?",
        choices: ["Parler à l'oral", "Comprendre à l'oral", "La grammaire/l'écrit", "Le vocabulaire"],
      }),
    },
    {
      id: "temps",
      build: () => ({
        question: "Combien de temps veux-tu y consacrer ?",
        choices: ["Quelques minutes par jour", "Quelques fois par semaine", "Intensément sur une courte période", "Je ne sais pas encore"],
      }),
    },
  ],
  finance: [
    {
      id: "pratique",
      build: () => ({
        question: "As-tu déjà investi ou géré un budget sérieusement ?",
        choices: ["Jamais", "Un peu, sans vraie méthode", "Oui, de façon régulière", "Oui, c'est déjà une vraie habitude"],
      }),
    },
    {
      id: "objectif",
      build: (topic, lastAnswer) =>
        lastAnswer === "Jamais"
          ? {
              question: "Qu'est-ce qui te retient le plus pour commencer ?",
              choices: ["La peur de perdre de l'argent", "Le manque de connaissances", "Le manque de temps", "Je ne sais pas par où commencer"],
            }
          : {
              question: `Avec "${topic}", quel est ton objectif principal maintenant ?`,
              choices: ["Protéger ce que j'ai déjà", "Faire grandir mon épargne", "Comprendre mieux ce que je fais déjà", "Changer complètement de stratégie"],
            },
    },
    {
      id: "horizon",
      build: () => ({
        question: "Sur quel horizon de temps raisonnes-tu ?",
        choices: ["Court terme", "Quelques années", "Long terme (retraite, etc.)", "Je ne sais pas encore"],
      }),
    },
    {
      id: "risque",
      build: () => ({
        question: "Comment tu te situes face au risque ?",
        choices: ["Je préfère la sécurité avant tout", "Un peu de risque mesuré", "À l'aise avec plus de risque", "Je ne sais pas encore"],
      }),
    },
  ],
  sante: [
    {
      id: "pratique",
      build: () => ({
        question: "As-tu déjà une pratique régulière liée à ce sujet ?",
        choices: ["Non, je démarre de zéro", "Un peu, de façon irrégulière", "Oui, régulièrement", "Oui, depuis longtemps"],
      }),
    },
    {
      id: "objectif",
      build: (topic, lastAnswer) =>
        lastAnswer === "Non, je démarre de zéro"
          ? {
              question: "Qu'est-ce qui t'a donné envie de commencer maintenant ?",
              choices: ["Une envie de changement", "Un conseil médical ou de santé", "Un objectif précis (événement, saison...)", "Juste par curiosité"],
            }
          : {
              question: `Avec "${topic}", quel est ton objectif principal maintenant ?`,
              choices: ["Progresser encore", "Tenir sur la durée", "Corriger une mauvaise habitude", "Me remettre après une pause"],
            },
    },
    {
      id: "contrainte",
      build: () => ({
        question: "As-tu une contrainte particulière à prendre en compte ?",
        choices: ["Aucune contrainte particulière", "Peu de temps disponible", "Une limite physique ou de santé", "Je débute, j'ai besoin de douceur"],
      }),
    },
    {
      id: "temps",
      build: () => ({
        question: "Combien de temps peux-tu y consacrer ?",
        choices: ["Quelques minutes par jour", "Quelques séances par semaine", "Je peux y mettre beaucoup de temps", "Je ne sais pas encore"],
      }),
    },
  ],
  creatif: [
    {
      id: "pratique",
      build: () => ({
        question: "As-tu déjà pratiqué, même en amateur ?",
        choices: ["Jamais", "Un peu, pour le plaisir", "Oui, régulièrement", "Oui, à un niveau déjà avancé"],
      }),
    },
    {
      id: "objectif",
      build: (topic, lastAnswer) =>
        lastAnswer === "Jamais"
          ? {
              question: "Qu'est-ce qui te donne envie de t'y mettre maintenant ?",
              choices: ["Une envie personnelle depuis longtemps", "Un projet précis en tête", "Pour me détendre", "Pour en faire quelque chose de professionnel un jour"],
            }
          : {
              question: `Avec "${topic}", quel est ton objectif principal maintenant ?`,
              choices: ["Progresser techniquement", "Trouver mon propre style", "En faire une activité professionnelle", "Juste pour le plaisir"],
            },
    },
    {
      id: "materiel",
      build: () => ({
        question: "As-tu déjà le matériel/les outils de base ?",
        choices: ["Oui, tout ce qu'il faut", "Un peu, pas encore tout", "Non, pas encore", "Je ne sais pas ce qu'il me faut"],
      }),
    },
    {
      id: "temps",
      build: () => ({
        question: "Combien de temps veux-tu y consacrer ?",
        choices: ["Quelques minutes par jour", "Quelques sessions par semaine", "Beaucoup de temps disponible", "Je ne sais pas encore"],
      }),
    },
  ],
  // Sujet non reconnu par les catégories ci-dessus : questions génériques
  // mais qui restent personnalisées par le texte exact du sujet et, pour
  // la 2ᵉ question, par la réponse donnée à la 1ʳᵉ.
  generic: [
    {
      id: "pratique",
      build: () => ({
        question: "As-tu déjà mis ça en pratique concrètement (un projet, un outil, une action réelle) ?",
        choices: ["Non, jamais", "Un peu, de façon basique", "Oui, plusieurs fois", "Oui, régulièrement"],
      }),
    },
    {
      id: "objectif",
      build: (topic, lastAnswer) =>
        lastAnswer?.startsWith("Non")
          ? {
              question: `Qu'est-ce qui te donne envie d'apprendre "${topic}" maintenant ?`,
              choices: ["Une curiosité personnelle", "Un besoin précis (travail, projet...)", "Une reconversion", "Je ne sais pas encore bien pourquoi"],
            }
          : {
              question: "Quel est ton objectif principal avec cette formation ?",
              choices: ["Comprendre les bases", "Approfondir mes connaissances", "Résoudre un problème précis", "Me professionnaliser sur ce sujet"],
            },
    },
    {
      id: "contexte",
      build: () => ({
        question: "Dans quel contexte vas-tu utiliser ce que tu apprends ?",
        choices: [
          "Un projet personnel",
          "Mon travail ou mes études actuels",
          "Une reconversion ou un nouveau projet professionnel",
          "Simple curiosité, sans objectif précis",
        ],
      }),
    },
    {
      id: "temps",
      build: () => ({
        question: "Combien de temps veux-tu consacrer à l'apprentissage ?",
        choices: ["Quelques minutes par jour", "Une session complète de temps en temps", "Je veux aller vite et intensément"],
      }),
    },
  ],
};

/**
 * Renvoie la PROCHAINE question du diagnostic FIGÉ (zéro appel Claude,
 * réservé au plan gratuit — voir route.ts) — `null` une fois la banque de
 * la catégorie détectée épuisée (longueur volontairement variable selon
 * la catégorie, jamais un nombre fixe imposé à tous les sujets). La 1ʳᵉ
 * question est toujours "niveau" ; les suivantes viennent de
 * `CATEGORY_STEPS`, certaines tenant compte littéralement de la réponse
 * précédente pour donner l'impression d'être réellement écouté.
 */
export function generateFreeDiagnosticQuestion(
  topic: string,
  previousAnswers: DiagnosticAnswer[],
): DiagnosticQuestion | null {
  const index = previousAnswers.length;
  if (index === 0) {
    const { question, choices } = niveauStep(topic);
    return { id: "niveau", question, type: "single_choice", choices };
  }

  const category = detectTopicCategory(topic);
  const steps = CATEGORY_STEPS[category];
  const stepIndex = index - 1;
  if (stepIndex >= steps.length) return null;

  const step = steps[stepIndex];
  const lastAnswer = previousAnswers[index - 1]?.answer ?? null;
  const { question, choices } = step.build(topic, lastAnswer);
  return { id: step.id, question, type: "single_choice", choices };
}

/**
 * Diagnostic ADAPTATIF réservé au plan Pro (Prompt 06.40, demande
 * explicite : "le plan Pro pourra faire des appels Anthropic mais pas le
 * plan gratuit") : un vrai appel Claude, qui juge lui-même si le sujet est
 * compréhensible comme sujet de formation (`unclear: true` sinon, ex.
 * "hddkd" ou "caca"), et qui construit CHAQUE question suivante en tenant
 * compte du contenu réel des réponses précédentes — jamais une banque
 * figée. Le nombre de questions reste volontairement ouvert ("done" décidé
 * par le modèle), seulement plafonné par MAX_DIAGNOSTIC_QUESTIONS.
 */
export async function generateAdaptiveDiagnosticQuestion(
  client: Anthropic,
  topic: string,
  previousAnswers: DiagnosticAnswer[],
): Promise<{ question: DiagnosticQuestion | null; unclear: boolean }> {
  if (isOfflineAI()) {
    return { question: generateFreeDiagnosticQuestion(topic, previousAnswers), unclear: false };
  }
  if (previousAnswers.length >= MAX_DIAGNOSTIC_QUESTIONS) {
    return { question: null, unclear: false };
  }

  const history =
    previousAnswers.length === 0
      ? "(aucune question posée encore)"
      : previousAnswers.map((a) => `- ${a.question} → ${a.answer}`).join("\n");

  const result = await parseStructured(client, {
    system:
      "Tu es Tavyra, une experte en ingénierie pédagogique qui mène un diagnostic avant de construire une formation sur mesure. Ton rôle : d'abord vérifier que le sujet demandé est compréhensible comme sujet de formation réel (ex. \"voiture\", \"la bourse\", \"le piano\" sont compréhensibles même vagues ; \"hddkd\" ou \"caca\" ne le sont pas). Ensuite, poser UNE SEULE question à la fois, qui tient VRAIMENT compte du contenu des réponses précédentes (reformule ou référence ce que la personne vient de répondre, comme le ferait une vraie personne qui l'écoute) plutôt que des questions génériques interchangeables. Décide toi-même quand tu as assez d'informations pour construire un bon plan (`done: true`), sans viser un nombre de questions précis.",
    user: `Sujet demandé : "${topic}"\n\nHistorique des réponses déjà données :\n${history}\n\nSi "${topic}" n'est pas compréhensible comme sujet de formation, renvoie unclear: true, done: false, question: null. Sinon, si tu as déjà assez d'informations (ou si l'historique est déjà riche), renvoie unclear: false, done: true, question: null. Sinon, renvoie unclear: false, done: false, et UNE question pertinente qui tient compte du contenu réel de la dernière réponse si elle existe.`,
    schema: DiagnosticStepSchema,
    maxTokens: 12000,
    effort: "low",
  });

  if (result.unclear) return { question: null, unclear: true };
  if (result.done || !result.question) return { question: null, unclear: false };
  return { question: result.question, unclear: false };
}

/**
 * Estimation purement déterministe (jamais demandée à l'IA) du temps de
 * lecture total d'une formation, à partir du nombre réel de leçons/quiz —
 * "si elle peut être calculée raisonnablement" : un ordre de grandeur
 * suffit, jamais présenté comme une mesure précise.
 */
export const MINUTES_PER_CHAPTER = 8;
export const MINUTES_PER_MODULE_QUIZ = 5;
export const MINUTES_FINAL_QUIZ = 10;

export function estimateCourseDurationMinutes(programme: Pick<Programme, "modules">): number {
  const chapterCount = programme.modules.reduce((sum, m) => sum + m.chapters.length, 0);
  const moduleQuizCount = programme.modules.length;
  return (
    chapterCount * MINUTES_PER_CHAPTER +
    moduleQuizCount * MINUTES_PER_MODULE_QUIZ +
    MINUTES_FINAL_QUIZ
  );
}

// --- Étape 2 : recherche d'exemples réels vérifiés ---

async function searchRealExamples(
  client: Anthropic,
  analysis: Analysis,
): Promise<{ findings: string; realSources: { url: string; title: string }[] }> {
  if (isOfflineAI()) return { findings: "", realSources: [] };
  const system =
    "Tu es Tavyra, chargée de trouver des exemples réels et vérifiables (vraies entreprises, personnes, événements, statistiques) pour illustrer une formation. Utilise l'outil de recherche web pour vérifier chaque fait avant de l'avancer. N'affirme jamais qu'un exemple est réel sans l'avoir confirmé par une recherche.";
  const user = `Sujet de la formation : "${analysis.title}" (domaine : ${analysis.domain}, niveau ${analysis.level}).\n\nTrouve entre ${Math.min(8, analysis.moduleCount * 2 + 2)} et 8 exemples réels et vérifiables pertinents pour illustrer différents aspects de ce sujet. Pour chacun : cherche sur le web pour vérifier les faits, puis décris ce que l'exemple illustre et quel aspect du sujet il concerne. Cite explicitement l'URL exacte de ta source pour chaque exemple.`;

  let messages: Anthropic.MessageParam[] = [{ role: "user", content: user }];
  const tools = [
    webSearchTool(8),
  ];

  let response = requireContent(
    await client.messages.create({
      model: MODEL,
      max_tokens: 12000,
      system,
      messages,
      tools,
    }),
  );

  // Les tours de recherche serveur peuvent s'arrêter sur pause_turn si la
  // limite interne d'itérations est atteinte : on relance pour continuer.
  let resumes = 0;
  while (response.stop_reason === "pause_turn" && resumes < 3) {
    messages = [...messages, { role: "assistant", content: response.content }];
    response = requireContent(
      await client.messages.create({
        model: MODEL,
        max_tokens: 12000,
        system,
        messages,
        tools,
      }),
    );
    resumes += 1;
  }

  const findings = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n\n");

  const realSources: { url: string; title: string }[] = [];
  for (const block of response.content) {
    if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
      for (const item of block.content) {
        if (item.type === "web_search_result" && item.url) {
          realSources.push({ url: item.url, title: item.title ?? item.url });
        }
      }
    }
  }

  return { findings, realSources };
}

async function extractVerifiedExamples(
  client: Anthropic,
  analysis: Analysis,
  findings: string,
  realSources: { url: string; title: string }[],
): Promise<VerifiedExample[]> {
  if (realSources.length === 0) return [];

  const sourceList = realSources
    .map((s) => `- ${s.url} (${s.title})`)
    .join("\n");

  const result = await parseStructured(client, {
    system:
      "Tu extrais des exemples réels vérifiés à partir de notes de recherche, pour une formation. Pour chaque exemple, l'URL source doit être copiée EXACTEMENT depuis la liste fournie — jamais inventée, jamais modifiée.",
    user: `Sujet : "${analysis.title}"\n\nNotes de recherche :\n${findings}\n\nSources réellement trouvées (copie l'URL exactement) :\n${sourceList}\n\nExtrais la liste des exemples réels et vérifiés, chacun avec sa source exacte tirée de la liste ci-dessus.`,
    schema: ResearchExtractionSchema,
    maxTokens: 12000,
  });

  const realUrlSet = new Set(realSources.map((s) => s.url.trim().replace(/\/$/, "")));
  // Filet de sécurité anti-hallucination : un exemple dont l'URL ne
  // correspond à aucune source réellement trouvée est écarté du pool vérifié.
  return result.examples.filter((example) =>
    realUrlSet.has(example.sourceUrl.trim().replace(/\/$/, "")),
  );
}

// --- Étape 3 : construction du programme ---

/**
 * Vérifie en CODE (pas seulement dans le texte envoyé à l'IA) que la
 * structure produite respecte les règles garanties : nombre de modules,
 * nombre de leçons par module, titre et objectif pédagogique non vides
 * pour chaque module. Retourne la liste des violations constatées (vide
 * si la structure est valide) — jamais un simple booléen, pour pouvoir
 * fournir à l'IA un message de correction précis si besoin.
 */
export function validateProgrammeStructure(programme: Programme): string[] {
  const errors: string[] = [];

  const moduleCount = programme.modules.length;
  if (moduleCount < MIN_MODULE_COUNT || moduleCount > MAX_MODULE_COUNT) {
    errors.push(
      `Nombre de modules invalide : ${moduleCount} (attendu entre ${MIN_MODULE_COUNT} et ${MAX_MODULE_COUNT}).`,
    );
  }

  programme.modules.forEach((m, i) => {
    const label = `Module ${i + 1}${m.title ? ` ("${m.title}")` : ""}`;
    const chapterCount = m.chapters.length;
    if (chapterCount < MIN_CHAPTERS_PER_MODULE || chapterCount > MAX_CHAPTERS_PER_MODULE) {
      errors.push(
        `${label} : ${chapterCount} leçon(s) (attendu entre ${MIN_CHAPTERS_PER_MODULE} et ${MAX_CHAPTERS_PER_MODULE}).`,
      );
    }
    if (!m.title || !m.title.trim()) {
      errors.push(`${label} : titre manquant ou vide.`);
    }
    if (!m.objective || !m.objective.trim()) {
      errors.push(`${label} : objectif pédagogique manquant ou vide.`);
    }
  });

  return errors;
}

/**
 * Construit le plan détaillé de la formation, puis VÉRIFIE en code que le
 * nombre de modules et de leçons par module respecte les règles garanties
 * (voir `validateProgrammeStructure`). Si la structure est invalide, une
 * seule tentative de correction est faite auprès de l'IA, avec le détail
 * exact des violations constatées. Si elle reste invalide après cette
 * tentative, la génération s'arrête ici — avant tout appel de rédaction de
 * leçon, de quiz ou de résumé — avec une erreur explicite : on n'accepte
 * jamais silencieusement une structure hors limites.
 */
/** Résumé textuel compact d'un programme, pour le réinjecter dans un prompt d'ajustement (jamais pour autre chose : aucun parsing, juste du contexte). */
function describeProgrammeForPrompt(programme?: Programme): string {
  if (!programme) return "(aucun plan précédent disponible)";
  return programme.modules
    .map(
      (m, i) =>
        `Module ${i + 1} — "${m.title}" (objectif : ${m.objective})\n` +
        m.chapters.map((c, j) => `  ${j + 1}. ${c.title} — ${c.summary}`).join("\n"),
    )
    .join("\n\n");
}

async function buildProgramme(
  client: Anthropic,
  analysis: Analysis,
  verifiedExamples: VerifiedExample[],
  diagnosticAnswers?: DiagnosticAnswer[],
  adjustmentRequest?: string,
  previousProgramme?: Programme,
): Promise<Programme> {
  if (isOfflineAI()) return offlineProgramme(analysis, diagnosticAnswers);
  const examplesList =
    verifiedExamples.length > 0
      ? verifiedExamples
          .map((e, i) => `[${i}] (${e.theme}) ${e.description} — source : ${e.sourceUrl}`)
          .join("\n")
      : "Aucun exemple réel vérifié disponible — tous les chapitres utiliseront des exemples fictifs/illustratifs, clairement indiqués comme tels.";

  const system =
    "Tu es Tavyra. Tu construis le plan détaillé d'une formation structurée en modules : introduction, objectifs pédagogiques, et une liste de modules progressifs, chacun avec un titre précis, un objectif pédagogique clair et plusieurs leçons cohérentes. La structure doit être adaptée au sujet (une formation finance n'a pas la même structure qu'une formation histoire) ; le découpage en modules et en leçons doit refléter la complexité réelle du sujet, jamais un gabarit fixe imposé artificiellement. Chaque module doit apporter des notions distinctes : évite toute répétition de contenu entre modules.";

  // Prompt 05.18.1 : demande d'ajustement explicite de l'utilisateur sur un
  // plan déjà proposé — jamais analysée/validée ici, transmise telle
  // quelle, exactement comme le sujet lui-même. Le plan précédent est
  // inclus comme point de départ concret (jamais régénéré en ignorant ce
  // qui existait déjà) : seuls les points demandés doivent changer.
  const adjustmentNote = adjustmentRequest?.trim()
    ? `\n\nPlan proposé précédemment, à prendre comme point de départ :\n${describeProgrammeForPrompt(previousProgramme)}\n\nL'utilisateur a demandé cet ajustement sur cette proposition — respecte-le autant que possible, en conservant le reste du plan tel quel, sans jamais sortir des règles strictes ci-dessous : "${adjustmentRequest.trim()}"`
    : "";

  const baseUser = `Sujet : "${analysis.title}" (domaine : ${analysis.domain}, niveau ${analysis.level}, angle : ${analysis.angle}).\n\nConstruis un plan en ${analysis.moduleCount} modules, progressifs (chaque module s'appuie sur les précédents) — par exemple, à titre d'illustration et non comme structure obligatoire : introduction et fondamentaux, développement des connaissances, approfondissement et mise en pratique, puis maîtrise des notions avancées si le sujet le justifie. Adapte librement cette progression au sujet réel. Le plan doit couvrir le sujet exact de A à Z avec des notions concrètes propres à ce domaine (jamais de modules ou leçons génériques sur la motivation, la discipline ou « comment apprendre »), et tenir compte des réponses au diagnostic : ne réexplique pas longuement ce que l'utilisateur maîtrise déjà, insiste sur ce qui lui manque et sur son objectif. Règles STRICTES à respecter : entre ${MIN_MODULE_COUNT} et ${MAX_MODULE_COUNT} modules au total, chacun avec un titre précis, un véritable objectif pédagogique (jamais vide, ce que l'apprenant saura faire précisément après ce module), et entre ${MIN_CHAPTERS_PER_MODULE} et ${MAX_CHAPTERS_PER_MODULE} leçons cohérentes et suffisamment développées (vise le haut de la fourchette pour un sujet riche : l'apprenant doit ressortir avec une maîtrise complète).\n\nExemples réels vérifiés disponibles (assigne-en un par exampleIndex à la leçon la plus pertinente s'il y en a un adapté, sinon laisse exampleIndex à null) :\n${examplesList}${formatDiagnosticContext(diagnosticAnswers)}${adjustmentNote}`;

  let programme = await parseStructured(client, {
    system,
    user: baseUser,
    schema: ProgrammeSchema,
    maxTokens: 24000,
    effort: "low",
  });
  let errors = validateProgrammeStructure(programme);

  if (errors.length > 0) {
    // Une seule tentative de correction, avec le détail exact de ce qui ne
    // va pas, pour donner à l'IA sa meilleure chance de s'auto-corriger
    // sans deviner. Jamais de boucle de nouvelles tentatives au-delà.
    const correctionUser = `${baseUser}\n\n---\nTa réponse précédente ne respecte PAS les règles strictes ci-dessus :\n${errors.map((e) => `- ${e}`).join("\n")}\n\nRenvoie un plan ENTIÈREMENT corrigé (pas un correctif partiel) qui respecte exactement : entre ${MIN_MODULE_COUNT} et ${MAX_MODULE_COUNT} modules, chacun avec un titre non vide, un objectif pédagogique non vide, et entre ${MIN_CHAPTERS_PER_MODULE} et ${MAX_CHAPTERS_PER_MODULE} leçons.`;

    programme = await parseStructured(client, {
      system,
      user: correctionUser,
      schema: ProgrammeSchema,
      maxTokens: 24000,
      effort: "low",
    });
    errors = validateProgrammeStructure(programme);
  }

  if (errors.length > 0) {
    // Arrêt propre AVANT tout appel coûteux de rédaction de leçon, de quiz
    // ou de résumé : jamais de structure invalide acceptée silencieusement.
    throw new CourseGenerationError(
      `Impossible de construire un programme valide après correction : ${errors.join(" ")}`,
    );
  }

  return programme;
}

// --- Étape 4 : rédaction des chapitres ---

/**
 * Une leçon planifiée, repérée par sa position globale (0..N-1 sur toute
 * la formation) ET son module d'origine — `moduleObjective`,
 * `positionInModule` et `chaptersInModule` sont transmis explicitement à
 * `writeChapter` (correction de l'audit du Prompt 05.9) plutôt que de ne
 * dépendre que de leur lecture indirecte dans `buildModuleOutline`.
 */
export type FlatChapterPlan = {
  globalIndex: number;
  moduleIndex: number;
  totalModules: number;
  moduleTitle: string;
  moduleObjective: string;
  /** Rang (0-based) de cette leçon au sein de son module. */
  positionInModule: number;
  /** Nombre total de leçons de ce module. */
  chaptersInModule: number;
  title: string;
  summary: string;
  exampleIndex: number | null;
};

/**
 * Aplatit le plan modules → leçons en une liste unique, dans l'ordre des
 * modules : `globalIndex` est la position qui fait autorité partout
 * ailleurs dans le pipeline (chat, progression, verrouillage du plan
 * gratuit, quiz final) — exactement le même rôle que `programme.chapters`
 * avant cette évolution, juste reconstruit à partir de la hiérarchie par
 * modules plutôt que d'une liste plate produite directement par l'IA.
 */
export function flattenModulePlans(modules: ProgrammeModule[]): FlatChapterPlan[] {
  const flat: FlatChapterPlan[] = [];
  modules.forEach((m, moduleIndex) => {
    m.chapters.forEach((c, positionInModule) => {
      flat.push({
        globalIndex: flat.length,
        moduleIndex,
        totalModules: modules.length,
        moduleTitle: m.title,
        moduleObjective: m.objective,
        positionInModule,
        chaptersInModule: m.chapters.length,
        title: c.title,
        summary: c.summary,
        exampleIndex: c.exampleIndex,
      });
    });
  });
  return flat;
}

/**
 * Plan complet affiché à chaque leçon pour qu'elle se situe dans la
 * progression globale — regroupé par module (titre + objectif) plutôt
 * qu'en liste plate, pour que chaque leçon perçoive la frontière entre
 * modules et évite de répéter ce qu'un AUTRE module doit couvrir.
 */
function buildModuleOutline(modules: ProgrammeModule[], currentGlobalIndex: number): string {
  let i = 0;
  const lines: string[] = [];
  modules.forEach((m, moduleIndex) => {
    lines.push(`Module ${moduleIndex + 1} — ${m.title} (objectif : ${m.objective})`);
    for (const c of m.chapters) {
      const marker = i === currentGlobalIndex ? " ← cette leçon" : "";
      lines.push(`  ${i + 1}. ${c.title}${marker} — ${c.summary}`);
      i += 1;
    }
  });
  return lines.join("\n");
}

export async function writeChapter(
  client: Anthropic,
  analysis: Analysis,
  modules: ProgrammeModule[],
  plan: FlatChapterPlan,
  assignedExample: VerifiedExample | null,
): Promise<ChapterContent> {
  if (isOfflineAI()) return offlineChapter(analysis, plan);
  // Les leçons sont rédigées en parallèle (latence) : chacune reçoit le
  // plan complet (groupé par module) pour se situer dans la progression,
  // plutôt que le contenu déjà écrit des précédentes.
  const outline = buildModuleOutline(modules, plan.globalIndex);

  const exampleInstruction = assignedExample
    ? `Utilise CET exemple réel, sans en changer les faits ni la source : "${assignedExample.description}" (source : ${assignedExample.sourceUrl}, "${assignedExample.sourceTitle}"). Mets isReal à true et recopie l'URL exactement.`
    : "Aucun exemple réel vérifié n'est disponible pour cette leçon : invente un exemple fictif ou une simulation clairement illustrative, mets isReal à false et laisse sourceUrl/sourceTitle à null. Ne présente jamais cet exemple comme réel.";

  // Transmis explicitement (correction de l'audit du Prompt 05.9) plutôt
  // que de ne dépendre que de leur lecture indirecte dans `outline`
  // ci-dessus : titre du module, SON objectif pédagogique, titre de la
  // leçon, et sa place dans la progression (numéro du module sur le
  // total, numéro de la leçon dans ce module sur le total de ce module).
  const moduleContext = `Module de cette leçon : "${plan.moduleTitle}" (module ${plan.moduleIndex + 1}/${plan.totalModules} de la formation).\nObjectif pédagogique de ce module : ${plan.moduleObjective}\nCette leçon est la ${plan.positionInModule + 1}ᵉ sur ${plan.chaptersInModule} de ce module.`;

  // Consigne de l'exercice facultatif (Prompt 05.11) : dans ce même appel,
  // jamais un appel IA séparé — voir `ChapterContentSchema.exercise`
  // (nullable) pour la garantie que rien n'impose un exercice artificiel.
  const exerciseInstruction =
    "Si, et UNIQUEMENT si, cette leçon s'y prête vraiment (une notion qu'on peut concrètement mettre en pratique), ajoute un exercice : une consigne claire posée à partir d'une situation concrète, et une correction détaillée qui explique le raisonnement, pas seulement la réponse. Si le sujet ne s'y prête pas (notion trop abstraite, trop courte, ou déjà entièrement couverte par l'exemple ci-dessus), laisse `exercise` à null plutôt que d'inventer un exercice artificiel.";

  return parseStructured(client, {
    system:
      "Tu es Tavyra, formatrice experte du sujet traité. Tu rédiges une leçon complète et pédagogique d'une formation structurée en modules, longue et dense. Règle absolue : la leçon parle CONCRÈTEMENT du sujet exact de la formation (ses notions, méthodes, outils, chiffres, étapes et cas propres à ce domaine) — jamais de généralités sur la motivation, la discipline ou la méthode d'apprentissage, sauf si c'est explicitement le sujet. Vise 1 200 à 2 000 mots : une explication approfondie, progressive et structurée en plusieurs sous-parties, qui distingue clairement l'essentiel du secondaire, simplifie toute notion complexe avec une analogie ou un contre-exemple quand c'est utile, utilise un tableau comparatif quand il apporte une vraie valeur, un exemple concret, un encadré à retenir, et un exercice pratique quand (et seulement quand) le sujet s'y prête. N'invente jamais un fait présenté comme réel. Écris comme un expert qui transmet un vrai savoir-faire : précis, actionnable, sans remplissage ni répétition.",
    user: `Formation : "${analysis.title}" (niveau ${analysis.level}).\nPlan complet de la formation, par module (pour situer cette leçon dans la progression globale, sans répéter ce que les autres modules couvrent) :\n${outline}\n\n${moduleContext}\n\nRédige la leçon : "${plan.title}".\nCette leçon doit couvrir : ${plan.summary}\nElle doit contribuer concrètement à l'objectif pédagogique du module rappelé ci-dessus, et enseigner des connaissances précises et directement utilisables sur le sujet de la formation (pas des conseils généraux). Elle doit apporter des connaissances NOUVELLES par rapport aux autres leçons de ce même module (vois leurs résumés dans le plan ci-dessus) : ne réexplique jamais ce qu'une autre leçon de ce module couvre déjà.\n\n${exampleInstruction}\n\n${exerciseInstruction}`,
    schema: ChapterContentSchema,
    maxTokens: 32000,
    effort: "low",
  });
}

// --- Étape 5 : résumé final ---

async function writeSummary(
  client: Anthropic,
  analysis: Analysis,
  programme: Programme,
  chapters: GeneratedChapter[],
): Promise<CourseSummary> {
  if (isOfflineAI()) return offlineSummary(analysis, chapters);
  const takeaways = chapters
    .map((c) => `- ${c.title} : ${c.keyTakeaway}`)
    .join("\n");

  return parseStructured(client, {
    system: "Tu es Tavyra. Tu rédiges le résumé final d'une formation à partir de ses points clés.",
    user: `Formation : "${analysis.title}".\nAngle du résumé : ${programme.summaryAngle}\n\nPoints à retenir de chaque chapitre :\n${takeaways}\n\nRédige un résumé final synthétique et les points essentiels de toute la formation.`,
    schema: CourseSummarySchema,
    maxTokens: 12000,
  });
}

// --- Validation stricte partagée des questions à 3 types (quiz final et de
// module) ---

/**
 * Validation stricte, question par question, de la sortie IA d'un quiz à
 * 3 types (final comme de module) — séparée des schémas `FinalQuizSchema`/
 * `ModuleQuizSchema` utilisés pour l'appel structuré (volontairement
 * permissifs, voir leurs commentaires dans schemas.ts). Une question qui
 * échoue ici est REJETÉE, jamais corrigée ni complétée : on ne fabrique
 * jamais une bonne réponse pour compenser une génération invalide.
 */
const StrictQuizQuestionSchema = z
  .object({
    questionType: z.enum(["single_choice", "multiple_choice", "true_false"]),
    question: z.string().min(1),
    choices: z.array(z.string().min(1)).min(2),
    correctChoiceIndex: z.number().int().nullable(),
    correctChoiceIndexes: z.array(z.number().int()).nullable(),
    explanation: z.string().min(1),
  })
  .superRefine((q, ctx) => {
    if (q.questionType === "true_false" && q.choices.length !== 2) {
      ctx.addIssue({ code: "custom", message: "true_false doit avoir exactement 2 choix" });
    }
    if (q.questionType === "multiple_choice") {
      const indexes = q.correctChoiceIndexes;
      if (!indexes || indexes.length === 0) {
        ctx.addIssue({ code: "custom", message: "correctChoiceIndexes requis pour multiple_choice" });
        return;
      }
      if (new Set(indexes).size !== indexes.length) {
        ctx.addIssue({ code: "custom", message: "correctChoiceIndexes contient des doublons" });
      }
      if (indexes.some((idx) => idx < 0 || idx >= q.choices.length)) {
        ctx.addIssue({ code: "custom", message: "correctChoiceIndexes hors limites" });
      }
    } else if (
      q.correctChoiceIndex === null ||
      q.correctChoiceIndex < 0 ||
      q.correctChoiceIndex >= q.choices.length
    ) {
      ctx.addIssue({ code: "custom", message: "correctChoiceIndex manquant ou hors limites" });
    }
  });

/**
 * Normalise un texte de question pour la comparaison anti-doublon
 * ci-dessous : minuscules, accents retirés, ponctuation réduite à des
 * espaces. Ne détecte que les doublons littéraux ou quasi littéraux
 * (reformulation triviale avec la même ponctuation/accentuation) — la
 * vraie garantie contre la répétition de notions est le prompt envoyé au
 * modèle (qui reçoit la liste des questions déjà posées), ce filtre n'est
 * qu'un filet de sécurité mécanique et vérifiable en plus.
 */
function normalizeQuestionText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// --- Étape 6 : quiz final (Prompt 05.8) ---

// Prompt 06.37 (suite) : réduit de 10 à 8 pour que le total de questions
// d'une formation (quiz de module + quiz final) reste proche de 20 au
// maximum (voir MODULE_QUIZ_QUESTION_COUNT plus bas) — coût de sortie
// Claude réduit en conséquence, sans vider le quiz final de son sens.
const QUESTION_COUNT = 8;

/**
 * Génère le quiz FINAL : une évaluation globale de toute la formation,
 * tenant compte des objectifs pédagogiques et des questions déjà posées
 * dans le(s) quiz de module (`moduleQuestions`) pour limiter les
 * répétitions. Les questions qui ne passent pas la validation stricte, ou
 * qui reprennent littéralement une question déjà posée dans un module,
 * sont écartées plutôt que corrigées.
 */
async function writeQuiz(
  client: Anthropic,
  analysis: Analysis,
  objectives: string[],
  chapters: GeneratedChapter[],
  moduleQuestions: QuizQuestion[],
): Promise<QuizQuestion[]> {
  if (isOfflineAI()) return offlineFinalQuiz();
  const fullContent = chapters
    .map(
      (c, i) =>
        `--- Chapitre ${i + 1} : ${c.title} ---\n${c.explanation}\n\nExemple : ${c.example.description}\n\nÀ retenir : ${c.keyTakeaway}`,
    )
    .join("\n\n");

  const objectivesList = objectives.map((o) => `- ${o}`).join("\n");

  const moduleQuestionsList =
    moduleQuestions.length > 0
      ? moduleQuestions.map((q) => `- ${q.question}`).join("\n")
      : "Aucune (aucun quiz de module n'a encore été généré pour cette formation).";

  const result = await parseStructured(client, {
    system:
      "Tu es Tavyra. Tu crées le quiz FINAL d'une formation : une évaluation globale qui doit couvrir l'ensemble des modules et des leçons, pas seulement les premiers. Règle absolue : chaque question, ses choix et sa bonne réponse doivent être vérifiables uniquement à partir du texte fourni — jamais une connaissance externe non enseignée dans ce texte, même si tu la connais par ailleurs. Privilégie des questions qui testent la compréhension, le raisonnement ou la capacité à appliquer une notion (mise en situation, comparaison, conséquence logique) plutôt que la pure mémorisation d'un fait isolé, tout en restant strictement dans les limites du contenu fourni. Choisis pour chaque question le type (single_choice, multiple_choice, true_false) le plus adapté, sans chercher à imposer une répartition fixe. Ne pose jamais une question déjà posée dans un quiz de module (liste fournie), ni une simple reformulation de celle-ci avec quelques mots changés : choisis un autre angle ou une autre notion du même contenu.",
    user: `Formation : "${analysis.title}" (niveau ${analysis.level}).\n\nObjectifs pédagogiques de la formation :\n${objectivesList}\n\nContenu complet de la formation :\n\n${fullContent}\n\nQuestions déjà posées dans un quiz de module (à NE PAS reposer, ni reformuler) :\n${moduleQuestionsList}\n\nGénère un quiz final de ${QUESTION_COUNT} questions qui couvre l'ensemble de la formation de façon équilibrée — chaque module/chapitre important doit être représenté, pas seulement les premiers. Pour "multiple_choice" : fournis TOUS les index corrects (0-based, au moins 2) dans correctChoiceIndexes et laisse correctChoiceIndex à null. Pour "single_choice" et "true_false" : fournis un seul index correct dans correctChoiceIndex et laisse correctChoiceIndexes à null (pour "true_false", exactement 2 choix). Donne pour chaque question une explication qui justifie la bonne réponse en te basant uniquement sur le texte ci-dessus, et indique l'index (0-based) du chapitre principalement concerné (ou null si la question porte sur plusieurs chapitres à la fois).`,
    schema: FinalQuizSchema,
    maxTokens: 16000,
  });

  const moduleQuestionTextSet = new Set(
    moduleQuestions.map((q) => normalizeQuestionText(q.question)),
  );

  const validQuestions: QuizQuestion[] = [];
  for (const raw of result.questions) {
    const parsed = StrictQuizQuestionSchema.safeParse(raw);
    if (!parsed.success) continue;
    if (moduleQuestionTextSet.has(normalizeQuestionText(parsed.data.question))) continue;
    const q = parsed.data;
    validQuestions.push({
      position: validQuestions.length,
      chapterIndex:
        raw.chapterIndex !== null && raw.chapterIndex >= 0 && raw.chapterIndex < chapters.length
          ? raw.chapterIndex
          : null,
      question: q.question,
      choices: q.choices,
      correctChoiceIndex: q.correctChoiceIndex ?? 0,
      correctChoiceIndexes: q.correctChoiceIndexes,
      questionType: q.questionType,
      explanation: q.explanation,
    });
  }
  return validQuestions;
}

// --- Étape 7 : quiz de module (Prompt 05.6) ---

// Prompt 06.37 (suite) : réduit de 5 à 3 — avec entre 2 et 4 modules
// (MIN_MODULE_COUNT/MAX_MODULE_COUNT), ça fait au plus 3×4 = 12 questions
// de module + 8 au quiz final (QUESTION_COUNT) = 20 au total dans le pire
// cas, contre jusqu'à 30 avant (5×4 + 10).
const MODULE_QUIZ_QUESTION_COUNT = 3;

/**
 * Génère le quiz d'UN module, à partir du contenu réel de ses seules leçons
 * (jamais celui des autres modules). Les questions qui ne passent pas la
 * validation stricte ci-dessus sont écartées plutôt que corrigées.
 */
async function writeModuleQuiz(
  client: Anthropic,
  analysis: Analysis,
  moduleTitle: string,
  moduleChapters: GeneratedChapter[],
): Promise<QuizQuestion[]> {
  if (isOfflineAI()) {
    const index = moduleTitle.startsWith("Mettre") ? 1 : moduleTitle.startsWith("Approfondir") ? 2 : 0;
    return offlineModuleQuiz(index);
  }
  const fullContent = moduleChapters
    .map(
      (c, i) =>
        `--- Leçon ${i + 1} : ${c.title} ---\n${c.explanation}\n\nExemple : ${c.example.description}\n\nÀ retenir : ${c.keyTakeaway}`,
    )
    .join("\n\n");

  const result = await parseStructured(client, {
    system:
      "Tu es Tavyra. Tu crées un quiz de validation des acquis pour UN SEUL module d'une formation, à partir du contenu RÉEL de ce module uniquement. Règle absolue : chaque question, ses choix et sa bonne réponse doivent être vérifiables uniquement à partir du texte fourni pour ce module — jamais à partir d'une connaissance externe, même correcte, et jamais à partir du contenu d'un autre module. Choisis pour chaque question le type (single_choice, multiple_choice, true_false) le plus adapté à la notion testée, sans chercher à imposer une répartition fixe entre les types. Évite les questions génériques, répétitives entre elles, ou qui ne testent rien de spécifique à ce module.",
    user: `Formation : "${analysis.title}" (niveau ${analysis.level}).\nModule : "${moduleTitle}".\n\nContenu complet de ce module :\n\n${fullContent}\n\nGénère un quiz de ${MODULE_QUIZ_QUESTION_COUNT} questions portant UNIQUEMENT sur ce module, couvrant ses différentes leçons de façon équilibrée. Pour "multiple_choice" : fournis TOUS les index corrects (0-based, au moins 2) dans correctChoiceIndexes et laisse correctChoiceIndex à null. Pour "single_choice" et "true_false" : fournis un seul index correct dans correctChoiceIndex et laisse correctChoiceIndexes à null (pour "true_false", exactement 2 choix, ex. "Vrai"/"Faux"). Donne pour chaque question une explication qui justifie la bonne réponse en te basant uniquement sur le texte ci-dessus.`,
    schema: ModuleQuizSchema,
    maxTokens: 12000,
  });

  const validQuestions: QuizQuestion[] = [];
  for (const raw of result.questions) {
    const parsed = StrictQuizQuestionSchema.safeParse(raw);
    if (!parsed.success) continue;
    const q = parsed.data;
    validQuestions.push({
      position: validQuestions.length,
      chapterIndex: null,
      question: q.question,
      choices: q.choices,
      // Colonne historiquement NOT NULL (0002) : placeholder non significatif
      // pour multiple_choice, où la bonne réponse est dans
      // correctChoiceIndexes — jamais lu par submit_quiz_attempt dans ce cas.
      correctChoiceIndex: q.correctChoiceIndex ?? 0,
      correctChoiceIndexes: q.correctChoiceIndexes,
      questionType: q.questionType,
      explanation: q.explanation,
    });
  }
  return validQuestions;
}

// --- Orchestration complète ---

export type CoursePlan = {
  analysis: Analysis;
  verifiedExamples: VerifiedExample[];
  programme: Programme;
  estimatedMinutes: number;
};

/**
 * Étapes "analyse → recherche → programme" (Prompt 05.18.1) : construit le
 * PLAN d'une formation (modules, leçons, objectifs) sans jamais rédiger le
 * contenu des leçons ni consommer de réservation de quota — ces appels sont
 * nettement moins coûteux que la rédaction complète, et peuvent être
 * relancés (ajustement du plan) sans jamais toucher au quota de
 * génération. `diagnosticAnswers`/`adjustmentRequest` sont facultatifs :
 * absents, le plan produit est identique à celui du parcours "configuration
 * rapide" (`generateCourse` ci-dessous), qui appelle cette même fonction
 * sans rien y ajouter.
 */
export async function buildCoursePlan(
  client: Anthropic,
  topic: string,
  options?: {
    diagnosticAnswers?: DiagnosticAnswer[];
    adjustmentRequest?: string;
    /** Ré-utilise une analyse déjà faite plutôt que d'en refaire une — pour une simple demande d'ajustement du plan, qui ne change ni le domaine ni le niveau déjà déterminés. */
    previousAnalysis?: Analysis;
    previousVerifiedExamples?: VerifiedExample[];
    previousProgramme?: Programme;
    onProgress?: Progress;
  },
): Promise<CoursePlan> {
  const onProgress = options?.onProgress ?? (() => {});

  let analysis: Analysis;
  let verifiedExamples: VerifiedExample[];

  if (options?.previousAnalysis) {
    // Demande d'ajustement sur un plan déjà construit : on ne refait pas
    // l'analyse ni la recherche d'exemples, seulement le programme — plus
    // rapide, et évite de changer le domaine/niveau déjà déterminés pour
    // un simple ajustement du plan.
    analysis = options.previousAnalysis;
    verifiedExamples = options.previousVerifiedExamples ?? [];
  } else {
    onProgress("analyse", STAGE_LABELS.analyse);
    analysis = await analyzeTopic(client, topic, options?.diagnosticAnswers);

    onProgress("recherche", STAGE_LABELS.recherche);
    verifiedExamples = [];
    // Recherche web : plusieurs tours de recherche dans la même requête que
    // l'analyse et le programme dépassaient la durée maximale des fonctions
    // Netlify (page d'erreur HTML côté navigateur). Désactivée par défaut,
    // réactivable avec TAVYRA_WEB_RESEARCH=1.
    if (analysis.usesRealWorldExamples && process.env.TAVYRA_WEB_RESEARCH === "1") {
      const { findings, realSources } = await searchRealExamples(client, analysis);
      verifiedExamples = await extractVerifiedExamples(client, analysis, findings, realSources);
    }
  }

  onProgress("programme", STAGE_LABELS.programme);
  const programme = await buildProgramme(
    client,
    analysis,
    verifiedExamples,
    options?.diagnosticAnswers,
    options?.adjustmentRequest,
    options?.previousProgramme,
  );

  return {
    analysis,
    verifiedExamples,
    programme,
    estimatedMinutes: estimateCourseDurationMinutes(programme),
  };
}

/**
 * Étapes "chapitres → résumé/quiz" (Prompt 05.18.1) : rédige le contenu
 * complet à partir d'un plan déjà construit (et éventuellement modifié par
 * l'utilisateur) — jamais appelée sans réservation de quota déjà validée
 * par l'appelant (voir route.ts). `validateProgrammeStructure` doit avoir
 * déjà été vérifiée par l'appelant sur `programme` avant cet appel (un plan
 * édité à la main par l'utilisateur peut ne plus respecter les bornes :
 * cette fonction ne revérifie pas elle-même, exactement comme avant cette
 * évolution — c'est `buildProgramme` qui vérifiait déjà la structure QU'IL
 * venait de produire, jamais celle d'un appelant).
 */
export async function generateCourseFromPlan(
  client: Anthropic,
  topic: string,
  analysis: Analysis,
  verifiedExamples: VerifiedExample[],
  programme: Programme,
  onProgress: Progress,
): Promise<GeneratedCourse> {
  onProgress("chapitres", STAGE_LABELS.chapitres);
  const flatPlans = flattenModulePlans(programme.modules);
  const totalChapters = flatPlans.length;
  let completedChapters = 0;

  // Un seul limiteur partagé pour TOUTE cette génération (leçons, quiz de
  // module, résumé) : au plus `MAX_CONCURRENT_AI_CALLS` appels IA en vol en
  // même temps, quel que soit le nombre de modules/leçons — protège contre
  // une limite de débit côté API et borne le coût instantané. Les leçons
  // restent rédigées en parallèle (latence), seulement plafonnées.
  const limiter = new ConcurrencyLimiter(MAX_CONCURRENT_AI_CALLS);

  const chapters: GeneratedChapter[] = await Promise.all(
    flatPlans.map(async (plan) => {
      const assignedExample =
        plan.exampleIndex !== null ? verifiedExamples[plan.exampleIndex] ?? null : null;

      const content = await limiter.run(() =>
        writeChapter(client, analysis, programme.modules, plan, assignedExample),
      );

      // Validation légère AVANT tout autre traitement de cette leçon
      // (Prompt 05.11) : un contenu invalide fait échouer cette tâche, qui
      // se propage normalement via `Promise.all` — aucune sauvegarde,
      // réservation libérée par route.ts, exactement comme toute autre
      // erreur de génération (principe "tout ou rien" préservé).
      const chapterErrors = validateChapterContent(content, plan);
      if (chapterErrors.length > 0) {
        throw new CourseGenerationError(
          `Contenu de leçon invalide : ${chapterErrors.join(" ")}`,
        );
      }

      completedChapters += 1;
      onProgress(
        "chapitres",
        `${STAGE_LABELS.chapitres} (${completedChapters}/${totalChapters})`,
      );

      // Deuxième filet de sécurité : si le modèle prétend "réel" sans fournir
      // une source qui corresponde à un exemple vérifié, on force le fictif.
      const claimedUrl = content.example.sourceUrl?.trim().replace(/\/$/, "") ?? null;
      const matchesVerified =
        claimedUrl !== null &&
        verifiedExamples.some((e) => e.sourceUrl.trim().replace(/\/$/, "") === claimedUrl);
      const isReal = content.example.isReal && matchesVerified;

      return {
        position: plan.globalIndex,
        title: plan.title,
        explanation: content.explanation,
        keyTakeaway: content.keyTakeaway,
        example: {
          isReal,
          description: content.example.description,
          sourceUrl: isReal ? content.example.sourceUrl : null,
          sourceTitle: isReal ? content.example.sourceTitle : null,
        },
        exercise: content.exercise
          ? { prompt: content.exercise.prompt, solution: content.exercise.solution }
          : null,
      };
    }),
  );

  // Chapitres déjà écrits regroupés par module d'origine (même ordre que
  // `programme.modules`), calculé une seule fois et réutilisé ci-dessous
  // pour générer chaque quiz de module puis construire `modules`.
  const chaptersByModule: GeneratedChapter[][] = programme.modules.map((_, moduleIndex) =>
    chapters.filter((_, i) => flatPlans[i].moduleIndex === moduleIndex),
  );

  // Résumé (sur l'ensemble de la formation) et quiz de CHAQUE module sont
  // tous indépendants les uns des autres (ne dépendent que des chapitres
  // déjà écrits) : les lancer en parallèle évite d'ajouter leurs latences
  // les unes aux autres, qu'il y ait 1 ou 4 modules. `writeModuleQuiz`
  // (inchangée, voir Prompt 05.6) est simplement appelée une fois par
  // module réel plutôt qu'une seule fois sur l'unique module d'avant —
  // chaque appel ne reçoit que le contenu de SON module, jamais celui des
  // autres, exactement comme son fonctionnement l'a toujours garanti.
  const [summary, moduleQuizResults] = await Promise.all([
    limiter.run(() => writeSummary(client, analysis, programme, chapters)),
    Promise.all(
      programme.modules.map((m, moduleIndex) =>
        limiter.run(() => writeModuleQuiz(client, analysis, m.title, chaptersByModule[moduleIndex])),
      ),
    ),
  ]);

  const modules: GeneratedModule[] = programme.modules.map((m, moduleIndex) => ({
    position: moduleIndex,
    title: m.title,
    chapters: chaptersByModule[moduleIndex],
    quiz: moduleQuizResults[moduleIndex],
  }));

  // Le quiz final est généré APRÈS le(s) quiz de module (Prompt 05.8), et
  // non en parallèle : il a besoin de connaître les questions déjà posées
  // dans CHACUN d'eux pour éviter de les reposer. Ce séquencement ajoute
  // une latence (un aller-retour IA de plus), coût accepté pour garantir
  // une réelle non-répétition plutôt qu'un simple filtrage a posteriori
  // sans contexte.
  const allModuleQuestions = moduleQuizResults.flat();
  const quiz = await writeQuiz(
    client,
    analysis,
    programme.objectives,
    chapters,
    allModuleQuestions,
  );

  onProgress("pret", STAGE_LABELS.pret);

  return {
    topic,
    title: analysis.title,
    domain: analysis.domain,
    level: analysis.level,
    introduction: programme.introduction,
    objectives: programme.objectives,
    chapters,
    modules,
    summary: summary.summary,
    keyPoints: summary.keyPoints,
    quiz,
  };
}

/**
 * Parcours "configuration rapide" (comportement strictement inchangé
 * depuis avant le Prompt 05.18.1) : construit le plan puis rédige la
 * formation complète en un seul appel, sans diagnostic ni validation
 * intermédiaire du plan par l'utilisateur.
 */
export async function generateCourse(
  topic: string,
  onProgress: Progress,
): Promise<GeneratedCourse> {
  const client = createAnthropicClient();
  const { analysis, verifiedExamples, programme } = await buildCoursePlan(client, topic, {
    onProgress,
  });
  return generateCourseFromPlan(client, topic, analysis, verifiedExamples, programme, onProgress);
}

// --- Architecture à étapes courtes (Prompt 05.20.1) ---
//
// `generateCourseFromPlan` ci-dessus reste utilisée par rien d'autre que
// de futurs appels directs éventuels : la rédaction complète d'une
// formation (jusqu'à 20 leçons + jusqu'à 4 quiz de module + un résumé + un
// quiz final, soit jusqu'à 26 appels Anthropic) ne doit plus jamais tenir
// dans une seule requête HTTP (risque de dépasser la limite réelle des
// fonctions Netlify synchrones, voir l'audit 05.19/05.20). Les fonctions
// ci-dessous réutilisent EXACTEMENT les mêmes fonctions privées de
// rédaction (writeChapter, writeSummary, writeModuleQuiz, writeQuiz) et
// les mêmes vérifications (validateChapterContent, flattenModulePlans),
// mais exécutent une seule unité de travail à la fois, à partir d'une
// progression persistée côté Supabase (generation_progress,
// 0023_generation_progress.sql) plutôt que de tout garder en mémoire d'une
// requête à l'autre.

export type CourseStepInput = {
  topic: string;
  analysis: Analysis;
  verifiedExamples: VerifiedExample[];
  programme: Programme;
};

/**
 * Forme exacte de `generation_progress.progress` pour une formation —
 * validée par `CourseStepProgressSchema` (progress-schemas.ts) avant toute
 * lecture/écriture : jamais interprétée sans validation, même si elle
 * provient de notre propre base. Les clés de `chapters`/`moduleQuizzes`
 * sont des index numériques encodés en texte (contrainte de jsonb).
 */
export type CourseStepProgress = {
  stage: GenerationStage;
  chapters: Record<string, GeneratedChapter>;
  moduleQuizzes: Record<string, QuizQuestion[]>;
  summary?: CourseSummary;
  finalQuiz?: QuizQuestion[];
};

export const EMPTY_COURSE_PROGRESS: CourseStepProgress = {
  stage: "chapitres",
  chapters: {},
  moduleQuizzes: {},
};

export type CourseStepUnit =
  | { kind: "chapter"; globalIndex: number }
  | { kind: "moduleQuiz"; moduleIndex: number }
  | { kind: "summary" }
  | { kind: "finalQuiz" }
  | { kind: "assemble" }
  | { kind: "done" };

function sortedChaptersFromProgress(
  progress: CourseStepProgress,
  totalChapters: number,
): GeneratedChapter[] {
  const result: GeneratedChapter[] = [];
  for (let i = 0; i < totalChapters; i++) {
    const chapter = progress.chapters[String(i)];
    if (!chapter) {
      throw new CourseGenerationError(
        "Progression de génération incohérente : chapitre manquant pour assembler la suite.",
      );
    }
    result.push(chapter);
  }
  return result;
}

/**
 * Détermine la PROCHAINE unité de travail à partir de la progression
 * actuelle — jamais à partir d'un compteur transmis par le client, toujours
 * recalculée à partir de ce qui est RÉELLEMENT déjà présent dans
 * `progress`. Deux appels avec la même progression renvoient toujours la
 * même unité : c'est cette propriété qui rend chaque étape idempotente
 * (rejouer un appel qui a échoué AVANT d'avoir committé son résultat
 * redemande exactement la même chose, jamais la suivante).
 */
export function decideNextCourseStep(
  input: CourseStepInput,
  progress: CourseStepProgress,
): CourseStepUnit {
  const flatPlans = flattenModulePlans(input.programme.modules);
  for (const plan of flatPlans) {
    if (!(String(plan.globalIndex) in progress.chapters)) {
      return { kind: "chapter", globalIndex: plan.globalIndex };
    }
  }
  if (!progress.summary) return { kind: "summary" };
  for (let i = 0; i < input.programme.modules.length; i++) {
    if (!(String(i) in progress.moduleQuizzes)) return { kind: "moduleQuiz", moduleIndex: i };
  }
  if (!progress.finalQuiz) return { kind: "finalQuiz" };
  return { kind: "assemble" };
}

/** Étiquette de progression affichable (réutilise STAGE_LABELS) pour une unité donnée. */
export function stageForCourseUnit(unit: CourseStepUnit): GenerationStage {
  switch (unit.kind) {
    case "chapter":
      return "chapitres";
    case "summary":
    case "moduleQuiz":
      return "finition";
    case "finalQuiz":
      return "quizFinal";
    case "assemble":
    case "done":
      return "assemblage";
  }
}

/**
 * Exécute UNE unité de travail (un seul appel Anthropic dans la grande
 * majorité des cas) et renvoie le PATCH à committer — jamais la
 * progression complète : `commit_generation_step` (RPC) remplace
 * seulement les clés présentes dans ce patch, l'appelant (route.ts) doit
 * donc y inclure la valeur ENTIÈRE souhaitée pour chaque clé modifiée
 * (ex. la carte complète des chapitres, pas seulement le nouveau).
 */
export async function performCourseStepUnit(
  client: Anthropic,
  input: CourseStepInput,
  progress: CourseStepProgress,
  unit: CourseStepUnit,
): Promise<Partial<CourseStepProgress>> {
  const flatPlans = flattenModulePlans(input.programme.modules);
  const totalChapters = flatPlans.length;

  if (unit.kind === "chapter") {
    const plan = flatPlans[unit.globalIndex];
    const assignedExample =
      plan.exampleIndex !== null ? input.verifiedExamples[plan.exampleIndex] ?? null : null;

    const content = await writeChapter(
      client,
      input.analysis,
      input.programme.modules,
      plan,
      assignedExample,
    );

    const chapterErrors = validateChapterContent(content, plan);
    if (chapterErrors.length > 0) {
      throw new CourseGenerationError(`Contenu de leçon invalide : ${chapterErrors.join(" ")}`);
    }

    const claimedUrl = content.example.sourceUrl?.trim().replace(/\/$/, "") ?? null;
    const matchesVerified =
      claimedUrl !== null &&
      input.verifiedExamples.some((e) => e.sourceUrl.trim().replace(/\/$/, "") === claimedUrl);
    const isReal = content.example.isReal && matchesVerified;

    const chapter: GeneratedChapter = {
      position: plan.globalIndex,
      title: plan.title,
      explanation: content.explanation,
      keyTakeaway: content.keyTakeaway,
      example: {
        isReal,
        description: content.example.description,
        sourceUrl: isReal ? content.example.sourceUrl : null,
        sourceTitle: isReal ? content.example.sourceTitle : null,
      },
      exercise: content.exercise
        ? { prompt: content.exercise.prompt, solution: content.exercise.solution }
        : null,
    };

    return { chapters: { ...progress.chapters, [String(unit.globalIndex)]: chapter } };
  }

  if (unit.kind === "summary") {
    const chapters = sortedChaptersFromProgress(progress, totalChapters);
    const summary = await writeSummary(client, input.analysis, input.programme, chapters);
    return { summary };
  }

  if (unit.kind === "moduleQuiz") {
    const chapters = sortedChaptersFromProgress(progress, totalChapters);
    const moduleChapters = chapters.filter(
      (_, i) => flatPlans[i].moduleIndex === unit.moduleIndex,
    );
    const moduleTitle = input.programme.modules[unit.moduleIndex].title;
    const quiz = await writeModuleQuiz(client, input.analysis, moduleTitle, moduleChapters);
    return { moduleQuizzes: { ...progress.moduleQuizzes, [String(unit.moduleIndex)]: quiz } };
  }

  if (unit.kind === "finalQuiz") {
    const chapters = sortedChaptersFromProgress(progress, totalChapters);
    const allModuleQuestions = Object.values(progress.moduleQuizzes).flat();
    const quiz = await writeQuiz(
      client,
      input.analysis,
      input.programme.objectives,
      chapters,
      allModuleQuestions,
    );
    return { finalQuiz: quiz };
  }

  // "assemble" et "done" ne produisent aucun patch : assembleCourseFromProgress
  // (ci-dessous) et la sauvegarde atomique s'en chargent, hors de cette fonction.
  return {};
}

/**
 * Reconstruit la `GeneratedCourse` complète une fois toutes les unités de
 * travail terminées — jamais appelée avant que `decideNextCourseStep` ne
 * renvoie `{ kind: "assemble" }`, qui garantit que chapters/summary/
 * moduleQuizzes/finalQuiz sont tous présents.
 */
export function assembleCourseFromProgress(
  input: CourseStepInput,
  progress: CourseStepProgress,
): GeneratedCourse {
  const flatPlans = flattenModulePlans(input.programme.modules);
  const chapters = sortedChaptersFromProgress(progress, flatPlans.length);
  if (!progress.summary) {
    throw new CourseGenerationError("Progression de génération incohérente : résumé manquant.");
  }

  const chaptersByModule: GeneratedChapter[][] = input.programme.modules.map((_, moduleIndex) =>
    chapters.filter((_, i) => flatPlans[i].moduleIndex === moduleIndex),
  );
  const modules: GeneratedModule[] = input.programme.modules.map((m, moduleIndex) => ({
    position: moduleIndex,
    title: m.title,
    chapters: chaptersByModule[moduleIndex],
    quiz: progress.moduleQuizzes[String(moduleIndex)] ?? [],
  }));

  return {
    topic: input.topic,
    title: input.analysis.title,
    domain: input.analysis.domain,
    level: input.analysis.level,
    introduction: input.programme.introduction,
    objectives: input.programme.objectives,
    chapters,
    modules,
    summary: progress.summary.summary,
    keyPoints: progress.summary.keyPoints,
    quiz: progress.finalQuiz ?? [],
  };
}
