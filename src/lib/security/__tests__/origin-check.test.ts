// Vrais tests : importent la vraie fonction checkRequestOrigin() et de
// vrais objets Request, jamais une réimplémentation de sa logique.
import { describe, expect, it } from "vitest";
import { checkRequestOrigin } from "@/lib/security/origin-check";

function requestWithOrigin(origin?: string): Request {
  return new Request("http://localhost/api/whatever", {
    method: "POST",
    headers: origin ? { origin } : undefined,
  });
}

describe("checkRequestOrigin", () => {
  it("laisse passer (renvoie null) quand l'en-tête Origin est absent", () => {
    expect(checkRequestOrigin(requestWithOrigin(undefined))).toBeNull();
  });

  it("laisse passer (renvoie null) pour l'origine légitime configurée", () => {
    expect(checkRequestOrigin(requestWithOrigin("http://localhost:3000"))).toBeNull();
  });

  it("renvoie une réponse 403 pour une origine externe non autorisée", async () => {
    const result = checkRequestOrigin(requestWithOrigin("https://evil.example"));

    expect(result).not.toBeNull();
    expect(result?.status).toBe(403);
    const payload = (await result?.json()) as { error: string };
    expect(payload.error).toMatch(/non autorisée/i);
  });

  it("ignore un en-tête Host falsifié : seule la configuration explicite compte, jamais Host/X-Forwarded-Host", () => {
    const request = new Request("http://localhost/api/whatever", {
      method: "POST",
      headers: {
        origin: "https://evil.example",
        host: "localhost:3000",
        "x-forwarded-host": "localhost:3000",
      },
    });

    const result = checkRequestOrigin(request);

    expect(result).not.toBeNull();
    expect(result?.status).toBe(403);
  });
});
