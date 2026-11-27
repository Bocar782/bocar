"use client";

import { useSyncExternalStore } from "react";

// "dark" = thème Violet (par défaut), "light" = Blanc, "noir" = Noir.
export type AppTheme = "dark" | "light" | "noir";

export const THEME_STORAGE_KEY = "tavyra:app-theme";

// Prompt 06.7 : thème clair/sombre de l'intérieur de l'app — un petit
// "store" externe partagé (pas de React Context) plutôt qu'un état propre à
// DashboardShell : la préférence vit dans localStorage (confort
// d'affichage par appareil, jamais une donnée du compte — aucune colonne en
// base), et useSyncExternalStore est le mécanisme React recommandé pour
// synchroniser un état avec une source externe comme celle-ci (lecture
// synchrone, évite l'avertissement react-hooks/set-state-in-effect qu'un
// useEffect + setState aurait déclenché ici). Changer le thème depuis
// Profil (ThemeToggle) notifie immédiatement toute instance de
// DashboardShell actuellement montée, sans rechargement de page.
const listeners = new Set<() => void>();

function readStoredTheme(): AppTheme {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "noir" ? stored : "dark";
  } catch {
    // Stockage indisponible (navigation privée stricte...) : thème sombre
    // par défaut, sans faire planter la page pour autant.
    return "dark";
  }
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

// Même valeur que le rendu serveur (qui n'a jamais accès à localStorage) :
// le thème réel n'est appliqué qu'après le montage côté client, pour ne
// jamais produire un avertissement d'hydratation.
function getServerSnapshot(): AppTheme {
  return "dark";
}

export function useAppTheme(): { theme: AppTheme; setTheme: (next: AppTheme) => void } {
  const theme = useSyncExternalStore(subscribe, readStoredTheme, getServerSnapshot);

  function setTheme(next: AppTheme) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // La préférence ne sera simplement pas mémorisée.
    }
    listeners.forEach((callback) => callback());
  }

  return { theme, setTheme };
}
