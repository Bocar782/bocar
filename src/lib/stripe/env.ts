import "server-only";

export function getStripeSecretKey(): string {
  const value = process.env.STRIPE_SECRET_KEY;
  if (!value) {
    throw new Error("Variable d'environnement manquante : STRIPE_SECRET_KEY");
  }
  return value;
}

export function getStripePriceId(): string {
  const value = process.env.STRIPE_PRICE_ID;
  if (!value) {
    throw new Error("Variable d'environnement manquante : STRIPE_PRICE_ID");
  }
  return value;
}

export function getStripeWebhookSecret(): string {
  const value = process.env.STRIPE_WEBHOOK_SECRET;
  if (!value) {
    throw new Error("Variable d'environnement manquante : STRIPE_WEBHOOK_SECRET");
  }
  return value;
}
