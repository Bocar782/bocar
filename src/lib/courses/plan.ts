import type { SupabaseClient } from "@supabase/supabase-js";

// Règles du plan gratuit / Pro.
export const FREE_PLAN_COURSE_LIMIT = 1;
export const FREE_PLAN_UNLOCKED_CHAPTERS = 2;
export const PRO_PLAN_PRICE_EUR = 9.99;

// Statuts Stripe qui donnent accès au plan Pro (un abonnement "past_due" ou
// "incomplete" ne débloque pas l'accès tant que le paiement n'est pas confirmé).
const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

export async function isOnFreePlan(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("subscriptions")
    .select("status")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return true;
  return !ACTIVE_SUBSCRIPTION_STATUSES.has(data.status);
}
