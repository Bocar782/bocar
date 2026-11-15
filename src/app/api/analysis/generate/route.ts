import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AnalysisGenerationError, generateDeepAnalysis } from "@/lib/analysis/generate";
import { saveDeepAnalysis } from "@/lib/analysis/persist";
import type { DeepAnalysisStage } from "@/lib/analysis/schemas";
import { getAnalysisUsageStatus } from "@/lib/courses/plan";

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

  // L'analyse approfondie coûte nettement plus cher (recherche web + longue
  // génération) qu'une formation classique : réservée au plan Pro, avec un
  // quota mensuel contrôlé côté serveur — pas seulement affiché côté client.
  try {
    const usage = await getAnalysisUsageStatus(supabase, user.id);
    if (usage.remaining <= 0) {
      const message = !usage.isPro
        ? "L'analyse approfondie est réservée au plan Pro. Abonne-toi pour y accéder."
        : `Tu as atteint la limite de ${usage.limit} analyses approfondies pour cette période de facturation. Le quota se réinitialise à ton prochain renouvellement.`;
      return NextResponse.json({ error: message }, { status: 403 });
    }
  } catch {
    return NextResponse.json(
      { error: "Impossible de vérifier ton quota pour le moment." },
      { status: 500 },
    );
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
        // pour ne pas perdre le travail déjà fait.
        let analysisId: string | null = null;
        let saveWarning: string | null = null;
        try {
          analysisId = await saveDeepAnalysis(supabase, user.id, analysis);
        } catch (saveError) {
          saveWarning =
            saveError instanceof Error
              ? saveError.message
              : "Échec de l'enregistrement de l'analyse.";
        }

        send({ stage: "done", analysisId, analysis, saveWarning });
      } catch (error) {
        const message =
          error instanceof AnalysisGenerationError || error instanceof Error
            ? error.message
            : "Une erreur est survenue pendant l'analyse.";
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
