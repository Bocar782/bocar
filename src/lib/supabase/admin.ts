import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabaseSecretKey, getSupabaseUrl } from "./env";

// Client privilégié (clé secrète, contourne les policies RLS). Réservé aux
// opérations serveur qui en ont explicitement besoin (webhooks Stripe,
// tâches admin) — ne jamais l'utiliser pour des requêtes au nom d'un
// utilisateur, ni l'importer depuis un composant client.
export function createAdminClient() {
  return createSupabaseClient(getSupabaseUrl(), getSupabaseSecretKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
