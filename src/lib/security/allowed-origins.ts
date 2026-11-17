import { getSiteUrl } from "@/lib/site-url";

// Prompt 05.16.4 (correction M3 de l'audit 05.16.3) : liste blanche
// explicite des origines autorisées à appeler les routes authentifiées par
// cookie. Construite uniquement à partir de configuration applicative
// connue — jamais à partir de `Host`/`X-Forwarded-Host` de la requête
// elle-même, qui peuvent être falsifiés par un intermédiaire (proxy, CDN
// mal configuré) et ne doivent donc jamais servir de base à ce contrôle
// (voir origin-check.ts, qui consomme cette liste).
//
// - `getSiteUrl()` : l'origine canonique configurée de l'application
//   (NEXT_PUBLIC_SITE_URL en production, ou le fallback de développement
//   local http://localhost:3000).
// - `ADDITIONAL_ALLOWED_ORIGINS` (variable d'environnement optionnelle,
//   liste séparée par des virgules) : pour une origine supplémentaire
//   légitime et explicitement voulue (ex. une URL de prévisualisation
//   figée) — vide par défaut, jamais devinée ni inventée ici.
function parseAdditionalOrigins(): string[] {
  const raw = process.env.ADDITIONAL_ALLOWED_ORIGINS;
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function getAllowedOrigins(): string[] {
  const origins = new Set<string>();
  for (const candidate of [getSiteUrl(), ...parseAdditionalOrigins()]) {
    try {
      origins.add(new URL(candidate).origin);
    } catch {
      // Valeur de configuration malformée : ignorée plutôt que de risquer
      // de fausser silencieusement la vérification (ex. une chaîne vide
      // propagée jusqu'ici créerait une origine invalide, jamais une
      // origine qui matcherait accidentellement une requête réelle).
    }
  }
  return [...origins];
}

export function isAllowedOrigin(origin: string): boolean {
  try {
    const normalized = new URL(origin).origin;
    return getAllowedOrigins().includes(normalized);
  } catch {
    return false;
  }
}
