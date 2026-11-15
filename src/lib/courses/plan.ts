// Règles du plan gratuit. Il n'existe pas encore de système d'abonnement
// (pas de Stripe, pas de table "plan" sur les utilisateurs) : tout le monde
// est donc sur le plan gratuit pour l'instant. `isOnFreePlan` est le point
// unique à modifier le jour où un vrai plan payant existera (il prendra
// alors l'utilisateur en paramètre pour vérifier son abonnement réel).

export const FREE_PLAN_COURSE_LIMIT = 1;
export const FREE_PLAN_UNLOCKED_CHAPTERS = 2;

export function isOnFreePlan(): boolean {
  return true;
}
