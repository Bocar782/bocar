import { isOfflineAI } from "@/lib/courses/offline";
import { offlineBrief, offlineCases, offlineSection, offlineSynthesis } from "./offline";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import {
  AnalysisBriefSchema,
  CaseExtractionSchema,
  DeepSectionSchema,
  DeepSynthesisSchema,
  type AnalysisBrief,
  type DeepAnalysisSection,
  type DeepAnalysisSource,
  type DeepAnalysisStage,
  type GeneratedDeepAnalysis,
  type VerifiedCase,
} from "./schemas";

const MODEL = "claude-sonnet-5-5";
const MIN_VERIFIED_CASES = 3;

export class AnalysisGenerationError extends Error {}

function requireContent<T extends { stop_reason: string | null }>(response: T): T {
  if (response.stop_reason === "refusal") {
    throw new AnalysisGenerationError(
      "L'analyse a été refusée par le modèle pour ce sujet.",
    );
  }
  if (response.stop_reason === "max_tokens") {
    throw new AnalysisGenerationError(
      "Réponse tronquée (max_tokens atteint) : réessaie ou reformule le sujet.",
    );
  }
  return response;
}

async function parseStructured<Schema extends z.ZodType>(
  client: Anthropic,
  args: { system: string; user: string; schema: Schema; maxTokens: number },
): Promise<z.infer<Schema>> {
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: args.maxTokens,
    system: args.system,
    messages: [{ role: "user", content: args.user }],
    output_config: { format: zodOutputFormat(args.schema) },
  });
  requireContent(response);
  if (!response.parsed_output) {
    throw new AnalysisGenerationError("Réponse du modèle non conforme au format attendu.");
  }
  return response.parsed_output;
}

// --- Étape 1 : cadrage ---

async function scopeAnalysis(client: Anthropic, topic: string): Promise<AnalysisBrief> {
  if (isOfflineAI()) return offlineBrief(topic);
  const result = await parseStructured(client, {
    system:
      "Tu es Tavyra, analyste pédagogique spécialisée dans l'étude de cas réels : parcours d'entrepreneurs, d'entreprises, d'investisseurs, stratégies, réussites et échecs. Tu cadres une demande d'analyse approfondie avant la phase de recherche. Ton rôle est de préparer une vraie recherche structurée, pas une simple reformulation du sujet.",
    user: `Sujet demandé : "${topic}"\n\nCadre cette analyse approfondie. Choisis un nombre de cas réels à analyser entre 4 et 7 selon la richesse du sujet. Prépare 4 à 6 requêtes de recherche web distinctes et complémentaires (par exemple : succès notables, échecs notables, stratégies spécifiques, données chiffrées ou études) pour rassembler des cas réels variés et pertinents, pas uniquement des success stories.`,
    schema: AnalysisBriefSchema,
    maxTokens: 2048,
  });

  return { ...result, caseCount: Math.min(7, Math.max(4, Math.round(result.caseCount))) };
}

// --- Étape 2 : recherche web de cas réels ---
//
// Prompt 05.20.2 : un tour de recherche serveur (web_search) peut s'arrêter
// sur `pause_turn` et nécessiter plusieurs reprises (jusqu'à 5, voir
// commentaire plus bas) — enchaîner ces reprises en boucle à l'intérieur
// d'UN SEUL appel de fonction violerait le principe central de
// l'architecture à étapes courtes (un appel Anthropic au maximum par étape
// HTTP) et créerait le risque de dépassement de durée Netlify le plus
// concret de tout le pipeline. `performResearchTurn` fait donc EXACTEMENT
// UN appel `client.messages.create` et renvoie un état sérialisable
// (`ResearchTurnState`) que l'appelant persiste dans `progress.research`
// entre deux requêtes HTTP ; `decideNextAnalysisStep` redemande une
// nouvelle "research_turn" jusqu'à ce que `done` soit vrai.
export type ResearchTurnState = {
  // Typé `unknown[]` ici (plutôt que `Anthropic.MessageParam[]`) car ce
  // champ traverse une sérialisation jsonb puis une revalidation Zod
  // volontairement peu stricte (voir progress-schemas.ts) : sa forme
  // exacte n'est jamais interprétée ni affichée, seulement reproduite telle
  // quelle vers `client.messages.create` au tour suivant.
  messages: unknown[];
  resumes: number;
  findings: string;
  realSources: { url: string; title: string }[];
  done: boolean;
};

async function performResearchTurn(
  client: Anthropic,
  brief: AnalysisBrief,
  state: ResearchTurnState | undefined,
): Promise<ResearchTurnState> {
  if (isOfflineAI()) return { messages: [], resumes: 0, findings: "", realSources: [], done: true };
  const system =
    "Tu es Tavyra, chargée de rassembler des cas réels et vérifiables (parcours d'entrepreneurs, entreprises, investisseurs, stratégies, réussites, échecs, événements, données) disponibles publiquement, en lien avec un sujet donné. Utilise l'outil de recherche web pour mener PLUSIEURS recherches distinctes couvrant différents angles (succès, échecs, stratégies, données). Vérifie chaque fait par une recherche avant de l'avancer. N'affirme jamais qu'un cas est réel sans l'avoir confirmé par une recherche.";
  const tools = [
    { type: "web_search_20260209" as const, name: "web_search" as const, max_uses: 14 },
  ];

  let messages: Anthropic.MessageParam[];
  let resumes: number;
  let findingsSoFar: string;
  let realSourcesSoFar: { url: string; title: string }[];

  if (!state) {
    const queriesList = brief.searchQueries.map((q) => `- ${q}`).join("\n");
    const user = `Sujet : "${brief.title}" (domaine : ${brief.domain}).\nAngle de recherche : ${brief.researchAngle}\n\nMène des recherches web sur CHACUNE des requêtes suivantes, et d'autres si besoin pour compléter :\n${queriesList}\n\nRassemble au moins ${brief.caseCount + 2} cas réels et vérifiables (personnes, entreprises, événements), en couvrant à la fois des réussites ET des échecs ou situations mitigées — pas uniquement des success stories. Pour chacun : vérifie les faits par la recherche, résume ce qui s'est passé et pourquoi, et cite explicitement l'URL exacte de ta source.`;
    messages = [{ role: "user", content: user }];
    resumes = 0;
    findingsSoFar = "";
    realSourcesSoFar = [];
  } else {
    // `state.messages` est typé `unknown[]` au repos (voir ResearchTurnState) ;
    // il n'a jamais été produit ou modifié que par CE code (persisté tel
    // quel par commit_generation_step), donc le recast vers le type SDK
    // exact à chaque reprise est sûr.
    messages = state.messages as Anthropic.MessageParam[];
    resumes = state.resumes + 1;
    findingsSoFar = state.findings;
    realSourcesSoFar = state.realSources;
  }

  const response = requireContent(
    await client.messages.create({ model: MODEL, max_tokens: 16000, system, messages, tools }),
  );

  const newMessages: Anthropic.MessageParam[] = [
    ...messages,
    { role: "assistant", content: response.content },
  ];

  // Chaque reprise ne renvoie QUE la continuation de ce tour (pas de
  // répétition du texte/des résultats déjà vus) : on accumule au lieu de
  // ne garder que la dernière réponse, sans quoi les sources trouvées lors
  // des tours intermédiaires seraient perdues.
  const newText = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n\n");
  const findings = newText ? [findingsSoFar, newText].filter(Boolean).join("\n\n") : findingsSoFar;

  const realSources = [...realSourcesSoFar];
  for (const block of response.content) {
    if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
      for (const item of block.content) {
        if (item.type === "web_search_result" && item.url) {
          realSources.push({ url: item.url, title: item.title ?? item.url });
        }
      }
    }
  }

  // Une analyse approfondie mène plus de recherches qu'une formation
  // classique, donc on autorise davantage de reprises (5) avant de forcer
  // l'arrêt même si le modèle demande encore à continuer.
  const done = response.stop_reason !== "pause_turn" || resumes >= 5;

  return { messages: newMessages, resumes, findings, realSources, done };
}

async function extractVerifiedCases(
  client: Anthropic,
  brief: AnalysisBrief,
  findings: string,
  realSources: { url: string; title: string }[],
): Promise<VerifiedCase[]> {
  if (isOfflineAI()) return offlineCases(brief);
  if (realSources.length === 0) return [];

  const sourceList = realSources.map((s) => `- ${s.url} (${s.title})`).join("\n");

  const result = await parseStructured(client, {
    system:
      "Tu extrais des cas réels et vérifiés à partir de notes de recherche. Pour chaque cas, l'URL source doit être copiée EXACTEMENT depuis la liste fournie — jamais inventée, jamais modifiée.",
    user: `Sujet : "${brief.title}"\n\nNotes de recherche :\n${findings}\n\nSources réellement trouvées (copie l'URL exactement) :\n${sourceList}\n\nExtrais la liste des cas réels et vérifiés (personnes, entreprises, événements), avec leur résultat (succès, échec ou mixte) et leur source exacte tirée de la liste ci-dessus. Ne garde que des cas distincts et substantiels.`,
    schema: CaseExtractionSchema,
    maxTokens: 8000,
  });

  const realUrlSet = new Set(realSources.map((s) => s.url.trim().replace(/\/$/, "")));
  // Filet de sécurité anti-hallucination : un cas dont l'URL ne correspond à
  // aucune source réellement trouvée est écarté.
  return result.cases.filter((c) => realUrlSet.has(c.sourceUrl.trim().replace(/\/$/, "")));
}

// --- Étape 3 : rédaction d'une section par cas ---

async function writeSection(
  client: Anthropic,
  brief: AnalysisBrief,
  verifiedCase: VerifiedCase,
  otherCases: VerifiedCase[],
): Promise<z.infer<typeof DeepSectionSchema>> {
  if (isOfflineAI()) return offlineSection(brief, verifiedCase);
  const context =
    otherCases.length > 0
      ? `Autres cas traités ailleurs dans cette analyse (pour ne pas te répéter, sans devoir les développer) :\n${otherCases.map((c) => `- ${c.name} (${c.outcome})`).join("\n")}`
      : "";

  return parseStructured(client, {
    system:
      "Tu es Tavyra, analyste pédagogique. Tu rédiges une section d'analyse approfondie et rigoureuse sur un cas réel précis : contexte, décisions clés, explication causale de la réussite ou de l'échec, et enseignements concrets. N'invente jamais un fait : base-toi uniquement sur le résumé de recherche fourni. Ce contenu doit être nettement plus long, plus développé et plus analytique qu'un simple chapitre introductif.",
    user: `Analyse approfondie : "${brief.title}" (domaine : ${brief.domain}).\n\nCas à analyser : ${verifiedCase.name}.\nRésultat : ${verifiedCase.outcome}.\nRésumé de recherche (base factuelle, ne pas aller au-delà) : ${verifiedCase.summary}\nSource : ${verifiedCase.sourceUrl} ("${verifiedCase.sourceTitle}")\n\n${context}\n\nRédige une analyse approfondie de ce cas : contexte, ce qui s'est passé, la stratégie ou les décisions clés, pourquoi ça a réussi ou échoué (explications causales concrètes, pas de généralités vagues), et enseignements transférables à d'autres situations.`,
    schema: DeepSectionSchema,
    maxTokens: 24000,
  });
}

// --- Étape 4 : synthèse finale ---

async function writeSynthesis(
  client: Anthropic,
  brief: AnalysisBrief,
  sections: DeepAnalysisSection[],
): Promise<z.infer<typeof DeepSynthesisSchema>> {
  if (isOfflineAI()) return offlineSynthesis();
  const casesOverview = sections
    .map((s) => `- ${s.name} (${s.outcome}) : ${s.lessons.join(" / ")}`)
    .join("\n");

  return parseStructured(client, {
    system:
      "Tu es Tavyra. Tu rédiges la synthèse pédagogique finale d'une analyse approfondie, en identifiant les motifs récurrents entre plusieurs cas réels analysés — ce qui distingue les réussites des échecs, et les enseignements transversaux applicables au-delà des cas précis.",
    user: `Analyse : "${brief.title}" (domaine : ${brief.domain}).\n\nCas analysés et leurs enseignements :\n${casesOverview}\n\nRédige une synthèse pédagogique transversale : quels motifs reviennent entre ces cas, qu'est-ce qui distingue ceux qui ont réussi de ceux qui ont échoué, et quels enseignements clés en tirer, applicables au-delà de ces cas précis.`,
    schema: DeepSynthesisSchema,
    maxTokens: 8000,
  });
}

// --- Architecture à étapes courtes (Prompt 05.20.1 puis 05.20.2) ---
//
// Même principe que pour les formations (voir generate.ts,
// performCourseStepUnit) : une analyse complète (cadrage + recherche +
// jusqu'à 7 sections + synthèse, chacune un aller-retour IA potentiellement
// long) ne doit jamais tenir dans une seule requête HTTP. Les fonctions
// ci-dessous réutilisent les mêmes fonctions privées (scopeAnalysis,
// performResearchTurn, extractVerifiedCases, writeSection, writeSynthesis),
// une seule unité de travail — donc au plus UN appel Anthropic — à la fois,
// à partir d'une progression persistée côté Supabase (generation_progress).
// Il n'existe plus de pipeline "tout en un" équivalent : le découpage en
// étapes courtes est désormais le seul chemin de génération d'analyse.

export type AnalysisStepInput = { topic: string };

export type AnalysisStepProgress = {
  stage: DeepAnalysisStage;
  brief?: AnalysisBrief;
  // Prompt 05.20.2 : état du tour de recherche en cours, persisté entre
  // deux requêtes HTTP successives tant que `done` est faux — voir
  // `performResearchTurn` ci-dessus pour le détail de ce découpage.
  research?: ResearchTurnState;
  verifiedCases?: VerifiedCase[];
  sections: Record<string, DeepAnalysisSection>;
  synthesis?: { synthesis: string; keyLessons: string[] };
};

export const EMPTY_ANALYSIS_PROGRESS: AnalysisStepProgress = {
  stage: "cadrage",
  sections: {},
};

export type AnalysisStepUnit =
  | { kind: "cadrage" }
  | { kind: "research_turn" }
  | { kind: "extract" }
  | { kind: "section"; index: number }
  | { kind: "synthese" }
  | { kind: "assemble" }
  | { kind: "done" };

/**
 * Détermine la PROCHAINE unité de travail à partir de la progression
 * actuelle, jamais d'un compteur transmis par le client — même principe
 * d'idempotence que `decideNextCourseStep`. La recherche web est elle-même
 * décomposée en autant de "research_turn" que nécessaire (un appel
 * Anthropic chacun) avant l'extraction finale des cas vérifiés.
 */
export function decideNextAnalysisStep(
  progress: AnalysisStepProgress,
): AnalysisStepUnit {
  if (!progress.brief) return { kind: "cadrage" };
  if (!progress.verifiedCases) {
    if (!progress.research?.done) return { kind: "research_turn" };
    return { kind: "extract" };
  }
  for (let i = 0; i < progress.verifiedCases.length; i++) {
    if (!(String(i) in progress.sections)) return { kind: "section", index: i };
  }
  if (!progress.synthesis) return { kind: "synthese" };
  return { kind: "assemble" };
}

export function stageForAnalysisUnit(unit: AnalysisStepUnit): DeepAnalysisStage {
  switch (unit.kind) {
    case "cadrage":
      return "cadrage";
    case "research_turn":
    case "extract":
      return "recherche";
    case "section":
      return "redaction";
    case "synthese":
      return "synthese";
    case "assemble":
    case "done":
      return "assemblage";
  }
}

/**
 * Exécute UNE unité de travail et renvoie le PATCH à committer — même
 * contrat que `performCourseStepUnit` : l'appelant doit y placer la
 * valeur ENTIÈRE souhaitée pour chaque clé modifiée.
 */
export async function performAnalysisStepUnit(
  client: Anthropic,
  input: AnalysisStepInput,
  progress: AnalysisStepProgress,
  unit: AnalysisStepUnit,
): Promise<Partial<AnalysisStepProgress>> {
  if (unit.kind === "cadrage") {
    const brief = await scopeAnalysis(client, input.topic);
    return { brief };
  }

  if (unit.kind === "research_turn") {
    if (!progress.brief) {
      throw new AnalysisGenerationError("Progression de génération incohérente : cadrage manquant.");
    }
    // Un seul appel Anthropic ici (voir performResearchTurn) : si la
    // recherche nécessite plusieurs tours (pause_turn), chaque tour est sa
    // propre unité de travail, redemandée par decideNextAnalysisStep tant
    // que `research.done` est faux.
    const research = await performResearchTurn(client, progress.brief, progress.research);
    return { research };
  }

  if (unit.kind === "extract") {
    if (!progress.brief || !progress.research) {
      throw new AnalysisGenerationError(
        "Progression de génération incohérente : recherche manquante pour l'extraction des cas.",
      );
    }
    const verifiedCases = await extractVerifiedCases(
      client,
      progress.brief,
      progress.research.findings,
      progress.research.realSources,
    );

    if (verifiedCases.length < MIN_VERIFIED_CASES) {
      throw new AnalysisGenerationError(
        "Pas assez de cas réels et vérifiables trouvés sur ce sujet pour produire une analyse approfondie fiable. Essaie de reformuler le sujet ou de le préciser (un domaine, une période, une région).",
      );
    }

    return { verifiedCases: verifiedCases.slice(0, progress.brief.caseCount) };
  }

  if (unit.kind === "section") {
    if (!progress.brief || !progress.verifiedCases) {
      throw new AnalysisGenerationError(
        "Progression de génération incohérente : recherche manquante pour rédiger une section.",
      );
    }
    const verifiedCase = progress.verifiedCases[unit.index];
    const otherCases = progress.verifiedCases.filter((_, j) => j !== unit.index);
    const content = await writeSection(client, progress.brief, verifiedCase, otherCases);

    const section: DeepAnalysisSection = {
      position: unit.index,
      name: verifiedCase.name,
      outcome: verifiedCase.outcome,
      content: content.content,
      lessons: content.lessons,
      source: { index: unit.index, url: verifiedCase.sourceUrl, title: verifiedCase.sourceTitle },
    };

    return { sections: { ...progress.sections, [String(unit.index)]: section } };
  }

  if (unit.kind === "synthese") {
    if (!progress.brief || !progress.verifiedCases) {
      throw new AnalysisGenerationError(
        "Progression de génération incohérente : sections manquantes pour la synthèse.",
      );
    }
    const sections: DeepAnalysisSection[] = [];
    for (let i = 0; i < progress.verifiedCases.length; i++) {
      const section = progress.sections[String(i)];
      if (!section) {
        throw new AnalysisGenerationError(
          "Progression de génération incohérente : section manquante pour la synthèse.",
        );
      }
      sections.push(section);
    }
    const synthesis = await writeSynthesis(client, progress.brief, sections);
    return { synthesis };
  }

  return {};
}

/**
 * Reconstruit la `GeneratedDeepAnalysis` complète une fois toutes les
 * unités de travail terminées.
 */
export function assembleAnalysisFromProgress(
  input: AnalysisStepInput,
  progress: AnalysisStepProgress,
): GeneratedDeepAnalysis {
  if (!progress.brief || !progress.verifiedCases || !progress.synthesis) {
    throw new AnalysisGenerationError("Progression de génération incohérente pour l'assemblage final.");
  }

  const sections: DeepAnalysisSection[] = [];
  for (let i = 0; i < progress.verifiedCases.length; i++) {
    const section = progress.sections[String(i)];
    if (!section) {
      throw new AnalysisGenerationError("Progression de génération incohérente : section manquante.");
    }
    sections.push(section);
  }
  const sources: DeepAnalysisSource[] = sections.map((s) => s.source);

  return {
    topic: input.topic,
    title: progress.brief.title,
    domain: progress.brief.domain,
    introduction: progress.brief.introduction,
    sections,
    synthesis: progress.synthesis.synthesis,
    keyLessons: progress.synthesis.keyLessons,
    sources,
  };
}
