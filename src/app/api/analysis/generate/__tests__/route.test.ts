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

// Prompt 05.17.1 (correction de la faille critique de l'audit 05.17) :
// `saveDeepAnalysis` passe désormais par le RPC `save_generated_analysis`
// (plus d'insert direct via `.from("deep_analyses")`) — ce mock simule ce
// RPC comme les autres.
let saveAnalysisResult: { data: unknown; error: Error | null } = {
  data: "analysis-id",
  error: null,
};

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
    if (fnName === "save_generated_analysis") {
      return Promise.resolve(saveAnalysisResult);
    }
    return Promise.resolve({ data: true, error: null });
  });
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })) },
    rpc,
    rpcCalls,
  };
}

let currentSupabaseMock = makeSupabaseMock();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => currentSupabaseMock,
}));

beforeEach(() => {
  saveAnalysisResult = { data: "analysis-id", error: null };
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

async function callRoute(origin?: string) {
  const { POST } = await import("@/app/api/analysis/generate/route");
  const response = await POST(
    new Request("http://localhost/api/analysis/generate", {
      method: "POST",
      headers: origin ? { origin } : undefined,
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

describe("POST /api/analysis/generate (vrai route.ts + vraie vérification d'origine)", () => {
  it("renvoie 403 pour une origine externe non autorisée, avant toute génération", async () => {
    const { response } = await callRoute("https://evil.example");

    expect(response.status).toBe(403);
    expect(mockGenerateDeepAnalysis).not.toHaveBeenCalled();
  });

  it("laisse passer une requête sans en-tête Origin (pas de blocage injustifié)", async () => {
    mockGenerateDeepAnalysis.mockResolvedValue(FAKE_ANALYSIS);

    const { response } = await callRoute(undefined);

    expect(response.status).toBe(200);
  });
});

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

  it("enregistre l'analyse via le RPC save_generated_analysis, SANS appeler consumeReservation séparément (non-régression + correction 05.17.1)", async () => {
    mockGenerateDeepAnalysis.mockResolvedValue(FAKE_ANALYSIS);

    const { lines } = await callRoute();

    expect(lines.some((l) => l.stage === "done" && l.analysisId === "analysis-id")).toBe(true);
    // save_generated_analysis a bien été appelé avec la réservation en cours.
    const saveCalls = currentSupabaseMock.rpcCalls.filter((c) => c.fnName === "save_generated_analysis");
    expect(saveCalls).toHaveLength(1);
    expect((saveCalls[0].args as { p_reservation_id?: string }).p_reservation_id).toBe("res-1");
    // Le RPC marque lui-même la réservation "completed" dans sa propre
    // transaction (non simulée ici, voir les tests Postgres réels) : la
    // route elle-même ne doit JAMAIS appeler resolve_generation_slot en
    // plus, sous peine de double consommation.
    const resolveCalls = currentSupabaseMock.rpcCalls.filter((c) => c.fnName === "resolve_generation_slot");
    expect(resolveCalls).toHaveLength(0);
  });

  // Prompt 05.16.1 (correctif E3) : une erreur Supabase/Postgres simulée,
  // contenant du détail interne, ne doit jamais atteindre la réponse HTTP.
  it("ne révèle jamais le détail d'une erreur de sauvegarde Supabase simulée (table/colonne/contrainte)", async () => {
    mockGenerateDeepAnalysis.mockResolvedValue(FAKE_ANALYSIS);
    const sensitiveDetail =
      'column "secret_internal_column" of relation "public.deep_analyses" violates not-null constraint "deep_analyses_secret_check"';
    saveAnalysisResult = { data: null, error: new Error(sensitiveDetail) };
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

  // Prompt 05.19/05.20 : même correction qu'en 05.18.1 pour
  // /api/courses/generate — nécessaire pour que le client puisse reprendre
  // après un rechargement pendant une analyse en cours.
  it("transmet reservationId comme toute première ligne du flux NDJSON, avant le moindre évènement de progression", async () => {
    mockGenerateDeepAnalysis.mockResolvedValue(FAKE_ANALYSIS);

    const { lines } = await callRoute();

    expect(lines[0]).toEqual({ reservationId: "res-1" });
  });
});
