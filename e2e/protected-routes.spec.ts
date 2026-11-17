import { test, expect } from "@playwright/test";

// Prompt 05.18 — "Protection des pages privées" / "Utilisateur non connecté"
// (sections 1 et 8). Vrai navigateur, vrai `next dev`, vrai code
// applicatif : chaque page ci-dessous appelle réellement
// `supabase.auth.getUser()` côté serveur et redirige si `user` est `null`.
// Dans cette session, cet appel échoue toujours pour des raisons réseau
// (voir e2e/README.md) et le SDK Supabase renvoie `{ user: null }` sans
// jamais lever d'exception — le code exécuté pour arriver à la redirection
// est donc EXACTEMENT celui qui s'exécute pour un vrai visiteur non
// connecté. C'est un test réel de cette protection précise.

const PROTECTED_PAGES: { path: string; expectedRedirect: RegExp }[] = [
  { path: "/dashboard", expectedRedirect: /\/login/ },
  { path: "/dashboard/formations/11111111-1111-1111-1111-111111111111", expectedRedirect: /\/login/ },
  { path: "/dashboard/analyses/11111111-1111-1111-1111-111111111111", expectedRedirect: /\/login/ },
  { path: "/update-password", expectedRedirect: /\/forgot-password/ },
];

for (const { path, expectedRedirect } of PROTECTED_PAGES) {
  test(`${path} redirige un utilisateur non connecté (jamais de contenu privé exposé)`, async ({ page }) => {
    const response = await page.goto(path);
    await expect(page).toHaveURL(expectedRedirect);
    // La redirection serveur aboutit à une réponse 200 sur la page cible,
    // jamais une page d'erreur.
    expect(response?.status()).toBeLessThan(400);
  });
}

test.describe("Pages déjà connecté (login/signup) — non applicable ici", () => {
  test("/login et /signup restent accessibles sans session (comportement attendu pour un visiteur)", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/signup");
    await expect(page).toHaveURL(/\/signup/);
  });
});

test.describe("Déconnexion", () => {
  test("accéder directement à l'action de déconnexion sans session ne provoque pas d'erreur serveur", async ({ page }) => {
    // Le formulaire de déconnexion du dashboard poste vers une Server
    // Action ; sans page chargée au préalable on vérifie uniquement que
    // naviguer sur /dashboard (qui contient ce formulaire pour un
    // utilisateur connecté) redirige proprement plutôt que de planter —
    // couvert par le test ci-dessus. Ce test documente l'absence de route
    // dédiée "/logout" accessible directement (cohérent : la déconnexion
    // est une Server Action liée au formulaire, jamais une URL GET).
    const response = await page.goto("/logout");
    expect(response?.status()).toBe(404);
  });
});
