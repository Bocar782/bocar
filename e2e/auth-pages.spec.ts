import { test, expect } from "@playwright/test";

// Prompt 05.18 — vrai navigateur, vrai `next dev`, vrai code applicatif
// (actions serveur réelles, aucun mock). Voir e2e/README.md : la
// validation HTML5 côté client (minLength, required) s'exécute entièrement
// dans le navigateur, sans aucun appel réseau — pleinement réelle et fiable
// ici. Une soumission qui PASSE cette validation déclenche ensuite un vrai
// appel serveur vers Supabase, qui échoue dans cet environnement pour des
// raisons réseau (voir README) : on vérifie alors la dégradation
// (message générique, jamais de crash), pas le message métier spécifique
// ("mot de passe incorrect", etc.), qui nécessite une vraie connectivité.

test.describe("Connexion (/login)", () => {
  test("affiche le formulaire avec les deux champs requis", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Mot de passe")).toBeVisible();
    await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
  });

  test("le lien 'Créer un compte' mène à /signup", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: /créer un compte/i }).click();
    await expect(page).toHaveURL(/\/signup/);
  });

  test("le lien 'Mot de passe oublié ?' mène à /forgot-password", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: /mot de passe oublié/i }).click();
    await expect(page).toHaveURL(/\/forgot-password/);
  });

  test("une tentative de connexion échoue proprement (jamais de crash, jamais de détail technique)", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("utilisateur-test-05-18@example.com");
    await page.getByLabel("Mot de passe").fill("un-mot-de-passe-quelconque");
    await page.getByRole("button", { name: "Se connecter" }).click();

    // La page reste sur /login (aucune redirection vers /dashboard) et
    // affiche un message d'erreur lisible — jamais de page d'erreur Next.js
    // ni de stack trace exposée.
    await expect(page.getByText(/erreur|incorrect|invalide/i)).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/ENOTFOUND|fetch failed|TypeError|at Object\.|node_modules/i);
  });
});

test.describe("Inscription (/signup)", () => {
  test("affiche le formulaire avec les trois champs requis", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Mot de passe", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Confirme le mot de passe")).toBeVisible();
  });

  test("bloque côté navigateur un mot de passe trop court, sans jamais soumettre (validation HTML5 réelle)", async ({ page }) => {
    await page.goto("/signup");
    const email = `e2e-${Date.now()}@example.com`;
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Mot de passe", { exact: true }).fill("short1");
    await page.getByLabel("Confirme le mot de passe").fill("short1");
    await page.getByRole("button", { name: "Créer mon compte" }).click();

    // minLength=8 empêche la soumission : toujours sur /signup, formulaire
    // toujours affiché (jamais le message de succès ni d'erreur serveur).
    await expect(page).toHaveURL(/\/signup/);
    await expect(page.getByLabel("Email")).toBeVisible();
  });

  test("affiche une erreur serveur lisible si les mots de passe ne correspondent pas (validation serveur réelle)", async ({ page }) => {
    await page.goto("/signup");
    const email = `e2e-${Date.now()}@example.com`;
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Mot de passe", { exact: true }).fill("motdepasse123");
    await page.getByLabel("Confirme le mot de passe").fill("autremotdepasse456");
    await page.getByRole("button", { name: "Créer mon compte" }).click();

    await expect(page.getByText("Les mots de passe ne correspondent pas.")).toBeVisible();
    await expect(page).toHaveURL(/\/signup/);
  });
});

test.describe("Mot de passe oublié (/forgot-password)", () => {
  test("affiche le formulaire avec le champ email", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /envoyer le lien de réinitialisation/i }),
    ).toBeVisible();
  });

  test("une soumission échoue proprement (jamais de crash) — voir e2e/README.md pour la limite de connectivité", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(`e2e-${Date.now()}@example.com`);
    await page.getByRole("button", { name: /envoyer le lien de réinitialisation/i }).click();

    await expect(page).toHaveURL(/\/forgot-password/);
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/ENOTFOUND|fetch failed|TypeError|at Object\.|node_modules/i);
  });
});

test.describe("Réinitialisation (/update-password) sans session de récupération", () => {
  test("redirige vers /forgot-password quand on y accède directement, sans lien valide (non connecté)", async ({ page }) => {
    await page.goto("/update-password");
    await expect(page).toHaveURL(/\/forgot-password/);
  });
});
