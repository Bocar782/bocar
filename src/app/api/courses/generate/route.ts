import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CourseGenerationError, generateCourse } from "@/lib/courses/generate";
import { saveCourse } from "@/lib/courses/persist";
import {
  QuotaExceededError,
  releaseReservation,
  reserveGenerationSlot,
} from "@/lib/courses/reservation";
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

  // Réservation atomique de la place de génération, côté base de données
  // (voir supabase/migrations/0007_generation_reservations.sql) — avant tout
  // appel à l'API Anthropic. Deux requêtes simultanées pour le même
  // utilisateur ne peuvent jamais consommer la même dernière place : la
  // fonction SQL sérialise les appels concurrents via un advisory lock.
  // Un appel direct à cette route ne peut donc pas contourner la limite.
  let reservationId: string;
  try {
    reservationId = await reserveGenerationSlot(supabase, "course");
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    // Échec de la réservation elle-même (panne transitoire, etc.) : on
    // refuse plutôt que de laisser passer une génération sans réservation
    // valide — la fiabilité du quota prime sur la disponibilité ici.
    return NextResponse.json(
      { error: "Impossible de vérifier ton quota pour le moment. Réessaie dans un instant." },
      { status: 503 },
    );
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
        // pour ne pas perdre le travail déjà fait. `saveCourse` transmet
        // `reservationId` au RPC `save_generated_course`, qui vérifie,
        // verrouille et marque lui-même cette réservation `completed`
        // dans la MÊME transaction que l'enregistrement de la formation
        // (voir 0012_save_generated_course_atomic.sql) : il ne faut donc
        // PAS appeler `consumeReservation` ici (double consommation). Si la
        // sauvegarde échoue, la réservation reste `pending` (annulée avec
        // le reste par cette même transaction) et doit être libérée ici.
        let courseId: string | null = null;
        let saveWarning: string | null = null;
        try {
          courseId = await saveCourse(supabase, course, reservationId);
        } catch (saveError) {
          saveWarning =
            saveError instanceof Error
              ? saveError.message
              : "Échec de l'enregistrement de la formation.";
          await releaseReservation(supabase, reservationId);
        }

        send({ stage: "done", courseId, course, saveWarning });
      } catch (error) {
        await releaseReservation(supabase, reservationId);
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
