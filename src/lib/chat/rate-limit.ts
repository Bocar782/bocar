import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Levée quand l'utilisateur a atteint sa limite de messages (heure ou jour
 * glissants). Les limites elles-mêmes ne sont JAMAIS fixées ici : elles sont
 * entièrement déterminées côté base de données par `check_chat_rate_limit()`
 * (voir supabase/migrations/0016_chat_rate_limit.sql), à partir du vrai
 * statut d'abonnement de l'utilisateur — rien de transmis par ce client, et
 * rien de falsifiable depuis le navigateur. Les nombres affichés dans le
 * message viennent du RPC lui-même, jamais d'une constante dupliquée côté
 * TypeScript (aucun risque de désynchronisation).
 */
export class ChatRateLimitExceededError extends Error {
  constructor(
    message: string,
    public readonly isPro: boolean,
  ) {
    super(message);
  }
}

type RateLimitRpcRow = {
  ok: boolean;
  is_pro: boolean;
  limit_hour: number;
  used_hour: number;
  limit_day: number;
  used_day: number;
};

function rateLimitMessage(row: RateLimitRpcRow): string {
  if (row.used_day >= row.limit_day) {
    return `Tu as atteint la limite de ${row.limit_day} messages par jour pour le chat avec Tavyra. Réessaie demain.`;
  }
  return `Tu as atteint la limite de ${row.limit_hour} messages par heure pour le chat avec Tavyra. Réessaie dans un instant.`;
}

/**
 * Vérifie ET consomme atomiquement, côté serveur, une place dans la limite
 * de fréquence du chat pour l'utilisateur courant — AVANT tout appel à
 * l'API Anthropic (voir route.ts). Appelable directement depuis le
 * navigateur (le RPC est accordé au rôle `authenticated`), exactement comme
 * `reserveGenerationSlot` : aucun danger, puisque l'identité et les limites
 * sont toujours déterminées côté base de données, jamais par ce client.
 *
 * Lève `ChatRateLimitExceededError` si la limite (heure ou jour) est
 * atteinte. Toute autre erreur (échec du RPC lui-même, panne transitoire)
 * est remontée telle quelle : on échoue "fermé" plutôt que de laisser
 * passer un appel au modèle sans vérification valide.
 */
export async function checkChatRateLimit(supabase: SupabaseClient): Promise<void> {
  const { data, error } = await supabase
    .rpc("check_chat_rate_limit")
    .single<RateLimitRpcRow>();

  if (error || !data) {
    throw new Error(
      `Échec de la vérification de la limite de messages : ${error?.message ?? "réponse vide"}`,
    );
  }

  if (!data.ok) {
    throw new ChatRateLimitExceededError(rateLimitMessage(data), data.is_pro);
  }
}
