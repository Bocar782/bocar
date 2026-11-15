import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { createAnthropicClient } from "@/lib/anthropic/client";
import {
  AnalysisBriefSchema,
  CaseExtractionSchema,
  DeepSectionSchema,
  DeepSynthesisSchema,
  DEEP_STAGE_LABELS,
  type AnalysisBrief,
  type DeepAnalysisSection,
  type DeepAnalysisSource,
  type DeepAnalysisStage,
  type GeneratedDeepAnalysis,
  type VerifiedCase,
} from "./schemas";

const MODEL = "claude-opus-5-5";
const MIN_VERIFIED_CASES = 3;

export class AnalysisGenerationError extends Error {}

type Progress = (stage: DeepAnalysisStage, detail?: string) => void;

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
  const result = await parseStructured(client, {
    system:
      "Tu es Lia, analyste pédagogique spécialisée dans l'étude de cas réels : parcours d'entrepreneurs, d'entreprises, d'investisseurs, stratégies, réussites et échecs. Tu cadres une demande d'analyse approfondie avant la phase de recherche. Ton rôle est de préparer une vraie recherche structurée, pas une simple reformulation du sujet.",
    user: `Sujet demandé : "${topic}"\n\nCadre cette analyse approfondie. Choisis un nombre de cas réels à analyser entre 4 et 7 selon la richesse du sujet. Prépare 4 à 6 requêtes de recherche web distinctes et complémentaires (par exemple : succès notables, échecs notables, stratégies spécifiques, données chiffrées ou études) pour rassembler des cas réels variés et pertinents, pas uniquement des success stories.`,
    schema: AnalysisBriefSchema,
    maxTokens: 2048,
  });

  return { ...result, caseCount: Math.min(7, Math.max(4, Math.round(result.caseCount))) };
}

// --- Étape 2 : recherche web de cas réels ---

async function researchRealCases(
  client: Anthropic,
  brief: AnalysisBrief,
): Promise<{ findings: string; realSources: { url: string; title: string }[] }> {
  const system =
    "Tu es Lia, chargée de rassembler des cas réels et vérifiables (parcours d'entrepreneurs, entreprises, investisseurs, stratégies, réussites, échecs, événements, données) disponibles publiquement, en lien avec un sujet donné. Utilise l'outil de recherche web pour mener PLUSIEURS recherches distinctes couvrant différents angles (succès, échecs, stratégies, données). Vérifie chaque fait par une recherche avant de l'avancer. N'affirme jamais qu'un cas est réel sans l'avoir confirmé par une recherche.";
  const queriesList = brief.searchQueries.map((q) => `- ${q}`).join("\n");
  const user = `Sujet : "${brief.title}" (domaine : ${brief.domain}).\nAngle de recherche : ${brief.researchAngle}\n\nMène des recherches web sur CHACUNE des requêtes suivantes, et d'autres si besoin pour compléter :\n${queriesList}\n\nRassemble au moins ${brief.caseCount + 2} cas réels et vérifiables (personnes, entreprises, événements), en couvrant à la fois des réussites ET des échecs ou situations mitigées — pas uniquement des success stories. Pour chacun : vérifie les faits par la recherche, résume ce qui s'est passé et pourquoi, et cite explicitement l'URL exacte de ta source.`;

  let messages: Anthropic.MessageParam[] = [{ role: "user", content: user }];
  const tools = [
    { type: "web_search_20260209" as const, name: "web_search" as const, max_uses: 14 },
  ];

  let response = requireContent(
    await client.messages.create({ model: MODEL, max_tokens: 16000, system, messages, tools }),
  );

  // Les tours de recherche serveur peuvent s'arrêter sur pause_turn si la
  // limite interne d'itérations est atteinte : on relance pour continuer.
  // Une analyse approfondie mène plus de recherches qu'une formation
  // classique, donc on autorise davantage de reprises.
  let resumes = 0;
  while (response.stop_reason === "pause_turn" && resumes < 5) {
    messages = [...messages, { role: "assistant", content: response.content }];
    response = requireContent(
      await client.messages.create({ model: MODEL, max_tokens: 16000, system, messages, tools }),
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

async function extractVerifiedCases(
  client: Anthropic,
  brief: AnalysisBrief,
  findings: string,
  realSources: { url: string; title: string }[],
): Promise<VerifiedCase[]> {
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
  const context =
    otherCases.length > 0
      ? `Autres cas traités ailleurs dans cette analyse (pour ne pas te répéter, sans devoir les développer) :\n${otherCases.map((c) => `- ${c.name} (${c.outcome})`).join("\n")}`
      : "";

  return parseStructured(client, {
    system:
      "Tu es Lia, analyste pédagogique. Tu rédiges une section d'analyse approfondie et rigoureuse sur un cas réel précis : contexte, décisions clés, explication causale de la réussite ou de l'échec, et enseignements concrets. N'invente jamais un fait : base-toi uniquement sur le résumé de recherche fourni. Ce contenu doit être nettement plus long, plus développé et plus analytique qu'un simple chapitre introductif.",
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
  const casesOverview = sections
    .map((s) => `- ${s.name} (${s.outcome}) : ${s.lessons.join(" / ")}`)
    .join("\n");

  return parseStructured(client, {
    system:
      "Tu es Lia. Tu rédiges la synthèse pédagogique finale d'une analyse approfondie, en identifiant les motifs récurrents entre plusieurs cas réels analysés — ce qui distingue les réussites des échecs, et les enseignements transversaux applicables au-delà des cas précis.",
    user: `Analyse : "${brief.title}" (domaine : ${brief.domain}).\n\nCas analysés et leurs enseignements :\n${casesOverview}\n\nRédige une synthèse pédagogique transversale : quels motifs reviennent entre ces cas, qu'est-ce qui distingue ceux qui ont réussi de ceux qui ont échoué, et quels enseignements clés en tirer, applicables au-delà de ces cas précis.`,
    schema: DeepSynthesisSchema,
    maxTokens: 8000,
  });
}

// --- Orchestration complète ---

export async function generateDeepAnalysis(
  topic: string,
  onProgress: Progress,
): Promise<GeneratedDeepAnalysis> {
  const client = createAnthropicClient();

  onProgress("cadrage", DEEP_STAGE_LABELS.cadrage);
  const brief = await scopeAnalysis(client, topic);

  onProgress("recherche", DEEP_STAGE_LABELS.recherche);
  const { findings, realSources } = await researchRealCases(client, brief);
  const verifiedCases = await extractVerifiedCases(client, brief, findings, realSources);

  if (verifiedCases.length < MIN_VERIFIED_CASES) {
    throw new AnalysisGenerationError(
      "Pas assez de cas réels et vérifiables trouvés sur ce sujet pour produire une analyse approfondie fiable. Essaie de reformuler le sujet ou de le préciser (un domaine, une période, une région).",
    );
  }

  const selectedCases = verifiedCases.slice(0, brief.caseCount);

  onProgress("redaction", DEEP_STAGE_LABELS.redaction);
  let completed = 0;
  const sections: DeepAnalysisSection[] = await Promise.all(
    selectedCases.map(async (verifiedCase, i) => {
      const otherCases = selectedCases.filter((_, j) => j !== i);
      const content = await writeSection(client, brief, verifiedCase, otherCases);

      completed += 1;
      onProgress("redaction", `${DEEP_STAGE_LABELS.redaction} (${completed}/${selectedCases.length})`);

      return {
        position: i,
        name: verifiedCase.name,
        outcome: verifiedCase.outcome,
        content: content.content,
        lessons: content.lessons,
        source: { index: i, url: verifiedCase.sourceUrl, title: verifiedCase.sourceTitle },
      };
    }),
  );

  onProgress("synthese", DEEP_STAGE_LABELS.synthese);
  const synthesis = await writeSynthesis(client, brief, sections);

  const sources: DeepAnalysisSource[] = sections.map((s) => s.source);

  onProgress("pret", DEEP_STAGE_LABELS.pret);

  return {
    topic,
    title: brief.title,
    domain: brief.domain,
    introduction: brief.introduction,
    sections,
    synthesis: synthesis.synthesis,
    keyLessons: synthesis.keyLessons,
    sources,
  };
}
