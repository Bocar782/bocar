import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_NEXT_PATH = "/dashboard";

// N'accepte qu'un chemin interne relatif, jamais une URL absolue ni une
// valeur qui pourrait être interprétée comme pointant vers un autre hôte.
// Doit commencer par un seul "/" (le lookahead négatif rejette "//...",
// une URL protocole-relative) et ne contenir ni espace/retour à la ligne ni
// backslash (certains navigateurs normalisent "/\" en "//", équivalent à un
// hôte distant) — tout le reste (schéma "https:", "javascript:", valeur
// vide/absente/malformée) ne commence de toute façon pas par "/" et est
// donc déjà rejeté par la même vérification.
const SAFE_NEXT_PATTERN = /^\/(?!\/)[^\s\\]*$/;

/**
 * Prompt 05.16.1 (correctif E2, audit de sécurité 05.16) : valide le
 * paramètre `next` avant de l'utiliser dans une redirection. Retombe sur
 * `/dashboard` pour toute valeur absente, vide, ou qui ne correspond pas
 * exactement à un chemin interne relatif — jamais une tentative de
 * "réparer" la valeur reçue (pas de retrait de préfixe, pas de décodage
 * supplémentaire) : une valeur qui ne passe pas la vérification est
 * intégralement rejetée.
 */
export function sanitizeNextPath(value: string | null): string {
  if (!value) return DEFAULT_NEXT_PATH;
  return SAFE_NEXT_PATTERN.test(value) ? value : DEFAULT_NEXT_PATH;
}

// Point d'entrée unique pour les liens envoyés par email (confirmation
// d'inscription, réinitialisation de mot de passe) : échange le code contre
// une session, puis redirige vers `next`.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=lien-invalide`);
}
