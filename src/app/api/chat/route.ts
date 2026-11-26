import { AI_MODEL } from "@/lib/anthropic/model";
import { isOfflineAI } from "@/lib/courses/offline";
import { z } from "zod";
import { NextResponse } from "next/server";
import { createAnthropicClient } from "@/lib/anthropic/client";
import { ChatRateLimitExceededError, checkChatRateLimit } from "@/lib/chat/rate-limit";
import { computeCourseAccess } from "@/lib/courses/access";
import { buildChatSystemPrompt } from "@/lib/courses/chat-context";
import { getCourseById } from "@/lib/courses/persist";
import { isOnFreePlan } from "@/lib/courses/plan";
import { checkRequestOrigin } from "@/lib/security/origin-check";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = AI_MODEL;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_MESSAGES = 40;

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(MAX_MESSAGE_LENGTH),
});

// Le navigateur n'envoie plus que l'identifiant de la formation : le contenu
// utilisé pour construire le contexte de l'assistant est systématiquement
// récupéré et vérifié côté serveur (voir plus bas), jamais fait confiance
// depuis la requête.
const BodySchema = z.object({
  courseId: z.string().uuid(),
  currentChapterIndex: z.number().int().min(0),
  messages: z.array(MessageSchema).min(1).max(MAX_MESSAGES),
});

export async function POST(request: Request) {
  const originError = checkRequestOrigin(request);
  if (originError) return originError;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const parsedBody = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const { courseId, currentChapterIndex, messages } = parsedBody.data;

  if (messages[messages.length - 1].role !== "user") {
    return NextResponse.json(
      { error: "Le dernier message doit venir de l'utilisateur." },
      { status: 400 },
    );
  }

  // Ne jamais faire confiance au contenu de formation envoyé par le
  // navigateur : on récupère ici la véritable formation depuis Supabase, via
  // le client authentifié de l'utilisateur. La policy RLS "courses_owner_all"
  // (auth.uid() = user_id) garantit qu'une formation inexistante ou
  // appartenant à un autre utilisateur renvoie `null`, dans les deux cas de
  // façon identique (pas de distinction qui permettrait de deviner l'existence
  // d'une formation appartenant à quelqu'un d'autre).
  let course: Awaited<ReturnType<typeof getCourseById>>;
  try {
    course = await getCourseById(supabase, courseId);
  } catch {
    return NextResponse.json({ error: "Formation introuvable." }, { status: 404 });
  }

  if (!course) {
    return NextResponse.json({ error: "Formation introuvable." }, { status: 404 });
  }

  // Prompt 05.17.2 (correction E2 de l'audit 05.17) : `currentChapterIndex`
  // vient du navigateur et n'est JAMAIS fait confiance au-delà d'une simple
  // position dans la formation — le plan réel de l'utilisateur est relu ici
  // depuis Supabase (jamais transmis par le client) pour déterminer le
  // chapitre le plus avancé auquel il a réellement droit. Avant cette
  // correction, `currentChapterIndex` n'était plafonné qu'à
  // `course.chapters.length - 1` : un utilisateur gratuit pouvait demander
  // le contexte de n'importe quel chapitre verrouillé, y compris le
  // dernier, et en recevoir le contenu complet dans la réponse de Tavyra.
  // Vérifié AVANT la consommation de la limite de fréquence ci-dessous, pour
  // qu'une demande de toute façon refusée ne consomme jamais inutilement ce
  // quota.
  const locked = await isOnFreePlan(supabase, user.id);
  const { unlockedCount } = computeCourseAccess(course, locked);
  if (currentChapterIndex >= unlockedCount) {
    return NextResponse.json(
      {
        error:
          "Ce chapitre fait partie du contenu verrouillé. Débloque la formation complète pour en discuter avec Tavyra.",
      },
      { status: 403 },
    );
  }

  // Limite de fréquence (Prompt 05.16.1, correctif E1) : vérifiée et
  // consommée atomiquement côté base de données, juste avant l'appel
  // Anthropic — jamais avant (une requête qui aurait de toute façon échoué
  // sur la validation ou l'introuvabilité de la formation ci-dessus ne
  // consomme pas inutilement le quota de l'utilisateur). Voir
  // check_chat_rate_limit() dans supabase/migrations/0016_chat_rate_limit.sql :
  // l'identité (auth.uid()) et les limites Free/Pro sont entièrement
  // déterminées côté serveur, jamais transmises ni fait confiance depuis ce
  // code — impossible à contourner en appelant directement l'API avec un
  // plan falsifié.
  try {
    await checkChatRateLimit(supabase);
  } catch (err) {
    if (err instanceof ChatRateLimitExceededError) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    return NextResponse.json(
      { error: "Impossible de vérifier ta limite de messages pour le moment. Réessaie dans un instant." },
      { status: 503 },
    );
  }

  const chapterIndex = Math.min(currentChapterIndex, course.chapters.length - 1);
  const system = buildChatSystemPrompt(course, chapterIndex);

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // Prompt 06.35 : client créé ICI, à l'intérieur de ce try — une clé
        // ANTHROPIC_API_KEY absente ou vide le ferait sinon planter avant
        // le moindre octet envoyé au navigateur, ce qui produirait une
        // page d'erreur serveur brute au lieu du message "Une erreur est
        // survenue..." déjà prévu ci-dessous pour ce flux en streaming.
        if (isOfflineAI()) {
          const chapter = course.chapters[chapterIndex];
          controller.enqueue(
            encoder.encode(
              `Bonne question ! Pour le chapitre « ${chapter?.title ?? course.title} », retiens d'abord l'essentiel : ${chapter?.keyTakeaway ?? "reviens sur les points clés de la leçon."}\n\nAstuce : reformule cette idée avec tes propres mots, puis applique-la sur un petit exemple concret. Si un point reste flou, relis l'exemple de la leçon et refais l'exercice proposé.`,
            ),
          );
          return;
        }
        const client = createAnthropicClient();
        const anthropicStream = client.messages.stream({
          model: MODEL,
          max_tokens: 6000,
          system,
          messages,
        });

        anthropicStream.on("text", (delta) => {
          controller.enqueue(encoder.encode(delta));
        });

        const finalMessage = await anthropicStream.finalMessage();

        if (finalMessage.stop_reason === "refusal") {
          controller.enqueue(
            encoder.encode(
              "\n\n*Désolée, je ne peux pas répondre à ça. Essaie de reformuler.*",
            ),
          );
        }
      } catch {
        controller.enqueue(
          encoder.encode("Une erreur est survenue, réessaie dans un instant."),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
