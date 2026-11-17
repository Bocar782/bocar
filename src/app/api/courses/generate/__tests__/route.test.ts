// Vrais tests automatisés (Prompt 05.20.1, architecture à étapes courtes) :
// importent et exécutent le VRAI handler POST de route.ts. Seules les
// frontières externes (client Supabase, client Anthropic, les fonctions
// de generate.ts) sont mockées. Aucun appel réel à Anthropic ni à
// Supabase. `validateProgrammeStructure`/`decideNextCourseStep`/
// `flattenModulePlans` sont les VRAIES fonctions (pures, sans IA ni
// réseau) : on veut vérifier leur vrai comportement.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Analysis, Programme, VerifiedExample } from "@/lib/courses/schemas";

const mockBuildCoursePlan = vi.fn();
const mockPerformCourseStepUnit = vi.fn();

vi.mock("@/lib/courses/generate", async () => {
  const actual = await vi.importActual<typeof import("@/lib/courses/generate")>("@/lib/courses/generate");
  return {
    ...actual,
    buildCoursePlan: (...args: unknown[]) => mockBuildCoursePlan(...args),
    performCourseStepUnit: (...args: unknown[]) => mockPerformCourseStepUnit(...args),
  };
});

const mockCreateAnthropicClient = vi.fn(() => ({ fakeClient: true }));
vi.mock("@/lib/anthropic/client", () => ({
  createAnthropicClient: () => mockCreateAnthropicClient(),
}));

const mockSaveCourse = vi.fn();
vi.mock("@/lib/courses/persist", () => ({
  saveCourse: (...args: unknown[]) => mockSaveCourse(...args),
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
        return {
          single: async () => ({
            data: { reservation_id: existing, already_existed: true, ok: true, is_pro: null, limit_count: null, used_count: null },
            error: null,
          }),
        };
      }
      const id = `00000000-0000-4000-8000-${String(state.nextId++).padStart(12, "0")}`;
      state.byIdemKey.set(key, id);
      state.reservations.set(id, { status: "pending", input: args.p_input, progress: {}, claimedStep: null });
      return {
        single: async () => ({
          data: { reservation_id: id, already_existed: false, ok: true, is_pro: false, limit_count: 1, used_count: 1 },
          error: null,
        }),
      };
    }

    if (fnName === "claim_generation_step") {
      const row = state.reservations.get(args.p_reservation_id as string);
      if (!row) {
        return { single: async () => ({ data: { claimed: false, reason: "not_found", input: null, progress: null, reservation_status: null }, error: null }) };
      }
      if (row.status !== "pending") {
        return { single: async () => ({ data: { claimed: false, reason: "already_resolved", input: row.input, progress: row.progress, reservation_status: row.status }, error: null }) };
      }
      if (row.claimedStep) {
        return { single: async () => ({ data: { claimed: false, reason: "already_in_progress", input: null, progress: null, reservation_status: row.status }, error: null }) };
      }
      row.claimedStep = args.p_claim_token as string;
      return { single: async () => ({ data: { claimed: true, reason: null, input: row.input, progress: row.progress, reservation_status: row.status }, error: null }) };
    }

    if (fnName === "commit_generation_step") {
      const row = state.reservations.get(args.p_reservation_id as string);
      if (!row || row.claimedStep !== args.p_claim_token) {
        return { single: async () => ({ data: { ok: false, reason: row ? "claim_expired" : "not_found" }, error: null }) };
      }
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
  mockBuildCoursePlan.mockReset();
  mockPerformCourseStepUnit.mockReset();
  mockSaveCourse.mockReset();
  mockCreateAnthropicClient.mockClear();
});

const ANALYSIS: Analysis = {
  title: "Formation test",
  domain: "Test",
  level: "débutant",
  angle: "pratique",
  usesRealWorldExamples: false,
  moduleCount: 2,
};
const VERIFIED_EXAMPLES: VerifiedExample[] = [];
const PROGRAMME: Programme = {
  introduction: "Introduction",
  objectives: ["Objectif"],
  summaryAngle: "Angle",
  modules: [
    { title: "Module 1", objective: "Objectif 1", chapters: [
      { title: "L1", summary: "S1", exampleIndex: null },
      { title: "L2", summary: "S2", exampleIndex: null },
      { title: "L3", summary: "S3", exampleIndex: null },
    ] },
    { title: "Module 2", objective: "Objectif 2", chapters: [
      { title: "L4", summary: "S4", exampleIndex: null },
      { title: "L5", summary: "S5", exampleIndex: null },
      { title: "L6", summary: "S6", exampleIndex: null },
    ] },
  ],
};
const INVALID_PROGRAMME: Programme = {
  introduction: "Introduction",
  objectives: ["Objectif"],
  summaryAngle: "Angle",
  modules: [{ title: "Module 1", objective: "Objectif 1", chapters: [
    { title: "L1", summary: "S1", exampleIndex: null },
    { title: "L2", summary: "S2", exampleIndex: null },
    { title: "L3", summary: "S3", exampleIndex: null },
  ] }],
};

async function callRoute(body: Record<string, unknown>, origin?: string) {
  const { POST } = await import("@/app/api/courses/generate/route");
  const response = await POST(
    new Request("http://localhost/api/courses/generate", {
      method: "POST",
      headers: origin ? { origin, "Content-Type": "application/json" } : { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  const json = await response.json().catch(() => null);
  return { response, json };
}

describe("POST /api/courses/generate — vérification d'origine", () => {
  it("renvoie 403 pour une origine externe non autorisée, avant toute action", async () => {
    const { response } = await callRoute({ action: "start", idempotencyKey: "k1", topic: "Sujet" }, "https://evil.example");
    expect(response.status).toBe(403);
  });
});

describe("POST /api/courses/generate — action 'start'", () => {
  it("rejette un plan dont la structure est invalide, AVANT toute réservation de quota", async () => {
    const { response, json } = await callRoute({
      action: "start",
      idempotencyKey: "k1",
      topic: "Sujet",
      plan: { analysis: ANALYSIS, verifiedExamples: VERIFIED_EXAMPLES, programme: INVALID_PROGRAMME },
    });

    expect(response.status).toBe(400);
    expect(json.error).toMatch(/structure/i);
    const startCalls = currentSupabaseMock.rpcCalls.filter((c) => c.fnName === "start_generation_task");
    expect(startCalls).toHaveLength(0);
  });

  it("réserve un quota et renvoie reservationId pour un plan valide (parcours diagnostic guidé)", async () => {
    const { response, json } = await callRoute({
      action: "start",
      idempotencyKey: "k1",
      topic: "Sujet",
      plan: { analysis: ANALYSIS, verifiedExamples: VERIFIED_EXAMPLES, programme: PROGRAMME },
    });

    expect(response.status).toBe(200);
    expect(json.reservationId).toBe("00000000-0000-4000-8000-000000000001");
    expect(mockBuildCoursePlan).not.toHaveBeenCalled();
  });

  it("construit le plan côté serveur pour le parcours 'configuration rapide' (sans plan)", async () => {
    mockBuildCoursePlan.mockResolvedValue({ analysis: ANALYSIS, verifiedExamples: VERIFIED_EXAMPLES, programme: PROGRAMME });

    const { response, json } = await callRoute({ action: "start", idempotencyKey: "k1", topic: "Sujet" });

    expect(response.status).toBe(200);
    expect(json.reservationId).toBeDefined();
    expect(mockBuildCoursePlan).toHaveBeenCalledTimes(1);
  });

  it("rejouer 'start' avec la MÊME clé d'idempotence renvoie la même réservation, sans consommer un second quota", async () => {
    const body = { action: "start", idempotencyKey: "same-key", topic: "Sujet", plan: { analysis: ANALYSIS, verifiedExamples: VERIFIED_EXAMPLES, programme: PROGRAMME } };

    const first = await callRoute(body);
    const second = await callRoute(body);

    expect(first.json.reservationId).toBe(second.json.reservationId);
    const startCalls = currentSupabaseMock.rpcCalls.filter((c) => c.fnName === "start_generation_task");
    expect(startCalls).toHaveLength(2); // deux appels HTTP, mais une seule vraie réservation (vérifié ci-dessus).
  });

  it("renvoie 403 avec le message de quota si le RPC start_generation_task refuse (quota atteint)", async () => {
    currentSupabaseMock.rpc = vi.fn(() => ({
      single: async () => ({ data: { reservation_id: null, already_existed: false, ok: false, is_pro: false, limit_count: 1, used_count: 1 }, error: null }),
    })) as never;

    const { response, json } = await callRoute({
      action: "start",
      idempotencyKey: "k1",
      topic: "Sujet",
      plan: { analysis: ANALYSIS, verifiedExamples: VERIFIED_EXAMPLES, programme: PROGRAMME },
    });

    expect(response.status).toBe(403);
    expect(json.error).toContain("formation");
  });
});

describe("POST /api/courses/generate — action 'step'", () => {
  async function startOne() {
    const { json } = await callRoute({
      action: "start",
      idempotencyKey: "k1",
      topic: "Sujet",
      plan: { analysis: ANALYSIS, verifiedExamples: VERIFIED_EXAMPLES, programme: PROGRAMME },
    });
    return json.reservationId as string;
  }

  it("renvoie 404 pour une réservation introuvable", async () => {
    const { response, json } = await callRoute({ action: "step", reservationId: "00000000-0000-0000-0000-000000000000" });
    expect(response.status).toBe(404);
    expect(json.error).toBeDefined();
  });

  it("exécute une seule unité de travail par appel et avance la progression", async () => {
    const reservationId = await startOne();
    mockPerformCourseStepUnit.mockResolvedValue({
      chapters: { "0": { position: 0, title: "L1", explanation: "x", keyTakeaway: "x", example: { isReal: false, description: "x", sourceUrl: null, sourceTitle: null } } },
    });

    const { response, json } = await callRoute({ action: "step", reservationId });

    expect(response.status).toBe(200);
    expect(json.done).toBe(false);
    expect(json.stage).toBe("chapitres");
    expect(mockPerformCourseStepUnit).toHaveBeenCalledTimes(1);
  });

  it("libère immédiatement la réservation sur une erreur métier fatale (CourseGenerationError), sans attendre 15 minutes", async () => {
    const reservationId = await startOne();
    const { CourseGenerationError } = await vi.importActual<typeof import("@/lib/courses/generate")>("@/lib/courses/generate");
    mockPerformCourseStepUnit.mockRejectedValue(new CourseGenerationError("Contenu de leçon invalide."));

    const { response, json } = await callRoute({ action: "step", reservationId });

    expect(response.status).toBe(200);
    expect(json.done).toBe(true);
    expect(json.fatalError).toBe("Contenu de leçon invalide.");
    const releaseCalls = currentSupabaseMock.rpcCalls.filter((c) => c.fnName === "resolve_generation_slot" && (c.args as { p_status?: string }).p_status === "released");
    expect(releaseCalls).toHaveLength(1);
  });

  it("ne libère JAMAIS la réservation sur une erreur transitoire, et indique au client de réessayer", async () => {
    const reservationId = await startOne();
    mockPerformCourseStepUnit.mockRejectedValue(new Error("panne réseau transitoire"));

    const { response, json } = await callRoute({ action: "step", reservationId });

    expect(response.status).toBe(200);
    expect(json.done).toBe(false);
    expect(json.transientError).toBe(true);
    const releaseCalls = currentSupabaseMock.rpcCalls.filter((c) => c.fnName === "resolve_generation_slot");
    expect(releaseCalls).toHaveLength(0);
  });

  it("deux appels 'step' simultanés sur la même réservation : un seul avance, l'autre reçoit busy:true (jamais la même étape exécutée deux fois)", async () => {
    const reservationId = await startOne();
    mockPerformCourseStepUnit.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ chapters: { "0": { position: 0, title: "L1", explanation: "x", keyTakeaway: "x", example: { isReal: false, description: "x", sourceUrl: null, sourceTitle: null } } } }), 20)),
    );

    const [first, second] = await Promise.all([
      callRoute({ action: "step", reservationId }),
      callRoute({ action: "step", reservationId }),
    ]);

    const busyResponses = [first.json, second.json].filter((j) => j.busy === true);
    const workedResponses = [first.json, second.json].filter((j) => j.busy !== true);
    expect(busyResponses).toHaveLength(1);
    expect(workedResponses).toHaveLength(1);
    expect(mockPerformCourseStepUnit).toHaveBeenCalledTimes(1);
  });

  it("assemble et sauvegarde la formation à la dernière étape, via le RPC atomique existant (save_generated_course réutilisé via saveCourse)", async () => {
    const reservationId = await startOne();
    // Simule une progression déjà complète (toutes les étapes faites) en
    // committant directement l'état attendu par decideNextCourseStep,
    // pour atteindre "assemble" en un seul appel "step".
    const row = currentSupabaseMock.state.reservations.get(reservationId)!;
    row.progress = {
      stage: "quizFinal",
      chapters: Object.fromEntries(
        Array.from({ length: 6 }, (_, i) => [String(i), { position: i, title: `L${i}`, explanation: "x", keyTakeaway: "x", example: { isReal: false, description: "x", sourceUrl: null, sourceTitle: null } }]),
      ),
      moduleQuizzes: { "0": [], "1": [] },
      summary: { summary: "Résumé", keyPoints: [] },
      finalQuiz: [],
    };
    mockSaveCourse.mockResolvedValue("course-123");

    const { response, json } = await callRoute({ action: "step", reservationId });

    expect(response.status).toBe(200);
    expect(json.done).toBe(true);
    expect(json.courseId).toBe("course-123");
    expect(json.course).toBeDefined();
    expect(mockSaveCourse).toHaveBeenCalledTimes(1);
    expect(mockSaveCourse).toHaveBeenCalledWith(currentSupabaseMock, expect.any(Object), reservationId);
  });

  it("si la sauvegarde finale échoue, libère la réservation et renvoie un avertissement sans perdre le contenu généré", async () => {
    const reservationId = await startOne();
    const row = currentSupabaseMock.state.reservations.get(reservationId)!;
    row.progress = {
      stage: "quizFinal",
      chapters: Object.fromEntries(
        Array.from({ length: 6 }, (_, i) => [String(i), { position: i, title: `L${i}`, explanation: "x", keyTakeaway: "x", example: { isReal: false, description: "x", sourceUrl: null, sourceTitle: null } }]),
      ),
      moduleQuizzes: { "0": [], "1": [] },
      summary: { summary: "Résumé", keyPoints: [] },
      finalQuiz: [],
    };
    mockSaveCourse.mockRejectedValue(new Error("colonne manquante"));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { response, json } = await callRoute({ action: "step", reservationId });

    expect(response.status).toBe(200);
    expect(json.courseId).toBeNull();
    expect(json.course).toBeDefined();
    expect(json.saveWarning).toBeDefined();
    expect(JSON.stringify(json)).not.toContain("colonne manquante");
    const releaseCalls = currentSupabaseMock.rpcCalls.filter((c) => c.fnName === "resolve_generation_slot" && (c.args as { p_status?: string }).p_status === "released");
    expect(releaseCalls).toHaveLength(1);
    consoleErrorSpy.mockRestore();
  });

  it("renvoie alreadyResolved:true sans refaire de travail si la génération est déjà terminée", async () => {
    const reservationId = await startOne();
    const row = currentSupabaseMock.state.reservations.get(reservationId)!;
    row.status = "completed";

    const { response, json } = await callRoute({ action: "step", reservationId });

    expect(response.status).toBe(200);
    expect(json.done).toBe(true);
    expect(json.alreadyResolved).toBe(true);
    expect(mockPerformCourseStepUnit).not.toHaveBeenCalled();
  });
});
