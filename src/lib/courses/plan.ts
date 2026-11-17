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

// Source de vérité unique pour les avantages affichés aux visiteurs/utilisateurs
// (landing page ET /pricing, voir components/marketing/pricing-section.tsx et
// src/app/pricing/page.tsx) — Prompt 05.13, pour qu'il soit structurellement
// impossible que les deux pages divergent : chacune se contente de faire
// `.map()` sur ces tableaux plutôt que de répéter son propre texte.
//
// Chaque ligne correspond à une restriction/fonctionnalité RÉELLEMENT
// appliquée dans le code, vérifiée avant rédaction (Prompt 05.13) :
// - Le verrouillage des chapitres/quiz au-delà de FREE_PLAN_UNLOCKED_CHAPTERS
//   est appliqué dans course-view.tsx (CourseView, `locked`/`isLockedForThisCourse`).
// - Le chat (chapter-chat.tsx) reste disponible sur le plan gratuit, mais
//   seulement dans le contexte des chapitres débloqués (`maxChapterIndex`,
//   voir course-generator.tsx / dashboard/formations/[id]/page.tsx) : ce
//   n'est donc PAS une fonctionnalité exclusive au plan Pro, seulement son
//   périmètre qui change — d'où la formulation ci-dessous.
// - L'historique des formations et des tentatives de quiz (listCourses,
//   getQuizAttemptHistory) n'est restreint par AUCUNE vérification de plan
//   dans le code : ce n'est donc jamais listé ici comme un avantage Pro à
//   part entière, seulement une conséquence du quota de formations/mois.
export const FREE_PLAN_FEATURES: readonly string[] = [
  `${FREE_PLAN_COURSE_LIMIT} formation complète générée par Tavyra`,
  `Les ${FREE_PLAN_UNLOCKED_CHAPTERS} premiers chapitres en accès libre`,
];

/** Limite affichée séparément (ton visuel "—" plutôt que "✓") sur les deux pages. */
export const FREE_PLAN_LIMITATION = "Chapitres suivants et quiz verrouillés";

export const PRO_PLAN_FEATURES: readonly string[] = [
  `${PRO_PLAN_MONTHLY_COURSE_LIMIT} formations générées par mois (quota renouvelé à chaque période de facturation)`,
  "Accès complet à chaque formation : chapitres, quiz de module et quiz final, sans restriction",
  "Le chat avec Tavyra disponible sur toute la formation, pas seulement les premiers chapitres",
  `${PRO_PLAN_MONTHLY_ANALYSIS_LIMIT} analyses approfondies par mois`,
];

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

  // Filet de sécurité (Prompt 05.17.3, audit 05.17 — "passage automatique
  // de Pro à Free lorsque les droits Pro ne sont plus valides") : si la
  // période de facturation actuelle est déjà entièrement écoulée alors que
  // `status` indique encore 'active'/'trialing' (ex. le webhook Stripe
  // marquant la vraie fin de période n'est jamais arrivé), ne jamais
  // accorder l'accès Pro au-delà de ce qui a réellement été payé. N'a
  // aucun effet pendant une annulation programmée (`cancel_at_period_end`) :
  // `current_period_end` reste dans le futur jusqu'à la fin réelle de la
  // période payée, exactement comme souhaité.
  if (data.current_period_end && new Date(data.current_period_end) < new Date()) {
    return null;
  }

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

async function computeUsageStatus(
  subscription: SubscriptionRow | null,
  supabase: SupabaseClient,
  userId: string,
): Promise<UsageStatus> {
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

async function computeAnalysisUsageStatus(
  subscription: SubscriptionRow | null,
  supabase: SupabaseClient,
  userId: string,
): Promise<UsageStatus> {
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

export async function getUsageStatus(
  supabase: SupabaseClient,
  userId: string,
): Promise<UsageStatus> {
  const subscription = await getActiveSubscription(supabase, userId);
  return computeUsageStatus(subscription, supabase, userId);
}

export async function getAnalysisUsageStatus(
  supabase: SupabaseClient,
  userId: string,
): Promise<UsageStatus> {
  const subscription = await getActiveSubscription(supabase, userId);
  return computeAnalysisUsageStatus(subscription, supabase, userId);
}

/**
 * Prompt 05.19/05.20 (optimisation) : équivalent exact d'appeler
 * `getUsageStatus` PUIS `getAnalysisUsageStatus` (même résultat, mêmes
 * règles), mais ne lit l'abonnement Stripe/Supabase qu'UNE SEULE fois au
 * lieu de deux — les deux fonctions ci-dessus refont chacune cette même
 * requête (`subscriptions` filtrée par `user_id`) alors qu'elle ne dépend
 * que de l'utilisateur, jamais du type de quota. Repéré sur le tableau de
 * bord (`dashboard/page.tsx`), où les deux étaient déjà appelées en
 * parallèle via `Promise.all` — donc déjà deux allers-retours réseau
 * identiques lancés simultanément, jamais un vrai gain de latence, juste
 * une requête Supabase redondante à chaque chargement du tableau de bord.
 */
export async function getUsageStatuses(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ course: UsageStatus; analysis: UsageStatus }> {
  const subscription = await getActiveSubscription(supabase, userId);
  const [course, analysis] = await Promise.all([
    computeUsageStatus(subscription, supabase, userId),
    computeAnalysisUsageStatus(subscription, supabase, userId),
  ]);
  return { course, analysis };
}
