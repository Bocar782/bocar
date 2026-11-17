// Vrais tests automatisés (Prompt 05.16.1, correctif E1) : importent et
// exécutent le VRAI handler POST de route.ts ET le VRAI
// src/lib/chat/rate-limit.ts qu'il appelle en interne — seules les
// frontières externes (client Supabase, getCourseById, client Anthropic)
// sont mockées. Aucun appel réel à Anthropic ni à Supabase.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GeneratedCourse } from "@/lib/courses/schemas";

const FAKE_COURSE: GeneratedCourse = {
  topic: "Sujet",
  title: "Formation test",
  domain: "Test",
  level: "débutant",
  introduction: "Intro",
  objectives: [],
  chapters: [
    {
      position: 0,
      title: "Chapitre 1",
      explanation: "Explication",
      keyTakeaway: "Retenir",
      example: { isReal: false, description: "Exemple", sourceUrl: null, sourceTitle: null },
    },
  ],
  modules: [],
  summary: "Résumé",
  keyPoints: [],
  quiz: [],
};

const mockGetCourseById = vi.fn();
vi.mock("@/lib/courses/persist", () => ({
  getCourseById: (...args: unknown[]) => mockGetCourseById(...args),
}));

const mockAnthropicStream = vi.fn();
vi.mock("@/lib/anthropic/client", () => ({
  createAnthropicClient: () => ({
    messages: { stream: (...args: unknown[]) => mockAnthropicStream(...args) },
  }),
}));

type RateLimitRpcResult = {
  single: () => Promise<{
    data: {
      ok: boolean;
      is_pro: boolean;
      limit_hour: number;
      used_hour: number;
      limit_day: number;
      used_day: number;
    } | null;
    error: Error | null;
  }>;
};

function makeSupabaseMock(rateLimitResult: RateLimitRpcResult["single"]) {
  const rpcCalls: { fnName: string; args: unknown }[] = [];
  const rpc = vi.fn((fnName: string, args?: unknown): RateLimitRpcResult => {
    rpcCalls.push({ fnName, args });
    return { single: rateLimitResult };
  });
  return {
    auth: {
      getUser: vi.fn(async (): Promise<{ data: { user: { id: string } | null } }> => ({
        data: { user: { id: "user-1" } },
      })),
    },
    rpc,
    rpcCalls,
  };
}

const okRateLimit: RateLimitRpcResult["single"] = async () => ({
  data: { ok: true, is_pro: false, limit_hour: 15, used_hour: 3, limit_day: 40, used_day: 10 },
  error: null,
});

let currentSupabaseMock = makeSupabaseMock(okRateLimit);

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => currentSupabaseMock,
}));

function fakeAnthropicStreamImpl(text: string) {
  return {
    on(event: string, cb: (delta: string) => void) {
      if (event === "text") cb(text);
      return this;
    },
    async finalMessage() {
      return { stop_reason: "end_turn" as const };
    },
  };
}

beforeEach(() => {
  currentSupabaseMock = makeSupabaseMock(okRateLimit);
  mockGetCourseById.mockReset();
  mockGetCourseById.mockResolvedValue(FAKE_COURSE);
  mockAnthropicStream.mockReset();
  mockAnthropicStream.mockReturnValue(fakeAnthropicStreamImpl("Réponse de Tavyra"));
});

async function callRoute(body: Record<string, unknown>, origin?: string) {
  const { POST } = await import("@/app/api/chat/route");
  const response = await POST(
    new Request("http://localhost/api/chat", {
      method: "POST",
      headers: origin ? { origin } : undefined,
      body: JSON.stringify(body),
    }),
  );
  return response;
}

const VALID_BODY = {
  courseId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  currentChapterIndex: 0,
  messages: [{ role: "user", content: "Explique-moi ce chapitre." }],
};

describe("POST /api/chat (vrai route.ts + vrai rate-limit.ts)", () => {
  it("renvoie 403 pour une origine externe non autorisée, avant toute authentification ou appel Anthropic", async () => {
    const response = await callRoute(VALID_BODY, "https://evil.example");

    expect(response.status).toBe(403);
    expect(mockAnthropicStream).not.toHaveBeenCalled();
    const rateLimitCalls = currentSupabaseMock.rpcCalls.filter((c) => c.fnName === "check_chat_rate_limit");
    expect(rateLimitCalls).toHaveLength(0);
  });

  it("laisse passer une requête sans en-tête Origin (pas de blocage injustifié)", async () => {
    const response = await callRoute(VALID_BODY, undefined);

    expect(response.status).toBe(200);
  });

  it("renvoie 401 si non authentifié, sans jamais appeler Anthropic", async () => {
    currentSupabaseMock.auth.getUser = vi.fn(async () => ({ data: { user: null } }));

    const response = await callRoute(VALID_BODY);

    expect(response.status).toBe(401);
    expect(mockAnthropicStream).not.toHaveBeenCalled();
  });

  it("renvoie 400 pour un corps invalide, sans jamais appeler Anthropic", async () => {
    const response = await callRoute({ courseId: "pas-un-uuid" });

    expect(response.status).toBe(400);
    expect(mockAnthropicStream).not.toHaveBeenCalled();
  });

  it("renvoie 404 si la formation est introuvable, sans jamais appeler Anthropic", async () => {
    mockGetCourseById.mockResolvedValue(null);

    const response = await callRoute(VALID_BODY);

    expect(response.status).toBe(404);
    expect(mockAnthropicStream).not.toHaveBeenCalled();
  });

  it("appelle bien Anthropic et streame la réponse quand la limite n'est pas atteinte (non-régression)", async () => {
    const response = await callRoute(VALID_BODY);

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain("Réponse de Tavyra");
    expect(mockAnthropicStream).toHaveBeenCalledTimes(1);

    const rateLimitCalls = currentSupabaseMock.rpcCalls.filter((c) => c.fnName === "check_chat_rate_limit");
    expect(rateLimitCalls).toHaveLength(1);
  });

  it("renvoie 429 avec un message compréhensible et n'appelle JAMAIS Anthropic quand la limite horaire est atteinte", async () => {
    currentSupabaseMock = makeSupabaseMock(async () => ({
      data: { ok: false, is_pro: false, limit_hour: 15, used_hour: 15, limit_day: 40, used_day: 20 },
      error: null,
    }));

    const response = await callRoute(VALID_BODY);

    expect(response.status).toBe(429);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toMatch(/15 messages par heure/);
    expect(mockAnthropicStream).not.toHaveBeenCalled();
  });

  it("renvoie 429 avec le message journalier quand c'est la limite du jour qui est atteinte", async () => {
    currentSupabaseMock = makeSupabaseMock(async () => ({
      data: { ok: false, is_pro: true, limit_hour: 50, used_hour: 10, limit_day: 150, used_day: 150 },
      error: null,
    }));

    const response = await callRoute(VALID_BODY);

    expect(response.status).toBe(429);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toMatch(/150 messages par jour/);
    expect(mockAnthropicStream).not.toHaveBeenCalled();
  });

  it("renvoie 503 sans appeler Anthropic quand la vérification de limite échoue techniquement", async () => {
    currentSupabaseMock = makeSupabaseMock(async () => ({
      data: null,
      error: new Error("RPC indisponible"),
    }));

    const response = await callRoute(VALID_BODY);

    expect(response.status).toBe(503);
    expect(mockAnthropicStream).not.toHaveBeenCalled();
  });

  it("une tentative de contournement côté client (champs forgés : plan Pro, quota, limite) est sans aucun effet", async () => {
    // Le RPC check_chat_rate_limit() ne prend AUCUN paramètre : rien de ce
    // que le navigateur envoie ne peut donc jamais l'atteindre. On force
    // malgré tout le mock à refuser, pour prouver que des champs fabriqués
    // dans le corps de la requête ne changent strictement rien à la
    // décision — toujours entièrement déterminée côté serveur.
    currentSupabaseMock = makeSupabaseMock(async () => ({
      data: { ok: false, is_pro: false, limit_hour: 15, used_hour: 15, limit_day: 40, used_day: 1 },
      error: null,
    }));

    const response = await callRoute({
      ...VALID_BODY,
      isPro: true,
      plan: "pro",
      rateLimitOverride: { ok: true },
      remaining: 999999,
    });

    expect(response.status).toBe(429);
    expect(mockAnthropicStream).not.toHaveBeenCalled();
    // Le RPC a bien été appelé sans aucun argument — rien du corps de la
    // requête ne lui est transmis.
    const rateLimitCall = currentSupabaseMock.rpcCalls.find((c) => c.fnName === "check_chat_rate_limit");
    expect(rateLimitCall?.args).toBeUndefined();
  });
});
