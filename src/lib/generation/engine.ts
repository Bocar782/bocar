// Enveloppes typées des RPC SECURITY DEFINER de
// 0023_generation_progress.sql (Prompt 05.20.1). Aucune logique métier
// ici — seulement la traduction entre les appels Supabase et des types
// TypeScript exploitables par les routes /api/courses/generate/* et
// /api/analysis/generate/*. Le client ne peut JAMAIS appeler ces RPC
// directement pour falsifier une progression : elles exigent auth.uid()
// et vérifient la propriété de la réservation côté serveur, mais
// surtout ces enveloppes ne sont importées que par du code serveur
// ("use server"/route handlers), jamais par un composant client.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReservationKind } from "@/lib/courses/reservation";

export type StartGenerationTaskResult =
  | { ok: true; reservationId: string; alreadyExisted: boolean }
  | { ok: false; isPro: boolean; limitCount: number; usedCount: number };

export async function startGenerationTask(
  supabase: SupabaseClient,
  kind: ReservationKind,
  idempotencyKey: string,
  input: unknown,
): Promise<StartGenerationTaskResult> {
  const { data, error } = await supabase
    .rpc("start_generation_task", {
      p_kind: kind,
      p_idempotency_key: idempotencyKey,
      p_input: input,
    })
    .single<{
      reservation_id: string | null;
      already_existed: boolean;
      ok: boolean;
      is_pro: boolean | null;
      limit_count: number | null;
      used_count: number | null;
    }>();

  if (error || !data) {
    throw new Error(`Échec du démarrage de la génération : ${error?.message ?? "réponse vide"}`);
  }

  if (!data.ok) {
    return {
      ok: false,
      isPro: Boolean(data.is_pro),
      limitCount: data.limit_count ?? 0,
      usedCount: data.used_count ?? 0,
    };
  }

  return {
    ok: true,
    reservationId: data.reservation_id as string,
    alreadyExisted: data.already_existed,
  };
}

export type ClaimGenerationStepResult =
  | { claimed: true; input: unknown; progress: unknown; reservationStatus: string }
  | { claimed: false; reason: "not_found" | "already_in_progress" | "already_resolved" | string; reservationStatus: string | null };

export async function claimGenerationStep(
  supabase: SupabaseClient,
  reservationId: string,
  claimToken: string,
): Promise<ClaimGenerationStepResult> {
  const { data, error } = await supabase
    .rpc("claim_generation_step", {
      p_reservation_id: reservationId,
      p_claim_token: claimToken,
    })
    .single<{
      claimed: boolean;
      reason: string | null;
      input: unknown;
      progress: unknown;
      reservation_status: string | null;
    }>();

  if (error || !data) {
    throw new Error(`Échec de la réclamation d'étape : ${error?.message ?? "réponse vide"}`);
  }

  if (!data.claimed) {
    return {
      claimed: false,
      reason: data.reason ?? "unknown",
      reservationStatus: data.reservation_status,
    };
  }

  return {
    claimed: true,
    input: data.input,
    progress: data.progress,
    reservationStatus: data.reservation_status as string,
  };
}

export async function commitGenerationStep(
  supabase: SupabaseClient,
  reservationId: string,
  claimToken: string,
  progressPatch: Record<string, unknown>,
): Promise<{ ok: boolean; reason: string | null }> {
  const { data, error } = await supabase
    .rpc("commit_generation_step", {
      p_reservation_id: reservationId,
      p_claim_token: claimToken,
      p_progress_patch: progressPatch,
    })
    .single<{ ok: boolean; reason: string | null }>();

  if (error || !data) {
    throw new Error(`Échec de l'enregistrement de l'étape : ${error?.message ?? "réponse vide"}`);
  }
  return data;
}

export async function failGenerationStep(
  supabase: SupabaseClient,
  reservationId: string,
  claimToken: string,
  errorMessage: string,
): Promise<{ ok: boolean; reason: string | null }> {
  const { data, error } = await supabase
    .rpc("fail_generation_step", {
      p_reservation_id: reservationId,
      p_claim_token: claimToken,
      p_error: errorMessage,
    })
    .single<{ ok: boolean; reason: string | null }>();

  if (error || !data) {
    // Échec silencieux volontaire (même principe que releaseReservation,
    // reservation.ts) : un raté ici ne doit jamais faire planter la
    // réponse d'erreur déjà en cours de construction vers le client.
    return { ok: false, reason: error?.message ?? "réponse vide" };
  }
  return data;
}

export type GenerationProgressSummary = {
  found: boolean;
  reservationStatus: string | null;
  stage: string | null;
  attemptCount: number | null;
  lastError: string | null;
};

export async function getGenerationProgressSummary(
  supabase: SupabaseClient,
  reservationId: string,
): Promise<GenerationProgressSummary> {
  const { data, error } = await supabase
    .rpc("get_generation_progress_summary", { p_reservation_id: reservationId })
    .single<{
      found: boolean;
      reservation_status: string | null;
      stage: string | null;
      attempt_count: number | null;
      last_error: string | null;
    }>();

  if (error || !data) {
    return { found: false, reservationStatus: null, stage: null, attemptCount: null, lastError: null };
  }

  return {
    found: data.found,
    reservationStatus: data.reservation_status,
    stage: data.stage,
    attemptCount: data.attempt_count,
    lastError: data.last_error,
  };
}
