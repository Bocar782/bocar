import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey } from "./env";

// Client Anthropic — serveur uniquement. La clé API ne doit jamais atteindre
// le bundle navigateur : pas de préfixe NEXT_PUBLIC_, pas d'import depuis un
// composant client.
export function createAnthropicClient() {
  return new Anthropic({ apiKey: getAnthropicApiKey() });
}
