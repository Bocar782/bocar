import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseCookieOptions } from "./cookie-options";
import { getSupabasePublishableKey, getSupabaseUrl } from "./env";

// Client à utiliser dans les Server Components, Server Actions et Route
// Handlers. Respecte la session de l'utilisateur courant et les policies RLS.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    cookieOptions: getSupabaseCookieOptions(),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Appelé depuis un Server Component : le rafraîchissement de
          // session est déjà géré par le proxy, cet appel peut être ignoré.
        }
      },
    },
  });
}
