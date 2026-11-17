import type { SupabaseClient } from "@supabase/supabase-js";
import type { GeneratedDeepAnalysis } from "./schemas";

type DeepAnalysisListItem = {
  id: string;
  title: string;
  domain: string;
  createdAt: string;
  caseCount: number;
};

// Prompt 05.17.1 (correction de la faille critique de l'audit 05.17) :
// passe par le RPC `save_generated_analysis` (voir
// 0020_restrict_content_tables_to_owner_select.sql) plutôt que par un
// insert direct — `deep_analyses` n'a plus qu'une policy RLS de lecture.
// Comme pour `saveCourse`/`save_generated_course`, l'identité
// (auth.uid()) est déterminée côté base de données, jamais transmise ici
// (pas de paramètre userId), et la réservation est vérifiée puis marquée
// `completed` dans la MÊME transaction que l'insertion : il ne faut donc
// PAS appeler `consumeReservation` séparément après celle-ci (voir
// src/app/api/analysis/generate/route.ts).
export async function saveDeepAnalysis(
  supabase: SupabaseClient,
  analysis: GeneratedDeepAnalysis,
  reservationId: string,
): Promise<string> {
  const { data, error } = await supabase.rpc("save_generated_analysis", {
    p_analysis: {
      topic: analysis.topic,
      title: analysis.title,
      domain: analysis.domain,
      introduction: analysis.introduction,
      sections: analysis.sections,
      synthesis: analysis.synthesis,
      keyLessons: analysis.keyLessons,
      sources: analysis.sources,
    },
    p_reservation_id: reservationId,
  });

  if (error || !data) {
    throw new Error(`Échec de l'enregistrement de l'analyse : ${error?.message}`);
  }

  return data as string;
}

export async function listDeepAnalyses(
  supabase: SupabaseClient,
  userId: string,
): Promise<DeepAnalysisListItem[]> {
  const { data, error } = await supabase
    .from("deep_analyses")
    .select("id, title, domain, created_at, sections")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Échec du chargement des analyses : ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    domain: row.domain as string,
    createdAt: row.created_at as string,
    caseCount: Array.isArray(row.sections) ? row.sections.length : 0,
  }));
}

export async function getDeepAnalysisById(
  supabase: SupabaseClient,
  analysisId: string,
): Promise<GeneratedDeepAnalysis | null> {
  const { data, error } = await supabase
    .from("deep_analyses")
    .select("topic, title, domain, introduction, sections, synthesis, key_lessons, sources")
    .eq("id", analysisId)
    .maybeSingle();

  if (error) throw new Error(`Échec du chargement de l'analyse : ${error.message}`);
  if (!data) return null;

  return {
    topic: data.topic as string,
    title: data.title as string,
    domain: data.domain as string,
    introduction: data.introduction as string,
    sections: (data.sections ?? []) as GeneratedDeepAnalysis["sections"],
    synthesis: data.synthesis as string,
    keyLessons: (data.key_lessons ?? []) as string[],
    sources: (data.sources ?? []) as GeneratedDeepAnalysis["sources"],
  };
}

export async function countDeepAnalysesSince(
  supabase: SupabaseClient,
  userId: string,
  sinceIso: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("deep_analyses")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", sinceIso);

  if (error) throw new Error(`Échec du calcul de l'utilisation : ${error.message}`);

  return count ?? 0;
}
