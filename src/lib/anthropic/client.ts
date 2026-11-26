import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { isOfflineAI } from "@/lib/courses/offline";
import { getAnthropicApiKey } from "./env";

// Client Anthropic — serveur uniquement. La clé API ne doit jamais atteindre
// le bundle navigateur : pas de préfixe NEXT_PUBLIC_, pas d'import depuis un
// composant client.
//
// `maxRetries`/`timeout` explicites (Prompt 05.9, corrigé) plutôt que les
// valeurs par défaut implicites du SDK (`maxRetries: 2`, `timeout: 600000`
// soit 10 min par appel, vérifiées dans @anthropic-ai/sdk) :
// - `maxRetries: 2` : on garde la valeur par défaut du SDK (déjà raisonnable
//   pour absorber une erreur transitoire) mais rendue explicite, pour ne
//   jamais en hériter silencieusement d'un futur changement du SDK et pour
//   éviter des retries excessifs qui multiplieraient les coûts.
// - `timeout: 120_000` (2 min) : largement suffisant pour UN appel de
//   génération (une leçon, un quiz de module, un résumé), et surtout borné
//   pour qu'un seul appel bloqué ne consomme pas, à lui seul, tout le budget
//   de la route (voir `maxDuration` dans route.ts) alors que plusieurs
//   leçons sont désormais écrites par vagues successives (concurrence
//   limitée à 4, voir generate.ts).
export function createAnthropicClient() {
  // Verrou du mode test (voir lib/courses/offline.ts) : même si un chemin
  // de code oubliait de vérifier isOfflineAI(), aucune requête ne peut
  // partir vers Anthropic — le client échoue localement, sans réseau.
  if (isOfflineAI()) {
    return new Anthropic({
      apiKey: "mode-test-sans-appel",
      maxRetries: 0,
      fetch: async () => {
        throw new Error("Mode test actif : aucun appel à l'API Anthropic n'est autorisé.");
      },
    });
  }
  return new Anthropic({
    apiKey: getAnthropicApiKey(),
    maxRetries: 2,
    timeout: 120_000,
  });
}
