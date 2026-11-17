// Vrais tests automatisés (Prompt 05.20.1, architecture à étapes courtes —
// même mécanisme que /api/courses/generate, voir ce fichier de test pour
// le détail des commentaires). Seules les frontières externes (client
// Supabase, client Anthropic, performAnalysisStepUnit) sont mockées.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPerformAnalysisStepUnit = vi.fn();

vi.mock("@/lib/analysis/generate", async () => {
  const actual = await vi.importActual<typeof import("@/lib/analysis/generate")>("@/lib/analysis/generate");
  return {
    ...actual,
    performAnalysisStepUnit: (...args: unknown[]) => mockPerformAnalysisStepUnit(...args),
  };
});

const mockCreateAnthropicClient = vi.fn(() => ({ fakeClient: true }));
vi.mock("@/lib/anthropic/client", () => ({
  createAnthropicClient: () => mockCreateAnthropicClient(),
}));

const mockSaveDeepAnalysis = vi.fn();
vi.mock("@/lib/analysis/persist", () => ({
  saveDeepAnalysis: (...args: unknown[]) => mockSaveDeepAnalysis(...args),
}));

type RpcCall = { fnName: string; args: unknown };

function makeSupabaseMock() {
  const rpcCalls: RpcCall[] = [];
  const state = {
    reservations: new Map<string, { status: string; input: unknown; progress: unknown; claimedStep: string | null }>(),
    byIdemKey: new Map<string, string>(),
    nextId: 1,
  };

  const rpc = vi.fn((fnName: string, args: Record<string, unknown>) => {
    rpcCalls.push({ fnName, args });

    if (fnName === "start_generation_task") {
      const key = `${args.p_kind}:${args.p_idempotency_key}`;
      const existing = state.byIdemKey.get(key);
      if (existing) {
        return { single: async () => ({ data: { reservation_id: existing, already_existed: true, ok: true, is_pro: null, limit_count: null, used_count: null }, error: null }) };
      }
      const id = `00000000-0000-4000-8000-${String(state.nextId++).padStart(12, "0")}`;
      state.byIdemKey.set(key, id);
      state.reservations.set(id, { status: "pending", input: args.p_input, progress: {}, claimedStep: null });
      return { single: async () => ({ data: { reservation_id: id, already_existed: false, ok: true, is_pro: true, limit_count: 2, used_count: 1 }, error: null }) };
    }

    if (fnName === "claim_generation_step") {
      const row = state.reservations.get(args.p_reservation_id as string);
      if (!row) return { single: async () => ({ data: { claimed: false, reason: "not_found", input: null, progress: null, reservation_status: null }, error: null }) };
      if (row.status !== "pending") return { single: async () => ({ data: { claimed: false, reason: "already_resolved", input: row.input, progress: row.progress, reservation_status: row.status }, error: null }) };
      if (row.claimedStep) return { single: async () => ({ data: { claimed: false, reason: "already_in_progress", input: null, progress: null, reservation_status: row.status }, error: null }) };
      row.claimedStep = args.p_claim_token as string;
      return { single: async () => ({ data: { claimed: true, reason: null, input: row.input, progress: row.progress, reservation_status: row.status }, error: null }) };
    }

    if (fnName === "commit_generation_step") {
      const row = state.reservations.get(args.p_reservation_id as string);
      if (!row || row.claimedStep !== args.p_claim_token) return { single: async () => ({ data: { ok: false, reason: row ? "claim_expired" : "not_found" }, error: null }) };
      row.progress = { ...(row.progress as object), ...(args.p_progress_patch as object) };
      row.claimedStep = null;
      return { single: async () => ({ data: { ok: true, reason: null }, error: null }) };
    }

    if (fnName === "fail_generation_step") {
      const row = state.reservations.get(args.p_reservation_id as string);
      if (row) row.claimedStep = null;
      return { single: async () => ({ data: { ok: true, reason: null }, error: null }) };
    }

    if (fnName === "resolve_generation_slot") {
      const row = state.reservations.get(args.p_reservation_id as string);
      if (row) row.status = args.p_status as string;
      return Promise.resolve({ data: true, error: null });
    }

    return Promise.resolve({ data: null, error: null });
  });

  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })) },
    rpc,
    rpcCalls,
    state,
  };
}

let currentSupabaseMock = makeSupabaseMock();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => currentSupabaseMock,
}));

beforeEach(() => {
  currentSupabaseMock = makeSupabaseMock();
  mockPerformAnalysisStepUnit.mockReset();
  mockSaveDeepAnalysis.mockReset();
  mockCreateAnthropicClient.mockClear();
});

async function callRoute(body: Record<string, unknown>, origin?: string) {
  const { POST } = await import("@/app/api/analysis/generate/route");
  const response = await POST(
    new Request("http://localhost/api/analysis/generate", {
      method: "POST",
      headers: origin ? { origin, "Content-Type": "application/json" } : { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  const json = await response.json().catch(() => null);
  return { response, json };
}

describe("POST /api/analysis/generate — vérification d'origine", () => {
  it("renvoie 403 pour une origine externe non autorisée, avant toute action", async () => {
    const { response } = await callRoute({ action: "start", idempotencyKey: "k1", topic: "Sujet" }, "https://evil.example");
    expect(response.status).toBe(403);
  });
});

describe("POST /api/analysis/generate — action 'start'", () => {
  it("réserve un quota et renvoie reservationId", async () => {
    const { response, json } = await callRoute({ action: "start", idempotencyKey: "k1", topic: "Sujet" });
    expect(response.status).toBe(200);
    expect(json.reservationId).toBe("00000000-0000-4000-8000-000000000001");
  });

  it("rejouer 'start' avec la MÊME clé d'idempotence renvoie la même réservation, sans consommer un second quota", async () => {
    const body = { action: "start", idempotencyKey: "same-key", topic: "Sujet" };
    const first = await callRoute(body);
    const second = await callRoute(body);
    expect(first.json.reservationId).toBe(second.json.reservationId);
  });

  it("renvoie 403 avec le message de quota si le RPC refuse (quota atteint)", async () => {
    currentSupabaseMock.rpc = vi.fn(() => ({
      single: async () => ({ data: { reservation_id: null, already_existed: false, ok: false, is_pro: true, limit_count: 2, used_count: 2 }, error: null }),
    })) as never;

    const { response, json } = await callRoute({ action: "start", idempotencyKey: "k1", topic: "Sujet" });

    expect(response.status).toBe(403);
    expect(json.error).toContain("analyse");
  });

  it("renvoie 409 (message actionnable, pas le message générique de panne) si la clé d'idempotence est réutilisée avec un contenu différent", async () => {
    currentSupabaseMock.rpc = vi.fn(() => ({
      single: async () => ({ data: null, error: { message: "idempotency_key_payload_mismatch" } }),
    })) as never;

    const { response, json } = await callRoute({ action: "start", idempotencyKey: "k1", topic: "Sujet" });

    expect(response.status).toBe(409);
    expect(json.error).toContain("Recharge la page");
  });
});

describe("POST /api/analysis/generate — action 'step'", () => {
  async function startOne() {
    const { json } = await callRoute({ action: "start", idempotencyKey: "k1", topic: "Sujet" });
    return json.reservationId as string;
  }

  it("renvoie 404 pour une réservation introuvable", async () => {
    const { response } = await callRoute({ action: "step", reservationId: "00000000-0000-0000-0000-000000000000" });
    expect(response.status).toBe(404);
  });

  it("exécute une seule unité de travail par appel et avance la progression", async () => {
    const reservationId = await startOne();
    mockPerformAnalysisStepUnit.mockResolvedValue({
      brief: { title: "Analyse test", domain: "Test", introduction: "x", researchAngle: "x", caseCount: 4, searchQueries: ["q"] },
    });

    const { response, json } = await callRoute({ action: "step", reservationId });

    expect(response.status).toBe(200);
    expect(json.done).toBe(false);
    expect(json.stage).toBe("cadrage");
    expect(mockPerformAnalysisStepUnit).toHaveBeenCalledTimes(1);
  });

  it("libère immédiatement la réservation sur une erreur métier fatale (pas assez de cas vérifiés), sans attendre 15 minutes", async () => {
    const reservationId = await startOne();
    const { AnalysisGenerationError } = await vi.importActual<typeof import("@/lib/analysis/generate")>("@/lib/analysis/generate");
    mockPerformAnalysisStepUnit.mockRejectedValue(new AnalysisGenerationError("Pas assez de cas réels."));

    const { response, json } = await callRoute({ action: "step", reservationId });

    expect(response.status).toBe(200);
    expect(json.done).toBe(true);
    expect(json.fatalError).toBe("Pas assez de cas réels.");
    const releaseCalls = currentSupabaseMock.rpcCalls.filter((c) => c.fnName === "resolve_generation_slot" && (c.args as { p_status?: string }).p_status === "released");
    expect(releaseCalls).toHaveLength(1);
  });

  it("ne libère JAMAIS la réservation sur une erreur transitoire", async () => {
    const reservationId = await startOne();
    mockPerformAnalysisStepUnit.mockRejectedValue(new Error("panne réseau"));

    const { response, json } = await callRoute({ action: "step", reservationId });

    expect(response.status).toBe(200);
    expect(json.done).toBe(false);
    expect(json.transientError).toBe(true);
    const releaseCalls = currentSupabaseMock.rpcCalls.filter((c) => c.fnName === "resolve_generation_slot");
    expect(releaseCalls).toHaveLength(0);
  });

  it("deux appels 'step' simultanés sur la même réservation : un seul avance, l'autre reçoit busy:true", async () => {
    const reservationId = await startOne();
    mockPerformAnalysisStepUnit.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ brief: { title: "x", domain: "x", introduction: "x", researchAngle: "x", caseCount: 4, searchQueries: [] } }), 20)),
    );

    const [first, second] = await Promise.all([
      callRoute({ action: "step", reservationId }),
      callRoute({ action: "step", reservationId }),
    ]);

    const busyResponses = [first.json, second.json].filter((j) => j.busy === true);
    expect(busyResponses).toHaveLength(1);
    expect(mockPerformAnalysisStepUnit).toHaveBeenCalledTimes(1);
  });

  it("assemble et sauvegarde l'analyse à la dernière étape, via le RPC atomique existant (saveDeepAnalysis réutilisé)", async () => {
    const reservationId = await startOne();
    const row = currentSupabaseMock.state.reservations.get(reservationId)!;
    row.progress = {
      stage: "synthese",
      brief: { title: "Analyse test", domain: "Test", introduction: "x", researchAngle: "x", caseCount: 2, searchQueries: [] },
      verifiedCases: [
        { name: "Cas A", summary: "x", outcome: "succès", sourceUrl: "https://a.example.com", sourceTitle: "A" },
        { name: "Cas B", summary: "x", outcome: "échec", sourceUrl: "https://b.example.com", sourceTitle: "B" },
      ],
      sections: {
        "0": { position: 0, name: "Cas A", outcome: "succès", content: "x", lessons: [], source: { index: 0, url: "https://a.example.com", title: "A" } },
        "1": { position: 1, name: "Cas B", outcome: "échec", content: "x", lessons: [], source: { index: 1, url: "https://b.example.com", title: "B" } },
      },
      synthesis: { synthesis: "Synthèse", keyLessons: [] },
    };
    mockSaveDeepAnalysis.mockResolvedValue("analysis-123");

    const { response, json } = await callRoute({ action: "step", reservationId });

    expect(response.status).toBe(200);
    expect(json.done).toBe(true);
    expect(json.analysisId).toBe("analysis-123");
    expect(json.analysis).toBeDefined();
    expect(mockSaveDeepAnalysis).toHaveBeenCalledTimes(1);
  });

  it("renvoie alreadyResolved:true sans refaire de travail si l'analyse est déjà terminée", async () => {
    const reservationId = await startOne();
    const row = currentSupabaseMock.state.reservations.get(reservationId)!;
    row.status = "completed";

    const { response, json } = await callRoute({ action: "step", reservationId });

    expect(response.status).toBe(200);
    expect(json.done).toBe(true);
    expect(json.alreadyResolved).toBe(true);
    expect(mockPerformAnalysisStepUnit).not.toHaveBeenCalled();
  });
});
