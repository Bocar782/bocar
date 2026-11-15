import "server-only";
import Stripe from "stripe";
import { getStripeSecretKey } from "./env";

// Client Stripe — serveur uniquement. La clé secrète ne doit jamais atteindre
// le bundle navigateur : pas de préfixe NEXT_PUBLIC_, pas d'import depuis un
// composant client. Dans cet environnement de développement, la valeur lue
// est un placeholder : le proxy réseau la remplace par la vraie clé secrète
// à chaque appel vers api.stripe.com.
export function createStripeClient(): Stripe {
  // httpClient basé sur fetch : seul client du SDK qui respecte le proxy
  // réseau de cet environnement (voir NODE_USE_ENV_PROXY dans .env.local).
  return new Stripe(getStripeSecretKey(), {
    httpClient: Stripe.createFetchHttpClient(),
  });
}
