import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { createAnthropicClient } from "@/lib/anthropic/client";
import {
  AnalysisSchema,
  ChapterContentSchema,
  CourseSummarySchema,
  ProgrammeSchema,
  ResearchExtractionSchema,
  STAGE_LABELS,
  type Analysis,
  type ChapterContent,
  type CourseSummary,
  type GeneratedChapter,
  type GeneratedCourse,
  type GenerationStage,
  type Programme,
  type VerifiedExample,
} from "./schemas";

const MODEL = "claude-opus-5-5";

export class CourseGenerationError extends Error {}

type Progress = (stage: GenerationStage, detail?: string) => void;

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
    effort?: "medium" | "high";
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

async function analyzeTopic(client: Anthropic, topic: string): Promise<Analysis> {
  const result = await parseStructured(client, {
    system:
      "Tu es Lia, une experte en ingénierie pédagogique. Tu analyses une demande de formation pour en déterminer le domaine, le niveau cible et l'angle d'approche, avant qu'elle ne soit construite par d'autres étapes.",
    user: `Demande de l'utilisateur : "${topic}"\n\nAnalyse ce sujet. Choisis un nombre de chapitres entre 4 et 6 selon la richesse du sujet. Détermine si des exemples réels (vraies entreprises, personnes, événements, statistiques) sont pertinents pour ce sujet — ce n'est pas le cas pour des notions très abstraites ou purement techniques où un exemple fictif est plus clair.`,
    schema: AnalysisSchema,
    maxTokens: 2048,
  });

  return {
    ...result,
    chapterCount: Math.min(6, Math.max(4, Math.round(result.chapterCount))),
  };
}

// --- Étape 2 : recherche d'exemples réels vérifiés ---

async function searchRealExamples(
  client: Anthropic,
  analysis: Analysis,
): Promise<{ findings: string; realSources: { url: string; title: string }[] }> {
  const system =
    "Tu es Lia, chargée de trouver des exemples réels et vérifiables (vraies entreprises, personnes, événements, statistiques) pour illustrer une formation. Utilise l'outil de recherche web pour vérifier chaque fait avant de l'avancer. N'affirme jamais qu'un exemple est réel sans l'avoir confirmé par une recherche.";
  const user = `Sujet de la formation : "${analysis.title}" (domaine : ${analysis.domain}, niveau ${analysis.level}).\n\nTrouve entre ${Math.min(8, analysis.chapterCount + 2)} et 8 exemples réels et vérifiables pertinents pour illustrer différents aspects de ce sujet. Pour chacun : cherche sur le web pour vérifier les faits, puis décris ce que l'exemple illustre et quel aspect du sujet il concerne. Cite explicitement l'URL exacte de ta source pour chaque exemple.`;

  let messages: Anthropic.MessageParam[] = [{ role: "user", content: user }];
  const tools = [
    { type: "web_search_20260209" as const, name: "web_search" as const, max_uses: 8 },
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
    maxTokens: 6000,
  });

  const realUrlSet = new Set(realSources.map((s) => s.url.trim().replace(/\/$/, "")));
  // Filet de sécurité anti-hallucination : un exemple dont l'URL ne
  // correspond à aucune source réellement trouvée est écarté du pool vérifié.
  return result.examples.filter((example) =>
    realUrlSet.has(example.sourceUrl.trim().replace(/\/$/, "")),
  );
}

// --- Étape 3 : construction du programme ---

async function buildProgramme(
  client: Anthropic,
  analysis: Analysis,
  verifiedExamples: VerifiedExample[],
): Promise<Programme> {
  const examplesList =
    verifiedExamples.length > 0
      ? verifiedExamples
          .map((e, i) => `[${i}] (${e.theme}) ${e.description} — source : ${e.sourceUrl}`)
          .join("\n")
      : "Aucun exemple réel vérifié disponible — tous les chapitres utiliseront des exemples fictifs/illustratifs, clairement indiqués comme tels.";

  return parseStructured(client, {
    system:
      "Tu es Lia. Tu construis le plan détaillé d'une formation : introduction, objectifs pédagogiques et liste de chapitres. La structure doit être adaptée au sujet (une formation finance n'a pas la même structure qu'une formation histoire).",
    user: `Sujet : "${analysis.title}" (domaine : ${analysis.domain}, niveau ${analysis.level}, angle : ${analysis.angle}).\n\nConstruis le programme avec exactement ${analysis.chapterCount} chapitres, progressifs (chaque chapitre s'appuie sur les précédents).\n\nExemples réels vérifiés disponibles (assigne-en un par exampleIndex au chapitre le plus pertinent s'il y en a un adapté, sinon laisse exampleIndex à null) :\n${examplesList}`,
    schema: ProgrammeSchema,
    maxTokens: 12000,
  });
}

// --- Étape 4 : rédaction des chapitres ---

async function writeChapter(
  client: Anthropic,
  analysis: Analysis,
  programme: Programme,
  chapterIndex: number,
  assignedExample: VerifiedExample | null,
  previousTakeaways: string[],
): Promise<ChapterContent> {
  const chapterPlan = programme.chapters[chapterIndex];
  const outline = programme.chapters
    .map((c, i) => `${i + 1}. ${c.title}`)
    .join("\n");

  const exampleInstruction = assignedExample
    ? `Utilise CET exemple réel, sans en changer les faits ni la source : "${assignedExample.description}" (source : ${assignedExample.sourceUrl}, "${assignedExample.sourceTitle}"). Mets isReal à true et recopie l'URL exactement.`
    : "Aucun exemple réel vérifié n'est disponible pour ce chapitre : invente un exemple fictif ou une simulation clairement illustrative, mets isReal à false et laisse sourceUrl/sourceTitle à null. Ne présente jamais cet exemple comme réel.";

  const continuityNote =
    previousTakeaways.length > 0
      ? `Points déjà vus dans les chapitres précédents (ne les réexplique pas, construis dessus) :\n${previousTakeaways.map((t) => `- ${t}`).join("\n")}`
      : "C'est le premier chapitre de la formation.";

  return parseStructured(client, {
    system:
      "Tu es Lia. Tu rédiges un chapitre complet et pédagogique d'une formation, avec une explication progressive, un exemple concret, et un encadré à retenir. N'invente jamais un fait présenté comme réel.",
    user: `Formation : "${analysis.title}" (niveau ${analysis.level}).\nPlan complet :\n${outline}\n\n${continuityNote}\n\nRédige le chapitre ${chapterIndex + 1} : "${chapterPlan.title}".\nCe chapitre doit couvrir : ${chapterPlan.summary}\n\n${exampleInstruction}`,
    schema: ChapterContentSchema,
    maxTokens: 20000,
  });
}

// --- Étape 5 : résumé final ---

async function writeSummary(
  client: Anthropic,
  analysis: Analysis,
  programme: Programme,
  chapters: GeneratedChapter[],
): Promise<CourseSummary> {
  const takeaways = chapters
    .map((c) => `- ${c.title} : ${c.keyTakeaway}`)
    .join("\n");

  return parseStructured(client, {
    system: "Tu es Lia. Tu rédiges le résumé final d'une formation à partir de ses points clés.",
    user: `Formation : "${analysis.title}".\nAngle du résumé : ${programme.summaryAngle}\n\nPoints à retenir de chaque chapitre :\n${takeaways}\n\nRédige un résumé final synthétique et les points essentiels de toute la formation.`,
    schema: CourseSummarySchema,
    maxTokens: 6000,
  });
}

// --- Orchestration complète ---

export async function generateCourse(
  topic: string,
  onProgress: Progress,
): Promise<GeneratedCourse> {
  const client = createAnthropicClient();

  onProgress("analyse", STAGE_LABELS.analyse);
  const analysis = await analyzeTopic(client, topic);

  onProgress("recherche", STAGE_LABELS.recherche);
  let verifiedExamples: VerifiedExample[] = [];
  if (analysis.usesRealWorldExamples) {
    const { findings, realSources } = await searchRealExamples(client, analysis);
    verifiedExamples = await extractVerifiedExamples(client, analysis, findings, realSources);
  }

  onProgress("programme", STAGE_LABELS.programme);
  const programme = await buildProgramme(client, analysis, verifiedExamples);

  onProgress("chapitres", STAGE_LABELS.chapitres);
  const chapters: GeneratedChapter[] = [];
  for (let i = 0; i < programme.chapters.length; i += 1) {
    const plan = programme.chapters[i];
    const assignedExample =
      plan.exampleIndex !== null ? verifiedExamples[plan.exampleIndex] ?? null : null;

    const content = await writeChapter(
      client,
      analysis,
      programme,
      i,
      assignedExample,
      chapters.map((c) => c.keyTakeaway),
    );

    // Deuxième filet de sécurité : si le modèle prétend "réel" sans fournir
    // une source qui corresponde à un exemple vérifié, on force le fictif.
    const claimedUrl = content.example.sourceUrl?.trim().replace(/\/$/, "") ?? null;
    const matchesVerified =
      claimedUrl !== null &&
      verifiedExamples.some((e) => e.sourceUrl.trim().replace(/\/$/, "") === claimedUrl);
    const isReal = content.example.isReal && matchesVerified;

    chapters.push({
      position: i,
      title: plan.title,
      explanation: content.explanation,
      keyTakeaway: content.keyTakeaway,
      example: {
        isReal,
        description: content.example.description,
        sourceUrl: isReal ? content.example.sourceUrl : null,
        sourceTitle: isReal ? content.example.sourceTitle : null,
      },
    });
  }

  const summary = await writeSummary(client, analysis, programme, chapters);

  onProgress("pret", STAGE_LABELS.pret);

  return {
    topic,
    title: analysis.title,
    domain: analysis.domain,
    level: analysis.level,
    introduction: programme.introduction,
    objectives: programme.objectives,
    chapters,
    summary: summary.summary,
    keyPoints: summary.keyPoints,
  };
}
