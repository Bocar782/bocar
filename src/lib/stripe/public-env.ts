// Séparé de env.ts (marqué "server-only") : cette clé est volontairement
// publique et doit pouvoir être lue depuis un composant client (src/app/
// checkout/page.tsx, pour initialiser Stripe.js dans le navigateur).
export function getStripePublishableKey(): string {
  const value = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!value) {
    throw new Error("Variable d'environnement manquante : NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
  }
  return value;
}
