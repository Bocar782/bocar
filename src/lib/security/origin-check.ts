import { NextResponse } from "next/server";
import { isAllowedOrigin } from "./allowed-origins";

// Prompt 05.16.4 (correction M3 de l'audit 05.16.3) : défense en profondeur
// CSRF pour les Route Handlers authentifiés par cookie. Les Server Actions
// Next.js ("use server") comparent déjà automatiquement `Origin` à `Host`/
// `X-Forwarded-Host` et rejettent toute requête en désaccord — garantie du
// framework, non modifiée ici (voir
// node_modules/next/dist/docs/01-app/02-guides/server-actions.md). Les
// Route Handlers ("export async function POST") n'ont AUCUNE vérification
// de ce type intégrée à Next.js : ce contrôle leur ajoute explicitement la
// même protection.
//
// Ne fait JAMAIS confiance à `Host`/`X-Forwarded-Host` (falsifiables par un
// intermédiaire) : la comparaison se fait uniquement contre la liste
// explicite `getAllowedOrigins()` (voir allowed-origins.ts), jamais contre
// un en-tête de la requête elle-même.
//
// Absence d'en-tête `Origin` : volontairement laissée passer, jamais
// bloquée. Ces routes restent de toute façon protégées par
// l'authentification par cookie (`SameSite=Lax`, voir audit 05.16.3) — ce
// contrôle est une couche additionnelle, pas la seule barrière — et
// certains clients légitimes (anciens navigateurs, certains contextes
// same-origin) n'envoient pas toujours cet en-tête : le refuser créerait un
// blocage injustifié sans bénéfice de sécurité réel (un attaquant qui
// forge une requête contrôle, lui, parfaitement les en-têtes qu'il envoie —
// omettre `Origin` ne l'aide jamais à contourner ce contrôle, puisqu'une
// requête cross-site forgée avec `Origin` présent serait de toute façon
// rejetée par la vérification ci-dessous).
export function checkRequestOrigin(request: Request): NextResponse | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;

  if (!isAllowedOrigin(origin)) {
    return NextResponse.json({ error: "Origine non autorisée." }, { status: 403 });
  }

  return null;
}
