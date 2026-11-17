// Prompt 05.16.4 (correction M3 de l'audit 05.16.3) : attribut `Secure`
// explicite sur les cookies d'authentification Supabase (`sb-*`), absent
// jusqu'ici car `@supabase/ssr` ne le fixe pas par défaut (voir
// node_modules/@supabase/ssr/dist/module/utils/constants.js,
// `DEFAULT_COOKIE_OPTIONS`). Partagé entre `server.ts` et `proxy.ts` —
// les deux seuls endroits qui appellent `createServerClient` — pour que
// les deux restent synchronisés par construction, jamais par convention.
//
// Ne fixe QUE `secure` : `sameSite`/`httpOnly` ne sont pas repris ici, donc
// `@supabase/ssr` continue d'appliquer ses propres défauts pour ces deux
// attributs (`sameSite: "lax"`, `httpOnly: false`) — aucun des deux n'est
// modifié par cette tâche (voir le rapport : `httpOnly` reste à `false`
// volontairement, non forcé à `true`).
//
// `secure: false` en développement local (`npm run dev` sert en HTTP sur
// localhost) : un cookie `Secure` n'est jamais envoyé par le navigateur sur
// une origine non-HTTPS, donc le fixer à `true` inconditionnellement
// casserait la connexion en local. `secure: true` uniquement quand
// `NODE_ENV === "production"` (valeur réelle pendant `next build`/
// `next start`, y compris sur Netlify).
export function getSupabaseCookieOptions(): { secure: boolean } {
  return { secure: process.env.NODE_ENV === "production" };
}
