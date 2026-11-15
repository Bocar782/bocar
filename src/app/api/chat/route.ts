import { z } from "zod";
import { NextResponse } from "next/server";
import { createAnthropicClient } from "@/lib/anthropic/client";
import { buildChatSystemPrompt } from "@/lib/courses/chat-context";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = "claude-opus-5-5";
const MAX_MESSAGE_LENGTH = 2000;
const MAX_MESSAGES = 40;

const ExampleSchema = z.object({
  isReal: z.boolean(),
  description: z.string(),
  sourceUrl: z.string().nullable(),
  sourceTitle: z.string().nullable(),
});

const ChapterSchema = z.object({
  position: z.number().int(),
  title: z.string(),
  explanation: z.string(),
  keyTakeaway: z.string(),
  example: ExampleSchema,
});

const QuizQuestionSchema = z.object({
  position: z.number().int(),
  chapterIndex: z.number().int().nullable(),
  question: z.string(),
  choices: z.array(z.string()),
  correctChoiceIndex: z.number().int(),
  explanation: z.string(),
});

const CourseSchema = z.object({
  topic: z.string(),
  title: z.string(),
  domain: z.string(),
  level: z.string(),
  introduction: z.string(),
  objectives: z.array(z.string()),
  chapters: z.array(ChapterSchema).min(1),
  summary: z.string(),
  keyPoints: z.array(z.string()),
  quiz: z.array(QuizQuestionSchema),
});

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(MAX_MESSAGE_LENGTH),
});

const BodySchema = z.object({
  course: CourseSchema,
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

  const { course, currentChapterIndex, messages } = parsedBody.data;

  if (messages[messages.length - 1].role !== "user") {
    return NextResponse.json(
      { error: "Le dernier message doit venir de l'utilisateur." },
      { status: 400 },
    );
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
