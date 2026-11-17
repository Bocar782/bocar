// Vrai test (Prompt 05.19/05.20) : jusqu'ici `getGenerationStatus` n'était
// testé qu'indirectement via le composant CourseGenerator. Importe et
// exécute le VRAI src/lib/courses/generation-status.ts ; seul le client
// Supabase est mocké.
import { describe, expect, it, vi } from "vitest";

function makeSupabase(options: {
  authenticated?: boolean;
  row?: Record<string, unknown> | null;
  queryError?: Error | null;
}) {
  const { authenticated = true, row = null, queryError = null } = options;
  const eqCalls: unknown[][] = [];

  function makeEqChain(remaining: number): Record<string, unknown> {
    return {
      eq: (...args: unknown[]) => {
        eqCalls.push(args);
        return remaining > 1
          ? makeEqChain(remaining - 1)
          : { maybeSingle: async () => ({ data: queryError ? null : row, error: queryError }) };
      },
    };
  }

  return {
    auth: {
      getUser: vi.fn(async () =>
        authenticated ? { data: { user: { id: "user-1" } } } : { data: { user: null } },
      ),
    },
    from: vi.fn(() => ({
      select: () => makeEqChain(3),
    })),
    eqCalls,
  };
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => currentSupabaseMock,
}));

let currentSupabaseMock = makeSupabase({});

describe("getGenerationStatus — authentification et incertitude (jamais une fausse affirmation)", () => {
  it("renvoie 'unknown' (jamais 'not_found') si l'utilisateur n'est pas authentifié", async () => {
    currentSupabaseMock = makeSupabase({ authenticated: false });
    const { getGenerationStatus } = await import("@/lib/courses/generation-status");

    const result = await getGenerationStatus("res-1", "course");

    expect(result.status).toBe("unknown");
  });

  it("renvoie 'unknown' si la requête Supabase échoue techniquement", async () => {
    currentSupabaseMock = makeSupabase({ queryError: new Error("connexion perdue") });
    const { getGenerationStatus } = await import("@/lib/courses/generation-status");

    const result = await getGenerationStatus("res-1", "course");

    expect(result.status).toBe("unknown");
  });

  it("renvoie 'not_found' seulement quand l'absence est confirmée (requête réussie, aucune ligne)", async () => {
    currentSupabaseMock = makeSupabase({ row: null });
    const { getGenerationStatus } = await import("@/lib/courses/generation-status");

    const result = await getGenerationStatus("res-1", "course");

    expect(result.status).toBe("not_found");
  });

  it("renvoie 'unknown' pour un statut en base ni pending/completed/released (valeur inattendue)", async () => {
    currentSupabaseMock = makeSupabase({ row: { status: "weird", resource_id: null, created_at: null } });
    const { getGenerationStatus } = await import("@/lib/courses/generation-status");

    const result = await getGenerationStatus("res-1", "course");

    expect(result.status).toBe("unknown");
  });
});

describe("getGenerationStatus — statuts confirmés et filtrage par kind (Prompt 05.19/05.20)", () => {
  it("renvoie 'pending' avec ses métadonnées quand la réservation existe et est en cours", async () => {
    currentSupabaseMock = makeSupabase({
      row: { status: "pending", resource_id: null, created_at: "2026-01-01T00:00:00Z" },
    });
    const { getGenerationStatus } = await import("@/lib/courses/generation-status");

    const result = await getGenerationStatus("res-1", "course");

    expect(result).toEqual({ status: "pending", resourceId: null, createdAt: "2026-01-01T00:00:00Z" });
  });

  it("renvoie 'completed' avec le resourceId de la ressource créée", async () => {
    currentSupabaseMock = makeSupabase({
      row: { status: "completed", resource_id: "course-123", created_at: "2026-01-01T00:00:00Z" },
    });
    const { getGenerationStatus } = await import("@/lib/courses/generation-status");

    const result = await getGenerationStatus("res-1", "course");

    expect(result.status).toBe("completed");
    expect(result.resourceId).toBe("course-123");
  });

  it("filtre explicitement par kind ('analysis'), pour ne jamais confondre une réservation d'analyse avec une de formation", async () => {
    currentSupabaseMock = makeSupabase({
      row: { status: "pending", resource_id: null, created_at: null },
    });
    const { getGenerationStatus } = await import("@/lib/courses/generation-status");

    await getGenerationStatus("res-1", "analysis");

    const kindFilterCall = currentSupabaseMock.eqCalls.find(([column]) => column === "kind");
    expect(kindFilterCall).toEqual(["kind", "analysis"]);
  });
});
