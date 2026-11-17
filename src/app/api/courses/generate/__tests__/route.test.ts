// Vrais tests automatisés (Prompt 05.9, dernières sécurisations ; étendus
// en 05.18.1 pour le parcours "plan validé") : importent et exécutent le
// VRAI handler POST de route.ts (pas une copie de son flux try/catch) ainsi
// que le vrai src/lib/courses/persist.ts et src/lib/courses/reservation.ts
// qu'il appelle en interne. Seules les frontières externes (client
// Supabase, generateCourse/generateCourseFromPlan) sont mockées. Aucun
// appel réel à Anthropic ni à Supabase. `validateProgrammeStructure` est la
// VRAIE fonction (pure, sans IA ni réseau) : on veut vérifier son vrai
// comportement de rejet avant réservation, pas une version simulée.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Analysis, GeneratedCourse, Programme, VerifiedExample } from "@/lib/courses/schemas";

const mockGenerateCourse = vi.fn();
const mockGenerateCourseFromPlan = vi.fn();

vi.mock("@/lib/courses/generate", async () => {
  const actual = await vi.importActual<typeof import("@/lib/courses/generate")>(
    "@/lib/courses/generate",
  );
  return {
    generateCourse: (...args: unknown[]) => mockGenerateCourse(...args),
    generateCourseFromPlan: (...args: unknown[]) => mockGenerateCourseFromPlan(...args),
    validateProgrammeStructure: actual.validateProgrammeStructure,
    CourseGenerationError: class CourseGenerationError extends Error {},
  };
});

const mockCreateAnthropicClient = vi.fn(() => ({ fakeClient: true }));
vi.mock("@/lib/anthropic/client", () => ({
  createAnthropicClient: () => mockCreateAnthropicClient(),
}));

type RpcCall = { fnName: string; args: unknown };

// Type large volontairement : les différents tests font répondre `rpc()`
// avec des formes différentes selon le scénario (succès, échec de
// sauvegarde...), toujours l'une de ces deux formes réellement utilisées
// par le vrai code (voir reservation.ts/persist.ts).
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
          data: { ok: true, reservation_id: "res-1", is_pro: false, limit_count: 1, used_count: 1 },
          error: null,
        }),
      };
    }
    if (fnName === "save_generated_course") {
      return Promise.resolve({ data: "course-id", error: null });
    }
    // resolve_generation_slot (consommation/libération)
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
  currentSupabaseMock = makeSupabaseMock();
  mockGenerateCourse.mockReset();
  mockGenerateCourseFromPlan.mockReset();
  mockCreateAnthropicClient.mockClear();
});

const FAKE_COURSE: GeneratedCourse = {
  topic: "Sujet",
  title: "Formation test",
  domain: "Test",
  level: "débutant",
  introduction: "Intro",
  objectives: ["Obj"],
  chapters: [],
  modules: [],
  summary: "Résumé",
  keyPoints: ["Point"],
  quiz: [],
};

async function callRoute(origin?: string, body?: Record<string, unknown>) {
  const { POST } = await import("@/app/api/courses/generate/route");
  const response = await POST(
    new Request("http://localhost/api/courses/generate", {
      method: "POST",
      headers: origin ? { origin } : undefined,
      body: JSON.stringify(body ?? { topic: "Un sujet de test" }),
    }),
  );
  if (response.status !== 200) {
    const json = await response.json().catch(() => null);
    return { response, lines: [], json };
  }
  const text = await response.text();
  const lines = text
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Record<string, unknown>);
  return { response, lines, json: null as Record<string, unknown> | null };
}

const FAKE_ANALYSIS: Analysis = {
  title: "Formation test",
  domain: "Test",
  level: "débutant",
  angle: "pratique",
  usesRealWorldExamples: false,
  moduleCount: 2,
};

const FAKE_VERIFIED_EXAMPLES: VerifiedExample[] = [];

const VALID_PROGRAMME: Programme = {
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

// Structure invalide : un seul module (le minimum réel est 2, voir
// MIN_MODULE_COUNT dans generate.ts) — doit être rejetée par
// validateProgrammeStructure() avant toute réservation de quota.
const INVALID_PROGRAMME: Programme = {
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
  ],
};

describe("POST /api/courses/generate (vrai route.ts + vraie vérification d'origine)", () => {
  it("renvoie 403 pour une origine externe non autorisée, avant toute génération", async () => {
    const { response } = await callRoute("https://evil.example");

    expect(response.status).toBe(403);
    expect(mockGenerateCourse).not.toHaveBeenCalled();
  });

  it("laisse passer une requête sans en-tête Origin (pas de blocage injustifié)", async () => {
    mockGenerateCourse.mockResolvedValue(FAKE_COURSE);

    const { response } = await callRoute(undefined);

    expect(response.status).toBe(200);
  });
});

describe("POST /api/courses/generate (vrai route.ts + vrai persist.ts/reservation.ts)", () => {
  it("n'enregistre jamais la formation et libère la réservation quand generateCourse() échoue", async () => {
    mockGenerateCourse.mockRejectedValue(new Error("échec simulé de génération"));

    const { lines } = await callRoute();

    expect(lines.some((l) => l.stage === "error" && typeof l.message === "string" && (l.message as string).length > 0)).toBe(
      true,
    );

    const saveCalls = currentSupabaseMock.rpcCalls.filter((c) => c.fnName === "save_generated_course");
    expect(saveCalls).toHaveLength(0);

    const releaseCalls = currentSupabaseMock.rpcCalls.filter(
      (c) => c.fnName === "resolve_generation_slot" && (c.args as { p_status?: string }).p_status === "released",
    );
    expect(releaseCalls).toHaveLength(1);
  });

  it("enregistre la formation une seule fois et ne libère jamais la réservation en cas de succès complet", async () => {
    mockGenerateCourse.mockResolvedValue(FAKE_COURSE);

    const { lines } = await callRoute();

    expect(lines.some((l) => l.stage === "done" && l.courseId === "course-id")).toBe(true);

    const saveCalls = currentSupabaseMock.rpcCalls.filter((c) => c.fnName === "save_generated_course");
    expect(saveCalls).toHaveLength(1);

    const releaseCalls = currentSupabaseMock.rpcCalls.filter((c) => c.fnName === "resolve_generation_slot");
    expect(releaseCalls).toHaveLength(0);
  });

  it("libère la réservation si la génération réussit mais que la sauvegarde échoue, sans jamais réessayer generateCourse()", async () => {
    mockGenerateCourse.mockResolvedValue(FAKE_COURSE);
    currentSupabaseMock.rpc.mockImplementation((fnName: string, args: unknown): RpcMockResult => {
      currentSupabaseMock.rpcCalls.push({ fnName, args });
      if (fnName === "reserve_generation_slot") {
        return {
          single: async () => ({
            data: { ok: true, reservation_id: "res-1", is_pro: false, limit_count: 1, used_count: 1 },
            error: null,
          }),
        };
      }
      if (fnName === "save_generated_course") {
        return Promise.resolve({ data: null, error: new Error("RPC indisponible") });
      }
      return Promise.resolve({ data: true, error: null });
    });

    const { lines } = await callRoute();

    expect(mockGenerateCourse).toHaveBeenCalledTimes(1);
    expect(lines.some((l) => l.stage === "done" && l.courseId === null && typeof l.saveWarning === "string")).toBe(
      true,
    );

    const releaseCalls = currentSupabaseMock.rpcCalls.filter(
      (c) => c.fnName === "resolve_generation_slot" && (c.args as { p_status?: string }).p_status === "released",
    );
    expect(releaseCalls).toHaveLength(1);
  });

  // Prompt 05.16.1 (correctif E3, audit de sécurité 05.16) : une erreur
  // Supabase/Postgres simulée, contenant du détail interne (nom de table,
  // colonne, contrainte), ne doit jamais atteindre la réponse HTTP.
  it("ne révèle jamais le détail d'une erreur de sauvegarde Supabase simulée (table/colonne/contrainte)", async () => {
    mockGenerateCourse.mockResolvedValue(FAKE_COURSE);
    const sensitiveDetail =
      'column "secret_internal_column" of relation "public.courses" violates not-null constraint "courses_secret_check"';
    currentSupabaseMock.rpc.mockImplementation((fnName: string, args: unknown): RpcMockResult => {
      currentSupabaseMock.rpcCalls.push({ fnName, args });
      if (fnName === "reserve_generation_slot") {
        return {
          single: async () => ({
            data: { ok: true, reservation_id: "res-1", is_pro: false, limit_count: 1, used_count: 1 },
            error: null,
          }),
        };
      }
      if (fnName === "save_generated_course") {
        return Promise.resolve({ data: null, error: new Error(sensitiveDetail) });
      }
      return Promise.resolve({ data: true, error: null });
    });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { response, lines } = await callRoute();
    const fullBody = JSON.stringify(lines);

    expect(response.status).toBe(200);
    expect(fullBody).not.toContain("secret_internal_column");
    expect(fullBody).not.toContain("constraint");
    expect(fullBody).not.toContain("relation");
    const doneLine = lines.find((l) => l.stage === "done");
    expect(doneLine?.saveWarning).toBe(
      "La formation a été générée mais n'a pas pu être enregistrée. Réessaie, ou contacte le support si le problème persiste.",
    );
    // Le détail reste disponible côté serveur (logs), juste jamais dans la réponse.
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("ne révèle jamais le détail d'une erreur inattendue (non métier) pendant la génération", async () => {
    const sensitiveDetail = 'relation "public.secret_table" does not exist';
    mockGenerateCourse.mockRejectedValue(new Error(sensitiveDetail));

    const { response, lines } = await callRoute();
    const fullBody = JSON.stringify(lines);

    expect(response.status).toBe(200);
    expect(fullBody).not.toContain("secret_table");
    expect(fullBody).not.toContain("relation");
    const errorLine = lines.find((l) => l.stage === "error");
    expect(errorLine?.message).toBe("Une erreur est survenue pendant la génération. Réessaie dans un instant.");
  });

  it("conserve le message d'une CourseGenerationError (erreur métier conçue pour être affichée)", async () => {
    const { CourseGenerationError } = await import("@/lib/courses/generate");
    mockGenerateCourse.mockRejectedValue(
      new CourseGenerationError("Le sujet proposé est trop vague pour construire une formation."),
    );

    const { lines } = await callRoute();

    const errorLine = lines.find((l) => l.stage === "error");
    expect(errorLine?.message).toBe("Le sujet proposé est trop vague pour construire une formation.");
  });
});

// Prompt 05.18.1 : parcours "plan validé" (diagnostic guidé) — un plan
// construit par /api/courses/plan, potentiellement modifié par
// l'utilisateur, est transmis dans le corps de la requête.
describe("POST /api/courses/generate — plan validé (Prompt 05.18.1)", () => {
  it("rejette un plan dont la structure est invalide (ex: un seul module) AVANT toute réservation de quota", async () => {
    const { response, json } = await callRoute(undefined, {
      topic: "Un sujet de test",
      plan: { analysis: FAKE_ANALYSIS, verifiedExamples: FAKE_VERIFIED_EXAMPLES, programme: INVALID_PROGRAMME },
    });

    expect(response.status).toBe(400);
    expect(json?.error).toMatch(/structure/i);
    expect(mockGenerateCourse).not.toHaveBeenCalled();
    expect(mockGenerateCourseFromPlan).not.toHaveBeenCalled();
    const reserveCalls = currentSupabaseMock.rpcCalls.filter((c) => c.fnName === "reserve_generation_slot");
    expect(reserveCalls).toHaveLength(0);
  });

  it("réserve un quota puis appelle generateCourseFromPlan (jamais generateCourse) pour un plan valide", async () => {
    mockGenerateCourseFromPlan.mockResolvedValue(FAKE_COURSE);

    const { lines } = await callRoute(undefined, {
      topic: "Un sujet de test",
      plan: { analysis: FAKE_ANALYSIS, verifiedExamples: FAKE_VERIFIED_EXAMPLES, programme: VALID_PROGRAMME },
    });

    expect(lines.some((l) => l.stage === "done" && l.courseId === "course-id")).toBe(true);
    expect(mockGenerateCourse).not.toHaveBeenCalled();
    expect(mockGenerateCourseFromPlan).toHaveBeenCalledWith(
      { fakeClient: true },
      "Un sujet de test",
      FAKE_ANALYSIS,
      FAKE_VERIFIED_EXAMPLES,
      VALID_PROGRAMME,
      expect.any(Function),
    );

    const reserveCalls = currentSupabaseMock.rpcCalls.filter((c) => c.fnName === "reserve_generation_slot");
    expect(reserveCalls).toHaveLength(1);
  });

  it("transmet reservationId comme toute première ligne du flux NDJSON, avant le moindre évènement de progression", async () => {
    mockGenerateCourseFromPlan.mockResolvedValue(FAKE_COURSE);

    const { lines } = await callRoute(undefined, {
      topic: "Un sujet de test",
      plan: { analysis: FAKE_ANALYSIS, verifiedExamples: FAKE_VERIFIED_EXAMPLES, programme: VALID_PROGRAMME },
    });

    expect(lines[0]).toEqual({ reservationId: "res-1" });
  });

  it("applique le même comportement pour le parcours 'configuration rapide' (sans plan) : reservationId toujours en première ligne", async () => {
    mockGenerateCourse.mockResolvedValue(FAKE_COURSE);

    const { lines } = await callRoute();

    expect(lines[0]).toEqual({ reservationId: "res-1" });
  });
});
