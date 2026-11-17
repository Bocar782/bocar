// Vrais tests automatisés (Prompt 05.18.1) : importent et exécutent le VRAI
// handler POST de route.ts. Seules les frontières externes (client
// Supabase, client Anthropic, les fonctions de generate.ts) sont mockées —
// aucun appel réel à Anthropic ni à Supabase. Vérifie en particulier que
// cette route n'appelle JAMAIS la moindre RPC de réservation de quota
// (`reserve_generation_slot`) : le diagnostic et la construction/
// l'ajustement du plan ne doivent jamais consommer une place de génération.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Analysis, Programme, VerifiedExample } from "@/lib/courses/schemas";

const mockGenerateDiagnosticQuestion = vi.fn();
const mockBuildCoursePlan = vi.fn();

class FakeCourseGenerationError extends Error {}

vi.mock("@/lib/courses/generate", () => ({
  generateDiagnosticQuestion: (...args: unknown[]) => mockGenerateDiagnosticQuestion(...args),
  buildCoursePlan: (...args: unknown[]) => mockBuildCoursePlan(...args),
  CourseGenerationError: FakeCourseGenerationError,
  MAX_DIAGNOSTIC_QUESTIONS: 5,
}));

const mockCreateAnthropicClient = vi.fn(() => ({ fakeClient: true }));
vi.mock("@/lib/anthropic/client", () => ({
  createAnthropicClient: () => mockCreateAnthropicClient(),
}));

type RpcCall = { fnName: string; args: unknown };

function makeSupabaseMock(authenticated: boolean) {
  const rpcCalls: RpcCall[] = [];
  return {
    auth: {
      getUser: vi.fn(async () =>
        authenticated ? { data: { user: { id: "user-1" } } } : { data: { user: null } },
      ),
    },
    rpc: vi.fn((fnName: string, args: unknown) => {
      rpcCalls.push({ fnName, args });
      return Promise.resolve({ data: null, error: null });
    }),
    rpcCalls,
  };
}

let currentSupabaseMock = makeSupabaseMock(true);

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => currentSupabaseMock,
}));

beforeEach(() => {
  currentSupabaseMock = makeSupabaseMock(true);
  mockGenerateDiagnosticQuestion.mockReset();
  mockBuildCoursePlan.mockReset();
  mockCreateAnthropicClient.mockClear();
});

const FAKE_ANALYSIS: Analysis = {
  title: "Formation test",
  domain: "Test",
  level: "débutant",
  angle: "pratique",
  usesRealWorldExamples: false,
  moduleCount: 2,
};

const FAKE_VERIFIED_EXAMPLES: VerifiedExample[] = [];

const FAKE_PROGRAMME: Programme = {
  introduction: "Introduction",
  objectives: ["Objectif"],
  summaryAngle: "Angle",
  modules: [
    {
      title: "Module 1",
      objective: "Objectif module 1",
      chapters: [
        { title: "Leçon 1", summary: "Résumé 1", exampleIndex: null },
        { title: "Leçon 2", summary: "Résumé 2", exampleIndex: null },
        { title: "Leçon 3", summary: "Résumé 3", exampleIndex: null },
      ],
    },
    {
      title: "Module 2",
      objective: "Objectif module 2",
      chapters: [
        { title: "Leçon 4", summary: "Résumé 4", exampleIndex: null },
        { title: "Leçon 5", summary: "Résumé 5", exampleIndex: null },
        { title: "Leçon 6", summary: "Résumé 6", exampleIndex: null },
      ],
    },
  ],
};

async function callRoute(body: unknown, origin?: string) {
  const { POST } = await import("@/app/api/courses/plan/route");
  const response = await POST(
    new Request("http://localhost/api/courses/plan", {
      method: "POST",
      headers: origin ? { origin, "Content-Type": "application/json" } : { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  const json = await response.json().catch(() => null);
  return { response, json };
}

describe("POST /api/courses/plan — vérification d'origine et d'authentification", () => {
  it("renvoie 403 pour une origine externe non autorisée, avant toute action", async () => {
    const { response } = await callRoute({ action: "question", topic: "Sujet", previousAnswers: [] }, "https://evil.example");

    expect(response.status).toBe(403);
    expect(mockGenerateDiagnosticQuestion).not.toHaveBeenCalled();
  });

  it("renvoie 401 si l'utilisateur n'est pas authentifié", async () => {
    currentSupabaseMock = makeSupabaseMock(false);

    const { response, json } = await callRoute({ action: "question", topic: "Sujet", previousAnswers: [] });

    expect(response.status).toBe(401);
    expect(json?.error).toBe("Non authentifié.");
    expect(mockGenerateDiagnosticQuestion).not.toHaveBeenCalled();
  });
});

describe("POST /api/courses/plan — validation des entrées", () => {
  it("renvoie 400 pour un corps invalide (action inconnue)", async () => {
    const { response } = await callRoute({ action: "nope", topic: "Sujet" });

    expect(response.status).toBe(400);
  });

  it("renvoie 400 pour un sujet vide", async () => {
    const { response } = await callRoute({ action: "question", topic: "   ", previousAnswers: [] });

    expect(response.status).toBe(400);
  });

  it("renvoie 400 pour une action 'adjust' sans plan précédent fourni", async () => {
    const { response } = await callRoute({
      action: "adjust",
      topic: "Sujet",
      diagnosticAnswers: [],
      adjustmentRequest: "Plus d'exemples",
      // analysis/verifiedExamples/programme manquants.
    });

    expect(response.status).toBe(400);
  });
});

describe("POST /api/courses/plan — action 'question' (diagnostic)", () => {
  it("transmet le sujet et l'historique des réponses à generateDiagnosticQuestion, sans jamais réserver de quota", async () => {
    mockGenerateDiagnosticQuestion.mockResolvedValue({
      id: "q2",
      question: "Quel est ton objectif ?",
      type: "single_choice",
      choices: ["A", "B"],
    });
    const previousAnswers = [{ questionId: "q1", question: "Niveau ?", answer: "Débutant" }];

    const { response, json } = await callRoute({ action: "question", topic: "Sujet", previousAnswers });

    expect(response.status).toBe(200);
    expect(json.question).toEqual({
      id: "q2",
      question: "Quel est ton objectif ?",
      type: "single_choice",
      choices: ["A", "B"],
    });
    expect(mockGenerateDiagnosticQuestion).toHaveBeenCalledWith(
      { fakeClient: true },
      "Sujet",
      previousAnswers,
    );
    expect(currentSupabaseMock.rpcCalls).toHaveLength(0);
  });

  it("renvoie question:null quand le diagnostic est terminé, sans erreur", async () => {
    mockGenerateDiagnosticQuestion.mockResolvedValue(null);

    const { response, json } = await callRoute({ action: "question", topic: "Sujet", previousAnswers: [] });

    expect(response.status).toBe(200);
    expect(json.question).toBeNull();
  });
});

describe("POST /api/courses/plan — action 'build'", () => {
  it("construit le plan à partir du sujet et des réponses du diagnostic, sans jamais réserver de quota", async () => {
    const fakePlan = {
      analysis: FAKE_ANALYSIS,
      verifiedExamples: FAKE_VERIFIED_EXAMPLES,
      programme: FAKE_PROGRAMME,
      estimatedMinutes: 120,
    };
    mockBuildCoursePlan.mockResolvedValue(fakePlan);
    const diagnosticAnswers = [{ questionId: "q1", question: "Niveau ?", answer: "Débutant" }];

    const { response, json } = await callRoute({ action: "build", topic: "Sujet", diagnosticAnswers });

    expect(response.status).toBe(200);
    expect(json).toEqual(fakePlan);
    expect(mockBuildCoursePlan).toHaveBeenCalledWith({ fakeClient: true }, "Sujet", {
      diagnosticAnswers,
    });
    expect(currentSupabaseMock.rpcCalls).toHaveLength(0);
  });
});

describe("POST /api/courses/plan — action 'adjust'", () => {
  it("transmet le plan précédent complet et la demande d'ajustement à buildCoursePlan, sans jamais réserver de quota", async () => {
    const adjustedPlan = {
      analysis: FAKE_ANALYSIS,
      verifiedExamples: FAKE_VERIFIED_EXAMPLES,
      programme: { ...FAKE_PROGRAMME, introduction: "Introduction ajustée" },
      estimatedMinutes: 130,
    };
    mockBuildCoursePlan.mockResolvedValue(adjustedPlan);

    const { response, json } = await callRoute({
      action: "adjust",
      topic: "Sujet",
      diagnosticAnswers: [],
      adjustmentRequest: "Ajoute plus d'exercices pratiques",
      analysis: FAKE_ANALYSIS,
      verifiedExamples: FAKE_VERIFIED_EXAMPLES,
      programme: FAKE_PROGRAMME,
    });

    expect(response.status).toBe(200);
    expect(json).toEqual(adjustedPlan);
    expect(mockBuildCoursePlan).toHaveBeenCalledWith({ fakeClient: true }, "Sujet", {
      diagnosticAnswers: [],
      adjustmentRequest: "Ajoute plus d'exercices pratiques",
      previousAnalysis: FAKE_ANALYSIS,
      previousVerifiedExamples: FAKE_VERIFIED_EXAMPLES,
      previousProgramme: FAKE_PROGRAMME,
    });
    expect(currentSupabaseMock.rpcCalls).toHaveLength(0);
  });
});

describe("POST /api/courses/plan — gestion des erreurs", () => {
  it("conserve le message d'une CourseGenerationError (erreur métier conçue pour être affichée)", async () => {
    mockGenerateDiagnosticQuestion.mockRejectedValue(
      new FakeCourseGenerationError("Impossible de générer les questions de diagnostic pour ce sujet."),
    );

    const { response, json } = await callRoute({ action: "question", topic: "Sujet", previousAnswers: [] });

    expect(response.status).toBe(502);
    expect(json?.error).toBe("Impossible de générer les questions de diagnostic pour ce sujet.");
  });

  it("ne révèle jamais le détail d'une erreur inattendue (non métier)", async () => {
    const sensitiveDetail = 'relation "public.secret_table" does not exist';
    mockBuildCoursePlan.mockRejectedValue(new Error(sensitiveDetail));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { response, json } = await callRoute({ action: "build", topic: "Sujet", diagnosticAnswers: [] });

    expect(response.status).toBe(502);
    expect(json?.error).toBe("Une erreur est survenue. Réessaie dans un instant.");
    expect(JSON.stringify(json)).not.toContain("secret_table");
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
