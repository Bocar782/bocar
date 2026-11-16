// Vrais tests automatisés (Prompt 05.9, dernières sécurisations) :
// importent et exécutent le VRAI handler POST de route.ts (pas une copie
// de son flux try/catch) ainsi que le vrai src/lib/courses/persist.ts et
// src/lib/courses/reservation.ts qu'il appelle en interne. Seules les
// frontières externes (client Supabase, generateCourse) sont mockées.
// Aucun appel réel à Anthropic ni à Supabase.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GeneratedCourse } from "@/lib/courses/schemas";

const mockGenerateCourse = vi.fn();

vi.mock("@/lib/courses/generate", () => ({
  generateCourse: (...args: unknown[]) => mockGenerateCourse(...args),
  CourseGenerationError: class CourseGenerationError extends Error {},
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

async function callRoute() {
  const { POST } = await import("@/app/api/courses/generate/route");
  const response = await POST(
    new Request("http://localhost/api/courses/generate", {
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
});
