// Vrais tests automatisés (Prompt 05.16.1, correctif E3 de l'audit de
// sécurité 05.16) : importent et exécutent le VRAI handler POST de route.ts
// ainsi que le vrai src/lib/analysis/persist.ts et
// src/lib/courses/reservation.ts qu'il appelle en interne. Seules les
// frontières externes (client Supabase, generateDeepAnalysis) sont mockées.
// Aucun appel réel à Anthropic ni à Supabase.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GeneratedDeepAnalysis } from "@/lib/analysis/schemas";

const mockGenerateDeepAnalysis = vi.fn();

vi.mock("@/lib/analysis/generate", () => ({
  generateDeepAnalysis: (...args: unknown[]) => mockGenerateDeepAnalysis(...args),
  AnalysisGenerationError: class AnalysisGenerationError extends Error {},
}));

type RpcCall = { fnName: string; args: unknown };

type RpcMockResult =
  | { single: () => Promise<{ data: unknown; error: Error | null }> }
  | Promise<{ data: unknown; error: Error | null }>;

function makeSupabaseMock() {
  const rpcCalls: RpcCall[] = [];
  const rpc = vi.fn((fnName: string, args: unknown): RpcMockResult => {
    rpcCalls.push({ fnName, args });
    if (fnName === "reserve_generation_slot") {
      return {
        single: async () => ({
          data: { ok: true, reservation_id: "res-1", is_pro: true, limit_count: 2, used_count: 1 },
          error: null,
        }),
      };
    }
    return Promise.resolve({ data: true, error: null });
  });
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })) },
    from: vi.fn((): {
      insert: () => { select: () => { single: () => Promise<{ data: { id: string } | null; error: Error | null }> } };
    } => ({
      insert: () => ({
        select: () => ({
          single: async () => ({ data: { id: "analysis-id" }, error: null }),
        }),
      }),
    })),
    rpc,
    rpcCalls,
  };
}

let currentSupabaseMock = makeSupabaseMock();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => currentSupabaseMock,
}));

beforeEach(() => {
  currentSupabaseMock = makeSupabaseMock();
  mockGenerateDeepAnalysis.mockReset();
});

const FAKE_ANALYSIS: GeneratedDeepAnalysis = {
  topic: "Sujet",
  title: "Analyse test",
  domain: "Test",
  introduction: "Intro",
  sections: [],
  synthesis: "Synthèse",
  keyLessons: [],
  sources: [],
};

async function callRoute() {
  const { POST } = await import("@/app/api/analysis/generate/route");
  const response = await POST(
    new Request("http://localhost/api/analysis/generate", {
      method: "POST",
      body: JSON.stringify({ topic: "Un sujet de test" }),
    }),
  );
  const text = await response.text();
  const lines = text
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Record<string, unknown>);
  return { response, lines };
}

describe("POST /api/analysis/generate (vrai route.ts + vrai persist.ts/reservation.ts)", () => {
  it("n'enregistre jamais l'analyse et libère la réservation quand generateDeepAnalysis() échoue", async () => {
    mockGenerateDeepAnalysis.mockRejectedValue(new Error("échec simulé de génération"));

    const { lines } = await callRoute();

    expect(lines.some((l) => l.stage === "error")).toBe(true);
    const releaseCalls = currentSupabaseMock.rpcCalls.filter(
      (c) => c.fnName === "resolve_generation_slot" && (c.args as { p_status?: string }).p_status === "released",
    );
    expect(releaseCalls).toHaveLength(1);
  });

  it("enregistre l'analyse et consomme la réservation en cas de succès complet (non-régression)", async () => {
    mockGenerateDeepAnalysis.mockResolvedValue(FAKE_ANALYSIS);

    const { lines } = await callRoute();

    expect(lines.some((l) => l.stage === "done" && l.analysisId === "analysis-id")).toBe(true);
    const consumeCalls = currentSupabaseMock.rpcCalls.filter(
      (c) => c.fnName === "resolve_generation_slot" && (c.args as { p_status?: string }).p_status === "completed",
    );
    expect(consumeCalls).toHaveLength(1);
  });

  // Prompt 05.16.1 (correctif E3) : une erreur Supabase/Postgres simulée,
  // contenant du détail interne, ne doit jamais atteindre la réponse HTTP.
  it("ne révèle jamais le détail d'une erreur de sauvegarde Supabase simulée (table/colonne/contrainte)", async () => {
    mockGenerateDeepAnalysis.mockResolvedValue(FAKE_ANALYSIS);
    const sensitiveDetail =
      'column "secret_internal_column" of relation "public.deep_analyses" violates not-null constraint "deep_analyses_secret_check"';
    currentSupabaseMock.from = vi.fn(() => ({
      insert: () => ({
        select: () => ({
          single: async () => ({ data: null, error: new Error(sensitiveDetail) }),
        }),
      }),
    }));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { response, lines } = await callRoute();
    const fullBody = JSON.stringify(lines);

    expect(response.status).toBe(200);
    expect(fullBody).not.toContain("secret_internal_column");
    expect(fullBody).not.toContain("constraint");
    expect(fullBody).not.toContain("relation");
    const doneLine = lines.find((l) => l.stage === "done");
    expect(doneLine?.saveWarning).toBe(
      "L'analyse a été générée mais n'a pas pu être enregistrée. Réessaie, ou contacte le support si le problème persiste.",
    );
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("ne révèle jamais le détail d'une erreur inattendue (non métier) pendant la génération", async () => {
    const sensitiveDetail = 'relation "public.secret_table" does not exist';
    mockGenerateDeepAnalysis.mockRejectedValue(new Error(sensitiveDetail));

    const { response, lines } = await callRoute();
    const fullBody = JSON.stringify(lines);

    expect(response.status).toBe(200);
    expect(fullBody).not.toContain("secret_table");
    expect(fullBody).not.toContain("relation");
    const errorLine = lines.find((l) => l.stage === "error");
    expect(errorLine?.message).toBe("Une erreur est survenue pendant l'analyse. Réessaie dans un instant.");
  });

  it("conserve le message d'une AnalysisGenerationError (erreur métier conçue pour être affichée)", async () => {
    const { AnalysisGenerationError } = await import("@/lib/analysis/generate");
    mockGenerateDeepAnalysis.mockRejectedValue(
      new AnalysisGenerationError("Le sujet proposé ne permet pas d'identifier de cas réels pertinents."),
    );

    const { lines } = await callRoute();

    const errorLine = lines.find((l) => l.stage === "error");
    expect(errorLine?.message).toBe("Le sujet proposé ne permet pas d'identifier de cas réels pertinents.");
  });
});
