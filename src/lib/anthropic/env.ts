import "server-only";

export function getAnthropicApiKey(): string {
  const value = process.env.ANTHROPIC_API_KEY;
  if (!value) {
    throw new Error("Variable d'environnement manquante : ANTHROPIC_API_KEY");
  }
  return value;
}
