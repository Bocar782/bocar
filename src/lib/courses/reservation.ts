import type { SupabaseClient } from "@supabase/supabase-js";

export type ReservationKind = "course" | "analysis";

export class QuotaExceededError extends Error {
  constructor(
    message: string,
    public readonly isPro: boolean,
    public readonly limitCount: number,
  ) {
    super(message);
  }
}

type ReserveRpcRow = {
  ok: boolean;
  reservation_id: string | null;
  is_pro: boolean;
  limit_count: number;
  used_count: number;
};

function quotaExceededMessage(kind: ReservationKind, isPro: boolean, limitCount: number): string {
  if (!isPro) {
    return kind === "course"
      ? `Le plan gratuit est limité à ${limitCount} formation${limitCount > 1 ? "s" : ""}. Débloque la formation complète pour continuer.`
      : "L'analyse approfondie est réservée au plan Pro. Abonne-toi pour y accéder.";
  }
  const noun = kind === "course" ? "formations" : "analyses approfondies";
  return `Tu as atteint la limite de ${limitCount} ${noun} pour cette période de facturation. Le quota se réinitialise à ton prochain renouvellement.`;
}

/**
 * Réserve de façon atomique une place de génération (formation classique ou
 * analyse approfondie), avant tout appel à l'API Anthropic. Le plan
 * (gratuit/Pro) de l'utilisateur ET les limites elles-mêmes sont déterminés
 * entièrement côté base de données, à l'intérieur de la fonction RPC (voir
 * supabase/migrations/0007_generation_reservations.sql) : rien n'est transmis
 * depuis ce client. C'est volontaire — cette fonction est accordée au rôle
 * `authenticated`, donc appelable directement depuis le navigateur avec le
 * JWT de l'utilisateur ; si les limites étaient des paramètres, n'importe qui
 * pourrait appeler le RPC directement avec des valeurs arbitraires et
 * contourner le quota.
 *
 * Lève `QuotaExceededError` si aucune place n'est disponible. Toute autre
 * erreur (échec de la réservation elle-même, ex. panne transitoire) est
 * remontée telle quelle : on échoue "fermé" plutôt que de laisser passer une
 * génération sans réservation valide.
 */
export async function reserveGenerationSlot(
  supabase: SupabaseClient,
  kind: ReservationKind,
): Promise<string> {
  const { data, error } = await supabase
    .rpc("reserve_generation_slot", { p_kind: kind })
    .single<ReserveRpcRow>();

  if (error || !data) {
    throw new Error(`Échec de la réservation de quota : ${error?.message ?? "réponse vide"}`);
  }

  if (!data.ok) {
    throw new QuotaExceededError(
      quotaExceededMessage(kind, data.is_pro, data.limit_count),
      data.is_pro,
      data.limit_count,
    );
  }

  // `data.reservation_id` est garanti non nul par la fonction SQL quand ok=true.
  return data.reservation_id as string;
}

async function resolveReservation(
  supabase: SupabaseClient,
  reservationId: string,
  status: "completed" | "released",
  resourceId: string | null,
): Promise<void> {
  try {
    await supabase.rpc("resolve_generation_slot", {
      p_reservation_id: reservationId,
      p_status: status,
      p_resource_id: resourceId,
    });
  } catch (err) {
    // Échec silencieux volontaire, comme pour le reste du tracking
    // applicatif de ce projet : un raté ici ne doit jamais faire planter une
    // génération déjà terminée. La réservation sera de toute façon traitée
    // comme abandonnée après 15 minutes par reserve_generation_slot() si
    // elle reste bloquée en "pending".
    console.error("resolve_generation_slot a échoué :", err);
  }
}

/** Marque une réservation comme effectivement consommée (génération sauvegardée avec succès). */
export function consumeReservation(
  supabase: SupabaseClient,
  reservationId: string,
  resourceId: string | null,
): Promise<void> {
  return resolveReservation(supabase, reservationId, "completed", resourceId);
}

/** Libère une réservation qui n'a pas abouti (génération ou sauvegarde en échec). */
export function releaseReservation(
  supabase: SupabaseClient,
  reservationId: string,
): Promise<void> {
  return resolveReservation(supabase, reservationId, "released", null);
}
