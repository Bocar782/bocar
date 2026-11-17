import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AnalysisGenerationError, generateDeepAnalysis } from "@/lib/analysis/generate";
import { saveDeepAnalysis } from "@/lib/analysis/persist";
import type { DeepAnalysisStage } from "@/lib/analysis/schemas";
import {
  QuotaExceededError,
  releaseReservation,
  reserveGenerationSlot,
} from "@/lib/courses/reservation";
import { checkRequestOrigin } from "@/lib/security/origin-check";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_TOPIC_LENGTH = 500;

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

      // Prompt 05.19/05.20 : même correction qu'en 05.18.1 pour
      // /api/courses/generate — transmis en tout premier, avant le moindre
      // appel IA, pour que le client puisse le persister (sessionStorage)
      // avant même qu'un rechargement de page ne devienne possible.
      // `getGenerationStatus(id, "analysis")` permet ensuite de retrouver
      // l'état exact de cette réservation après un rechargement.
      send({ reservationId });

      try {
        const analysis = await generateDeepAnalysis(
          topic,
          (stage: DeepAnalysisStage, label) => {
            send({ stage, label });
          },
        );

        // L'analyse est générée : on la renvoie même si la sauvegarde
        // échoue (ex. migration SQL pas encore appliquée côté Supabase),
        // pour ne pas perdre le travail déjà fait. `saveDeepAnalysis`
        // transmet `reservationId` au RPC `save_generated_analysis`
        // (Prompt 05.17.1), qui vérifie, verrouille et marque lui-même
        // cette réservation `completed` dans la MÊME transaction que
        // l'enregistrement de l'analyse (voir
        // 0020_restrict_content_tables_to_owner_select.sql) : il ne faut
        // donc PAS appeler `consumeReservation` ici (double consommation),
        // exactement comme pour `saveCourse`/`save_generated_course`. Si
        // la sauvegarde échoue, la réservation reste `pending` (annulée
        // avec le reste par cette même transaction) et doit être libérée
        // ici.
        let analysisId: string | null = null;
        let saveWarning: string | null = null;
        try {
          analysisId = await saveDeepAnalysis(supabase, analysis, reservationId);
        } catch (saveError) {
          // Prompt 05.16.1 (correctif E3, audit de sécurité 05.16) :
          // `saveDeepAnalysis` encapsule toujours une erreur
          // Supabase/Postgres brute dans un `Error` générique — jamais une
          // erreur métier conçue pour être affichée. Le détail technique ne
          // doit donc jamais atteindre le navigateur : seul un message
          // générique est envoyé dans `saveWarning`, le détail réel reste
          // uniquement dans les logs serveur.
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
