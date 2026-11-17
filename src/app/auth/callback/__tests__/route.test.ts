// Vrais tests automatisés (Prompt 05.16.1, correctif E2 de l'audit de
// sécurité 05.16) : importent et exécutent la VRAIE fonction
// `sanitizeNextPath` et le VRAI handler GET de route.ts. Seule la
// frontière externe (client Supabase) est mockée.
import { describe, expect, it, vi } from "vitest";
import { GET, sanitizeNextPath } from "@/app/auth/callback/route";

describe("sanitizeNextPath", () => {
  it("accepte les chemins internes relatifs légitimes du projet", () => {
    expect(sanitizeNextPath("/dashboard")).toBe("/dashboard");
    expect(sanitizeNextPath("/update-password")).toBe("/update-password");
    expect(sanitizeNextPath("/dashboard/formations/abc-123")).toBe("/dashboard/formations/abc-123");
  });

  it("retombe sur /dashboard quand next est absent", () => {
    expect(sanitizeNextPath(null)).toBe("/dashboard");
  });

  it("retombe sur /dashboard pour une valeur vide ou uniquement des espaces", () => {
    expect(sanitizeNextPath("")).toBe("/dashboard");
    expect(sanitizeNextPath("   ")).toBe("/dashboard");
  });

  it("refuse les chemins protocole-relatifs commençant par //", () => {
    expect(sanitizeNextPath("//evil.example.com")).toBe("/dashboard");
    expect(sanitizeNextPath("//evil.example.com/dashboard")).toBe("/dashboard");
  });

  it("refuse les URL absolues avec un schéma", () => {
    expect(sanitizeNextPath("https://evil.example.com")).toBe("/dashboard");
    expect(sanitizeNextPath("http://evil.example.com/dashboard")).toBe("/dashboard");
    expect(sanitizeNextPath("javascript:alert(1)")).toBe("/dashboard");
    expect(sanitizeNextPath("mailto:test@evil.example.com")).toBe("/dashboard");
  });

  it("refuse les valeurs malformées (pas de / initial, backslash, espaces internes)", () => {
    expect(sanitizeNextPath("dashboard")).toBe("/dashboard");
    expect(sanitizeNextPath("../dashboard")).toBe("/dashboard");
    expect(sanitizeNextPath("/\\evil.example.com")).toBe("/dashboard");
    expect(sanitizeNextPath("/dash board")).toBe("/dashboard");
    expect(sanitizeNextPath("/dashboard\nSet-Cookie: x=1")).toBe("/dashboard");
  });
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      exchangeCodeForSession: vi.fn(async () => ({ error: null })),
    },
  }),
}));

describe("GET /auth/callback (vrai route.ts)", () => {
  it("redirige vers next quand c'est un chemin interne légitime", async () => {
    const response = await GET(
      new Request("http://localhost/auth/callback?code=abc&next=/update-password"),
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/update-password");
  });

  it("redirige vers /dashboard par défaut quand next est absent", async () => {
    const response = await GET(new Request("http://localhost/auth/callback?code=abc"));
    expect(response.headers.get("location")).toBe("http://localhost/dashboard");
  });

  it("neutralise une tentative d'ouverture de redirection (//evil.example.com) et retombe sur /dashboard", async () => {
    const response = await GET(
      new Request("http://localhost/auth/callback?code=abc&next=//evil.example.com"),
    );
    const location = response.headers.get("location");
    expect(location).toBe("http://localhost/dashboard");
    expect(location).not.toContain("evil.example.com");
  });

  it("neutralise une URL absolue fournie en next et retombe sur /dashboard", async () => {
    const response = await GET(
      new Request(
        "http://localhost/auth/callback?code=abc&next=" +
          encodeURIComponent("https://evil.example.com"),
      ),
    );
    const location = response.headers.get("location");
    expect(location).toBe("http://localhost/dashboard");
    expect(location).not.toContain("evil.example.com");
  });
});
