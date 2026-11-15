import type { SupabaseClient } from "@supabase/supabase-js";
import { countDeepAnalysesSince } from "@/lib/analysis/persist";
import { countGenerationsSince, countTotalGenerations } from "./persist";

// Règles du plan gratuit / Pro.
export const FREE_PLAN_COURSE_LIMIT = 1; // à vie
export const FREE_PLAN_UNLOCKED_CHAPTERS = 2;
export const PRO_PLAN_PRICE_EUR = 9.99;
export const PRO_PLAN_MONTHLY_COURSE_LIMIT = 3; // réinitialisé à chaque période de facturation

// L'analyse approfondie coûte nettement plus cher (recherche web + génération
// longue) qu'une formation classique : réservée au plan Pro, quota mensuel
// plus restrictif.
export const FREE_PLAN_ANALYSIS_LIMIT = 0;
export const PRO_PLAN_MONTHLY_ANALYSIS_LIMIT = 2;

// Statuts Stripe qui donnent accès au plan Pro (un abonnement "past_due" ou
// "incomplete" ne débloque pas l'accès tant que le paiement n'est pas confirmé).
const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

type SubscriptionRow = {
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
};

async function getActiveSubscription(
  supabase: SupabaseClient,
  userId: string,
): Promise<SubscriptionRow | null> {
  const { data } = await supabase
    .from("subscriptions")
    .select("status, current_period_start, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data || !ACTIVE_SUBSCRIPTION_STATUSES.has(data.status)) return null;
  return data as SubscriptionRow;
}

export async function isOnFreePlan(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  return (await getActiveSubscription(supabase, userId)) === null;
}

export type UsageStatus = {
  isPro: boolean;
  used: number;
  limit: number;
  remaining: number;
  /** Date de réinitialisation du quota (fin de période de facturation), uniquement pour le plan Pro. */
  resetsAt: string | null;
};

export async function getUsageStatus(
  supabase: SupabaseClient,
  userId: string,
): Promise<UsageStatus> {
  const subscription = await getActiveSubscription(supabase, userId);

  if (subscription) {
    const since = subscription.current_period_start ?? new Date(0).toISOString();
    const used = await countGenerationsSince(supabase, userId, since);
    return {
      isPro: true,
      used,
      limit: PRO_PLAN_MONTHLY_COURSE_LIMIT,
      remaining: Math.max(0, PRO_PLAN_MONTHLY_COURSE_LIMIT - used),
      resetsAt: subscription.current_period_end,
    };
  }

  const used = await countTotalGenerations(supabase, userId);
  return {
    isPro: false,
    used,
    limit: FREE_PLAN_COURSE_LIMIT,
    remaining: Math.max(0, FREE_PLAN_COURSE_LIMIT - used),
    resetsAt: null,
  };
}

export async function getAnalysisUsageStatus(
  supabase: SupabaseClient,
  userId: string,
): Promise<UsageStatus> {
  const subscription = await getActiveSubscription(supabase, userId);

  // Réservée au plan Pro : un utilisateur gratuit n'a aucune génération
  // disponible, quel que soit son historique.
  if (!subscription) {
    return {
      isPro: false,
      used: 0,
      limit: FREE_PLAN_ANALYSIS_LIMIT,
      remaining: FREE_PLAN_ANALYSIS_LIMIT,
      resetsAt: null,
    };
  }

  const since = subscription.current_period_start ?? new Date(0).toISOString();
  const used = await countDeepAnalysesSince(supabase, userId, since);
  return {
    isPro: true,
    used,
    limit: PRO_PLAN_MONTHLY_ANALYSIS_LIMIT,
    remaining: Math.max(0, PRO_PLAN_MONTHLY_ANALYSIS_LIMIT - used),
    resetsAt: subscription.current_period_end,
  };
}
