import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { createAnthropicClient } from "@/lib/anthropic/client";
import {
  AnalysisSchema,
  ChapterContentSchema,
  CourseSummarySchema,
  FinalQuizSchema,
  ModuleQuizSchema,
  ProgrammeSchema,
  ResearchExtractionSchema,
  STAGE_LABELS,
  type Analysis,
  type ChapterContent,
  type CourseSummary,
  type GeneratedChapter,
  type GeneratedCourse,
  type GeneratedModuleQuiz,
  type GenerationStage,
  type Programme,
  type QuizQuestion,
  type VerifiedExample,
} from "./schemas";
import { DEFAULT_MODULE_POSITION, DEFAULT_MODULE_TITLE } from "./persist";

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
      "Tu es Tavyra, une experte en ingénierie pédagogique. Tu analyses une demande de formation pour en déterminer le domaine, le niveau cible et l'angle d'approche, avant qu'elle ne soit construite par d'autres étapes.",
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
    "Tu es Tavyra, chargée de trouver des exemples réels et vérifiables (vraies entreprises, personnes, événements, statistiques) pour illustrer une formation. Utilise l'outil de recherche web pour vérifier chaque fait avant de l'avancer. N'affirme jamais qu'un exemple est réel sans l'avoir confirmé par une recherche.";
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
      "Tu es Tavyra. Tu construis le plan détaillé d'une formation : introduction, objectifs pédagogiques et liste de chapitres. La structure doit être adaptée au sujet (une formation finance n'a pas la même structure qu'une formation histoire).",
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
): Promise<ChapterContent> {
  const chapterPlan = programme.chapters[chapterIndex];
  // Les chapitres sont rédigés en parallèle (latence) : chacun reçoit le plan
  // complet avec un résumé par chapitre pour situer sa place dans la
  // progression, plutôt que le contenu déjà écrit des précédents.
  const outline = programme.chapters
    .map(
      (c, i) =>
        `${i + 1}. ${c.title}${i === chapterIndex ? " ← ce chapitre" : ""} — ${c.summary}`,
    )
    .join("\n");

  const exampleInstruction = assignedExample
    ? `Utilise CET exemple réel, sans en changer les faits ni la source : "${assignedExample.description}" (source : ${assignedExample.sourceUrl}, "${assignedExample.sourceTitle}"). Mets isReal à true et recopie l'URL exactement.`
    : "Aucun exemple réel vérifié n'est disponible pour ce chapitre : invente un exemple fictif ou une simulation clairement illustrative, mets isReal à false et laisse sourceUrl/sourceTitle à null. Ne présente jamais cet exemple comme réel.";

  return parseStructured(client, {
    system:
      "Tu es Tavyra. Tu rédiges un chapitre complet et pédagogique d'une formation, avec une explication progressive, un exemple concret, et un encadré à retenir. N'invente jamais un fait présenté comme réel.",
    user: `Formation : "${analysis.title}" (niveau ${analysis.level}).\nPlan complet de la formation (pour situer ce chapitre dans la progression globale, sans répéter ce que les autres couvrent) :\n${outline}\n\nRédige le chapitre ${chapterIndex + 1} : "${chapterPlan.title}".\nCe chapitre doit couvrir : ${chapterPlan.summary}\n\n${exampleInstruction}`,
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
    system: "Tu es Tavyra. Tu rédiges le résumé final d'une formation à partir de ses points clés.",
    user: `Formation : "${analysis.title}".\nAngle du résumé : ${programme.summaryAngle}\n\nPoints à retenir de chaque chapitre :\n${takeaways}\n\nRédige un résumé final synthétique et les points essentiels de toute la formation.`,
    schema: CourseSummarySchema,
    maxTokens: 6000,
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

const QUESTION_COUNT = 10;

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
    maxTokens: 10000,
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

const MODULE_QUIZ_QUESTION_COUNT = 5;

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
    maxTokens: 6000,
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
  const totalChapters = programme.chapters.length;
  let completedChapters = 0;

  // Rédigés en parallèle : chaque chapitre est indépendant (il reçoit le
  // plan complet pour se situer), ce qui ramène la latence totale de
  // "N chapitres séquentiels" à "1 chapitre" au lieu de N.
  const chapters: GeneratedChapter[] = await Promise.all(
    programme.chapters.map(async (plan, i) => {
      const assignedExample =
        plan.exampleIndex !== null ? verifiedExamples[plan.exampleIndex] ?? null : null;

      const content = await writeChapter(client, analysis, programme, i, assignedExample);

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
      };
    }),
  );

  // Résumé et quiz de module sont indépendants l'un de l'autre (tous deux
  // ne dépendent que des chapitres déjà écrits) : les lancer en parallèle
  // évite d'ajouter leurs latences l'une à l'autre.
  //
  // Le pipeline ne produit encore qu'un seul module couvrant tous les
  // chapitres (voir le commentaire en tête de persist.ts) : un seul quiz de
  // module est donc généré ici, sur la même étendue de contenu que ce
  // module unique (DEFAULT_MODULE_TITLE/DEFAULT_MODULE_POSITION), afin
  // d'associer sans ambiguïté ce quiz au module que `saveCourse` créera.
  const [summary, moduleQuizQuestions] = await Promise.all([
    writeSummary(client, analysis, programme, chapters),
    writeModuleQuiz(client, analysis, DEFAULT_MODULE_TITLE, chapters),
  ]);

  // Le quiz final est généré APRÈS le(s) quiz de module (Prompt 05.8), et
  // non plus en parallèle : il a besoin de connaître les questions déjà
  // posées dans ces quiz pour éviter de les reposer. Ce séquencement
  // ajoute une latence (un aller-retour IA de plus), coût accepté pour
  // garantir une réelle non-répétition plutôt qu'un simple filtrage a
  // posteriori sans contexte.
  const quiz = await writeQuiz(
    client,
    analysis,
    programme.objectives,
    chapters,
    moduleQuizQuestions,
  );

  const moduleQuizzes: GeneratedModuleQuiz[] =
    moduleQuizQuestions.length > 0
      ? [{ modulePosition: DEFAULT_MODULE_POSITION, questions: moduleQuizQuestions }]
      : [];

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
    quiz,
    moduleQuizzes,
  };
}
