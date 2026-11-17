import { test, expect } from "@playwright/test";

// Prompt 05.18 — vrai navigateur, vrai `next dev`, vrai code applicatif.
// Pages publiques : aucune dépendance à une session Supabase authentifiée
// (voir e2e/README.md), donc pleinement testables ici sans aucun mock.

test.describe("Landing page", () => {
  test("se charge, affiche le titre et les CTA principaux", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.getByRole("link", { name: /connexion/i })).toBeVisible();
  });

  test("la page /pricing est bien accessible", async ({ page }) => {
    const response = await page.goto("/pricing");
    expect(response?.status()).toBe(200);
  });

  test("s'affiche correctement sur mobile (390px) sans débordement horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(hasHorizontalOverflow).toBe(false);
  });
});

test.describe("Pages légales et pricing", () => {
  test("/pricing affiche les deux plans pour un visiteur non connecté", async ({ page }) => {
    const response = await page.goto("/pricing");
    expect(response?.status()).toBe(200);
    await expect(page.getByText("Gratuit").first()).toBeVisible();
    await expect(page.getByText(/^pro$/i).first()).toBeVisible();
    // Visiteur non connecté : lien de connexion visible, jamais un lien
    // direct vers le dashboard.
    await expect(page.getByRole("link", { name: /connexion/i })).toBeVisible();
  });

  test("/confidentialite se charge sans erreur", async ({ page }) => {
    const response = await page.goto("/confidentialite");
    expect(response?.status()).toBe(200);
  });

  test("/conditions-utilisation se charge sans erreur", async ({ page }) => {
    const response = await page.goto("/conditions-utilisation");
    expect(response?.status()).toBe(200);
  });

  test("/pourquoi-nous se charge sans erreur", async ({ page }) => {
    const response = await page.goto("/pourquoi-nous");
    expect(response?.status()).toBe(200);
  });
});

test.describe("Page 404", () => {
  test("une route inexistante renvoie une 404 propre, sans crash serveur", async ({ page }) => {
    const response = await page.goto("/cette-page-n-existe-pas");
    expect(response?.status()).toBe(404);
  });
});
