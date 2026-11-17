// Vrais tests : importent les vraies fonctions de allowed-origins.ts
// (jamais une réimplémentation de leur logique dans ce fichier de test).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAllowedOrigins, isAllowedOrigin } from "@/lib/security/allowed-origins";

describe("getAllowedOrigins / isAllowedOrigin", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("n'inclut que l'origine canonique configurée (NEXT_PUBLIC_SITE_URL de test) par défaut", () => {
    expect(getAllowedOrigins()).toEqual(["http://localhost:3000"]);
  });

  it("autorise l'origine canonique configurée", () => {
    expect(isAllowedOrigin("http://localhost:3000")).toBe(true);
  });

  it("refuse une origine externe quelconque", () => {
    expect(isAllowedOrigin("https://evil.example")).toBe(false);
  });

  it("refuse une origine qui ne diffère que par le port (jamais une correspondance partielle)", () => {
    expect(isAllowedOrigin("http://localhost:4000")).toBe(false);
  });

  it("refuse une origine qui ne diffère que par le protocole", () => {
    expect(isAllowedOrigin("https://localhost:3000")).toBe(false);
  });

  it("refuse une valeur malformée sans jamais lever d'exception", () => {
    expect(() => isAllowedOrigin("pas-une-url")).not.toThrow();
    expect(isAllowedOrigin("pas-une-url")).toBe(false);
  });

  it("ajoute une origine supplémentaire explicitement configurée via ADDITIONAL_ALLOWED_ORIGINS", () => {
    vi.stubEnv("ADDITIONAL_ALLOWED_ORIGINS", "https://preview.example, https://autre.example");

    const origins = getAllowedOrigins();

    expect(origins).toContain("http://localhost:3000");
    expect(origins).toContain("https://preview.example");
    expect(origins).toContain("https://autre.example");
    expect(isAllowedOrigin("https://preview.example")).toBe(true);
  });

  it("ignore une entrée malformée dans ADDITIONAL_ALLOWED_ORIGINS sans faire échouer les autres", () => {
    vi.stubEnv("ADDITIONAL_ALLOWED_ORIGINS", "pas-une-url, https://preview.example");

    const origins = getAllowedOrigins();

    expect(origins).toContain("https://preview.example");
    expect(origins).toContain("http://localhost:3000");
  });

  it("ne normalise jamais à partir de Host/X-Forwarded-Host : ces en-têtes ne sont pas des paramètres de ces fonctions", () => {
    // Vérification structurelle : getAllowedOrigins() ne prend aucun
    // paramètre de requête, donc aucune valeur côté client (Host compris)
    // ne peut influencer son résultat.
    expect(getAllowedOrigins.length).toBe(0);
  });
});
