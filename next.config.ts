import type { NextConfig } from "next";

// Prompt 05.16.4 (corrections de l'audit 05.16.3, section M2) : en-têtes de
// sécurité HTTP. Testé en conditions réelles (build + `next start`, via un
// vrai navigateur Chromium/Playwright, voir le rapport de la tâche) avant
// d'arrêter cette configuration — pas seulement déduit de la documentation.
//
// Portée de la CSP vérifiée empiriquement sur le vrai HTML généré :
// * Les deux scripts JSON-LD de `src/app/page.tsx`
//   (`<script type="application/ld+json">`) ne sont PAS concernés par
//   `script-src`, quelle que soit sa valeur : un `type` qui n'est pas un
//   type MIME JavaScript fait que le navigateur ne les exécute jamais comme
//   script (ce sont des îlots de données, lus par les robots/outils SEO,
//   jamais interprétés) — confirmé en inspectant une vraie page construite
//   avec `script-src 'self'` nu (aucun hash, aucun nonce, aucun
//   'unsafe-inline') : zéro violation CSP sur ces deux blocs. Aucune mesure
//   spécifique (hash SHA-256 ou nonce) n'est donc nécessaire pour les
//   préserver : leur `type` est déjà, par construction, la protection
//   adaptée — ajouter un hash n'aurait aucun effet positif et désactiverait
//   'unsafe-inline' pour tout le reste de `script-src` (règle CSP : la
//   présence d'un hash/nonce fait ignorer 'unsafe-inline' par les
//   navigateurs modernes), ce qui casserait le point suivant.
// * Le vrai blocage constaté avec un `script-src 'self'` nu concernait
//   exclusivement les scripts inline que Next.js (App Router, Turbopack)
//   injecte lui-même pour l'hydratation RSC (`self.__next_f.push(...)`,
//   bootstrap Turbopack) — leur contenu dépend des chemins de chunks du
//   build et change à chaque build, donc impossible à figer par hash
//   statique ici. La seule alternative sans hash serait un CSP à nonce
//   généré par requête (voir doc Next.js officielle vendée dans ce repo,
//   `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`),
//   mais cela exige un rendu dynamique par requête (`await connection()`)
//   sur CHAQUE page qui en dépend — en pratique la quasi-totalité des pages
//   de l'app, y compris les pages statiques publiques actuelles (`/`,
//   `/confidentialite`, `/conditions-utilisation`, `/pourquoi-nous`) —,
//   donc une perte de mise en cache/optimisation statique disproportionnée
//   par rapport au gain réel : l'app ne contient aucun autre point
//   d'injection HTML (vérifié dans l'audit 05.16.3 : seul
//   `dangerouslySetInnerHTML` du JSON-LD, markdown rendu sans HTML brut).
//   `'unsafe-inline'` reste donc actif sur `script-src`, uniquement pour
//   permettre ce script interne à Next.js — la protection réellement utile
//   de cette directive (bloquer le chargement d'un script EXTERNE via
//   `<script src="https://domaine-attaquant...">`) reste pleinement
//   effective, puisqu'elle ne dépend pas de 'unsafe-inline'.
// * `style-src-attr 'unsafe-inline'` (distincte de `style-src`, qui reste
//   stricte) est nécessaire pour les barres de progression à largeur
//   dynamique (`style={{ width: ... }}` dans `course-list-item.tsx`,
//   `course-sidebar.tsx`, `interface-showcase.tsx`) — confirmé par test
//   réel : sans elle, ces éléments déclenchent une violation CSP en
//   production.
// * `img-src 'self' data:` : le `data:` est nécessaire pour un SVG de bruit
//   généré en `data:image/svg+xml` (fond animé) — découvert en testant la
//   page réelle, pas supposé a priori.
// * Aucun domaine externe n'apparaît nulle part : confirmé par l'audit
//   05.16.3 qu'aucun appel navigateur direct vers Supabase, Stripe ou
//   Anthropic n'existe (tout passe par les routes same-origin `/api/*` ou
//   par une redirection complète de page vers Stripe), et que les polices
//   (`next/font/google`) sont auto-hébergées au build.
//
// CSP et HSTS ne sont envoyées qu'en production (`NODE_ENV === "production"`) :
// testé que `next dev` (Turbopack) injecte des balises `<style>` inline
// pour le rafraîchissement à chaud et utilise `eval()` pour les piles
// d'appel de debug React — une CSP de production y déclenche des erreurs
// réelles (vérifié avec un vrai `next dev` + Chromium). Les trois autres
// en-têtes (nosniff, X-Frame-Options, Referrer-Policy) n'ont aucun effet
// sur le rendu ou le rechargement à chaud : ils restent actifs dans tous
// les environnements, y compris pour pouvoir les tester en local.
//
// HSTS : `max-age` volontairement modeste (180 jours) et SANS
// `includeSubDomains` ni `preload` — la configuration HTTPS réelle sur
// Netlify (redirection forcée, sous-domaines éventuels) n'a pas pu être
// vérifiée depuis ce dépôt (voir audit 05.16.3, section Netlify, et le
// rapport de cette tâche) ; l'augmenter et ajouter `includeSubDomains`/
// `preload` une fois cette configuration confirmée dans le tableau de bord.
const isProduction = process.env.NODE_ENV === "production";

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self'",
  "style-src-attr 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  ...(isProduction
    ? [
        { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
        { key: "Strict-Transport-Security", value: "max-age=15552000" },
      ]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
