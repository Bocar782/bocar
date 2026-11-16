import { z } from "zod";
import { NextResponse } from "next/server";
import { createAnthropicClient } from "@/lib/anthropic/client";
import { buildChatSystemPrompt } from "@/lib/courses/chat-context";
import { getCourseById } from "@/lib/courses/persist";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = "claude-opus-5-5";
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

  const chapterIndex = Math.min(currentChapterIndex, course.chapters.length - 1);
  const system = buildChatSystemPrompt(course, chapterIndex);
  const client = createAnthropicClient();

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const anthropicStream = client.messages.stream({
          model: MODEL,
          max_tokens: 1536,
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
