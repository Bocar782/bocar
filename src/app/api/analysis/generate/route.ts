import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AnalysisGenerationError, generateDeepAnalysis } from "@/lib/analysis/generate";
import { saveDeepAnalysis } from "@/lib/analysis/persist";
import type { DeepAnalysisStage } from "@/lib/analysis/schemas";
import {
  QuotaExceededError,
  consumeReservation,
  releaseReservation,
  reserveGenerationSlot,
} from "@/lib/courses/reservation";

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
    return NextResponse.json({ error: "Le sujet ne peut pas être vide." }, { status: 400 });
  }
  if (topic.length > MAX_TOPIC_LENGTH) {
    return NextResponse.json({ error: "Sujet trop long." }, { status: 400 });
  }

  // L'analyse approfondie coûte nettement plus cher (recherche web + longue
  // génération) qu'une formation classique : réservée au plan Pro, avec un
  // quota mensuel réservé atomiquement côté base de données (voir
  // supabase/migrations/0007_generation_reservations.sql) avant tout appel
  // à l'API Anthropic — pas seulement affiché côté client, et jamais
  // contournable par deux requêtes simultanées.
  let reservationId: string;
  try {
    reservationId = await reserveGenerationSlot(supabase, "analysis");
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
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
        const analysis = await generateDeepAnalysis(
          topic,
          (stage: DeepAnalysisStage, label) => {
            send({ stage, label });
          },
        );

        // L'analyse est générée : on la renvoie même si la sauvegarde
        // échoue (ex. migration SQL pas encore appliquée côté Supabase),
        // pour ne pas perdre le travail déjà fait. La réservation n'est
        // consommée que si la sauvegarde a réellement réussi.
        let analysisId: string | null = null;
        let saveWarning: string | null = null;
        try {
          analysisId = await saveDeepAnalysis(supabase, user.id, analysis);
          await consumeReservation(supabase, reservationId, analysisId);
        } catch (saveError) {
          // Prompt 05.16.1 (correctif E3, audit de sécurité 05.16) :
          // `saveDeepAnalysis`/`consumeReservation` encapsulent toujours une
          // erreur Supabase/Postgres brute dans un `Error` générique —
          // jamais une erreur métier conçue pour être affichée. Le détail
          // technique ne doit donc jamais atteindre le navigateur : seul un
          // message générique est envoyé dans `saveWarning`, le détail réel
          // reste uniquement dans les logs serveur.
          console.error("Échec de l'enregistrement de l'analyse :", saveError);
          saveWarning =
            "L'analyse a été générée mais n'a pas pu être enregistrée. Réessaie, ou contacte le support si le problème persiste.";
          await releaseReservation(supabase, reservationId);
        }

        send({ stage: "done", analysisId, analysis, saveWarning });
      } catch (error) {
        await releaseReservation(supabase, reservationId);
        // Prompt 05.16.1 (correctif E3) : seules les erreurs explicitement
        // conçues pour être affichées (`AnalysisGenerationError`, levée avec
        // un message déjà rédigé pour l'utilisateur) conservent leur
        // message. Toute autre erreur ne doit jamais exposer son détail
        // technique au navigateur ; elle reste uniquement dans les logs
        // serveur.
        const message = error instanceof AnalysisGenerationError
          ? error.message
          : "Une erreur est survenue pendant l'analyse. Réessaie dans un instant.";
        if (!(error instanceof AnalysisGenerationError)) {
          console.error("Erreur inattendue pendant la génération d'analyse :", error);
        }
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
