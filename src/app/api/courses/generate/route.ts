import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CourseGenerationError, generateCourse } from "@/lib/courses/generate";
import { MONTHLY_GENERATION_LIMIT } from "@/lib/courses/limits";
import { countGenerationsThisMonth, saveCourse } from "@/lib/courses/persist";
import type { GenerationStage } from "@/lib/courses/schemas";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_TOPIC_LENGTH = 500;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  // Quota mensuel contrôlé côté serveur (pas seulement affiché côté client)
  // pour éviter qu'un appel direct à cette route ne le contourne. En cas
  // d'échec du comptage (ex. migration pas encore appliquée), on laisse
  // passer plutôt que de bloquer toute génération.
  try {
    const usedThisMonth = await countGenerationsThisMonth(supabase, user.id);
    if (usedThisMonth >= MONTHLY_GENERATION_LIMIT) {
      return NextResponse.json(
        {
          error: `Limite mensuelle atteinte (${MONTHLY_GENERATION_LIMIT} formations). Réessaie le mois prochain.`,
        },
        { status: 429 },
      );
    }
  } catch {
    // ignoré
  }

  let topic: string;
  try {
    const body = (await request.json()) as { topic?: unknown };
    topic = String(body?.topic ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  if (!topic) {
    return NextResponse.json(
      { error: "Le sujet ne peut pas être vide." },
      { status: 400 },
    );
  }
  if (topic.length > MAX_TOPIC_LENGTH) {
    return NextResponse.json({ error: "Sujet trop long." }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function send(payload: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      }

      try {
        const course = await generateCourse(
          topic,
          (stage: GenerationStage, label) => {
            send({ stage, label });
          },
        );

        // La formation est générée : on la renvoie même si la sauvegarde
        // échoue (ex. migration SQL pas encore appliquée côté Supabase),
        // pour ne pas perdre le travail déjà fait.
        let courseId: string | null = null;
        let saveWarning: string | null = null;
        try {
          courseId = await saveCourse(supabase, user.id, course);
        } catch (saveError) {
          saveWarning =
            saveError instanceof Error
              ? saveError.message
              : "Échec de l'enregistrement de la formation.";
        }

        send({ stage: "done", courseId, course, saveWarning });
      } catch (error) {
        const message =
          error instanceof CourseGenerationError || error instanceof Error
            ? error.message
            : "Une erreur est survenue pendant la génération.";
        send({ stage: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
