// Vrai test : importe le vrai next.config.ts et exécute sa vraie fonction
// headers() — pas une copie de la liste d'en-têtes dans ce fichier de
// test. Complète la vérification par navigateur réel (Playwright, voir le
// rapport de la tâche 05.16.4) par une assertion unitaire rapide et
// reproductible en CI, sans dépendre d'un serveur démarré.
import { afterEach, describe, expect, it, vi } from "vitest";

async function loadHeaders() {
  vi.resetModules();
  const config = (await import("../../next.config")).default;
  const rules = await config.headers!();
  return rules[0].headers;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("next.config.ts — en-têtes de sécurité HTTP (Prompt 05.16.4)", () => {
  it("désactive l'en-tête X-Powered-By, en toutes circonstances", async () => {
    vi.resetModules();
    const config = (await import("../../next.config")).default;
    expect(config.poweredByHeader).toBe(false);
  });

  it("envoie nosniff / X-Frame-Options / Referrer-Policy même hors production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const headers = await loadHeaders();
    const byKey = Object.fromEntries(headers.map((h) => [h.key, h.value]));

    expect(byKey["X-Content-Type-Options"]).toBe("nosniff");
    expect(byKey["X-Frame-Options"]).toBe("DENY");
    expect(byKey["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  });

  it("n'envoie NI la CSP NI HSTS hors production (next dev reste fonctionnel)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const headers = await loadHeaders();
    const keys = headers.map((h) => h.key);

    expect(keys).not.toContain("Content-Security-Policy");
    expect(keys).not.toContain("Strict-Transport-Security");
  });

  it("envoie une CSP stricte en production, sans aucun domaine externe", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const headers = await loadHeaders();
    const byKey = Object.fromEntries(headers.map((h) => [h.key, h.value]));
    const csp = byKey["Content-Security-Policy"];

    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    // Aucun domaine externe (http(s)://...) nulle part dans la CSP : seules
    // des valeurs CSP spéciales ('self', 'none', 'unsafe-inline', data:) ou
    // des directives sont attendues.
    expect(csp).not.toMatch(/https?:\/\/(?!localhost)/);
  });

  it("envoie HSTS en production, SANS includeSubDomains ni preload (configuration HTTPS Netlify non vérifiée)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const headers = await loadHeaders();
    const byKey = Object.fromEntries(headers.map((h) => [h.key, h.value]));
    const hsts = byKey["Strict-Transport-Security"];

    expect(hsts).toBeDefined();
    expect(hsts).toMatch(/^max-age=\d+$/);
    expect(hsts).not.toContain("includeSubDomains");
    expect(hsts).not.toContain("preload");
  });

  it("autorise explicitement style-src-attr 'unsafe-inline' (barres de progression) sans élargir style-src", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const headers = await loadHeaders();
    const byKey = Object.fromEntries(headers.map((h) => [h.key, h.value]));
    const csp = byKey["Content-Security-Policy"];

    expect(csp).toContain("style-src-attr 'unsafe-inline'");
    expect(csp).toMatch(/style-src 'self';/);
  });
});
