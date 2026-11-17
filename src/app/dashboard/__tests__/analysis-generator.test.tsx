// @vitest-environment jsdom
//
// Vrai test (Prompt 05.20.1, architecture à étapes courtes — même
// mécanisme que CourseGenerator) : importe et rend le VRAI composant
// AnalysisGenerator dans un DOM jsdom. `fetch` est mocké pour répondre au
// contrat JSON start/step (plus de NDJSON) ; `getGenerationStatus` et
// sessionStorage sont également contrôlés.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GeneratedDeepAnalysis } from "@/lib/analysis/schemas";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockRefresh = vi.fn();
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh, push: mockPush }),
}));

const mockGetGenerationStatus = vi.fn();
vi.mock("@/lib/courses/generation-status", () => ({
  getGenerationStatus: (...args: unknown[]) => mockGetGenerationStatus(...args),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mockRefresh.mockClear();
  mockPush.mockClear();
  mockGetGenerationStatus.mockReset();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

type FetchCall = { url: string; body: Record<string, unknown> };
let fetchCalls: FetchCall[] = [];
let fetchHandler: (
  url: string,
  body: Record<string, unknown>,
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

function installFetchMock() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(init.body as string) : {};
      fetchCalls.push({ url, body });
      return fetchHandler(url, body);
    }),
  );
}

function jsonResponse(payload: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
}

const FAKE_ANALYSIS: GeneratedDeepAnalysis = {
  topic: "Sujet",
  title: "Analyse test générée",
  domain: "Test",
  introduction: "Intro",
  sections: [
    { position: 0, name: "Section 1", outcome: "succès", content: "Contenu 1", lessons: ["Leçon"], source: { index: 0, url: "https://example.com", title: "Source" } },
  ],
  synthesis: "Synthèse",
  keyLessons: ["Leçon clé"],
  sources: [],
};

const NATIVE_TEXTAREA_VALUE_SETTER = Object.getOwnPropertyDescriptor(
  window.HTMLTextAreaElement.prototype,
  "value",
)!.set!;

async function renderGenerator(props: { remainingGenerations: number; isPro: boolean }) {
  const { AnalysisGenerator } = await import("@/app/dashboard/analysis-generator");
  await act(async () => {
    root.render(<AnalysisGenerator {...props} />);
  });
}

async function typeSubjectAndSubmit(topic: string) {
  const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
  const form = container.querySelector("form") as HTMLFormElement;
  await act(async () => {
    NATIVE_TEXTAREA_VALUE_SETTER.call(textarea, topic);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function flush(times = 1) {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

beforeEach(() => {
  fetchCalls = [];
});

describe("AnalysisGenerator — état initial", () => {
  it("affiche le mur Pro pour un utilisateur Free (jamais de formulaire)", async () => {
    await renderGenerator({ remainingGenerations: 0, isPro: false });
    expect(container.textContent).toContain("Fonctionnalité réservée au plan Pro");
    expect(container.querySelector("textarea")).toBeNull();
    expect(container.querySelector('a[href="/pricing"]')).not.toBeNull();
  });

  it("affiche le quota atteint pour un utilisateur Pro qui a épuisé ses analyses du mois", async () => {
    await renderGenerator({ remainingGenerations: 0, isPro: true });
    expect(container.textContent).toContain("Limite mensuelle atteinte");
  });

  it("affiche le formulaire pour un Pro avec du quota restant", async () => {
    await renderGenerator({ remainingGenerations: 1, isPro: true });
    const button = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Lancer l'analyse") as HTMLButtonElement;
    expect(button.disabled).toBe(true); // sujet vide.
  });
});

describe("AnalysisGenerator — lancement et boucle d'étapes courtes", () => {
  it("appelle 'start' puis boucle 'step' jusqu'à la fin, et affiche le résultat", async () => {
    installFetchMock();
    fetchHandler = async (_url, body) => {
      if (body.action === "start") {
        expect(body.topic).toBe("Un sujet de test");
        return jsonResponse({ reservationId: "res-1" });
      }
      return jsonResponse({ done: true, analysisId: "analysis-123", analysis: FAKE_ANALYSIS, saveWarning: null });
    };

    await renderGenerator({ remainingGenerations: 1, isPro: true });
    await typeSubjectAndSubmit("Un sujet de test");

    expect(container.textContent).toContain("Analyse test générée");
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("enchaîne plusieurs appels 'step' en affichant la progression avant la fin", async () => {
    installFetchMock();
    let stepCount = 0;
    fetchHandler = async (_url, body) => {
      if (body.action === "start") return jsonResponse({ reservationId: "res-1" });
      stepCount += 1;
      if (stepCount < 3) return jsonResponse({ done: false, stage: "redaction", label: "Rédaction de l'analyse... (1/4)" });
      return jsonResponse({ done: true, analysisId: "a1", analysis: FAKE_ANALYSIS, saveWarning: null });
    };

    await renderGenerator({ remainingGenerations: 1, isPro: true });
    await typeSubjectAndSubmit("Un sujet de test");

    expect(stepCount).toBe(3);
    expect(container.textContent).toContain("Analyse test générée");
  });

  it("affiche le message d'erreur fatale renvoyé par le serveur", async () => {
    installFetchMock();
    fetchHandler = async (_url, body) => {
      if (body.action === "start") return jsonResponse({ reservationId: "res-1" });
      return jsonResponse({ done: true, fatalError: "Le sujet proposé ne permet pas d'identifier de cas réels pertinents." });
    };

    await renderGenerator({ remainingGenerations: 1, isPro: true });
    await typeSubjectAndSubmit("Un sujet de test");

    expect(container.textContent).toContain("Le sujet proposé ne permet pas d'identifier de cas réels pertinents.");
    expect(container.querySelector("textarea")).not.toBeNull();
  });

  it("protège contre une double soumission (deux soumissions rapides ne lancent qu'un seul 'start')", async () => {
    installFetchMock();
    let startCallCount = 0;
    fetchHandler = async (_url, body) => {
      if (body.action === "start") {
        startCallCount += 1;
        return jsonResponse({ reservationId: "res-1" });
      }
      return jsonResponse({ done: true, analysisId: "a1", analysis: FAKE_ANALYSIS, saveWarning: null });
    };

    await renderGenerator({ remainingGenerations: 1, isPro: true });
    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    const form = container.querySelector("form") as HTMLFormElement;
    await act(async () => {
      NATIVE_TEXTAREA_VALUE_SETTER.call(textarea, "Un sujet de test");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(startCallCount).toBe(1);
  });

  it("persiste l'idempotencyKey en sessionStorage AVANT le premier appel réseau", async () => {
    installFetchMock();
    fetchHandler = async () => new Promise(() => {});

    await renderGenerator({ remainingGenerations: 1, isPro: true });
    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    const form = container.querySelector("form") as HTMLFormElement;
    await act(async () => {
      NATIVE_TEXTAREA_VALUE_SETTER.call(textarea, "Un sujet de test");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const stored = JSON.parse(sessionStorage.getItem("tavyra:analysis-generation") ?? "null");
    expect(stored?.idempotencyKey).toBeDefined();
    expect(stored?.reservationId).toBeNull();
  });
});

describe("AnalysisGenerator — rechargement pendant une génération (Prompt 05.20.1)", () => {
  it("rejoue 'start' avec la MÊME clé si reservationId n'a jamais été reçu avant le rechargement", async () => {
    sessionStorage.setItem(
      "tavyra:analysis-generation",
      JSON.stringify({ idempotencyKey: "idem-stored", reservationId: null, topic: "Sujet repris", startedAt: Date.now() }),
    );
    installFetchMock();
    fetchHandler = async (_url, body) => {
      if (body.action === "start") {
        expect(body.idempotencyKey).toBe("idem-stored");
        return jsonResponse({ reservationId: "res-resumed" });
      }
      return jsonResponse({ done: true, analysisId: "a1", analysis: FAKE_ANALYSIS, saveWarning: null });
    };

    await renderGenerator({ remainingGenerations: 1, isPro: true });
    await flush(3);

    expect(container.textContent).toContain("Analyse test générée");
  });

  it("reprend directement la boucle d'étapes courtes si reservationId était déjà connu, sans redémarrer", async () => {
    sessionStorage.setItem(
      "tavyra:analysis-generation",
      JSON.stringify({ idempotencyKey: "idem-stored", reservationId: "res-known", topic: "Sujet repris", startedAt: Date.now() }),
    );
    installFetchMock();
    fetchHandler = async (_url, body) => {
      expect(body.action).toBe("step");
      expect(body.reservationId).toBe("res-known");
      return jsonResponse({ done: true, analysisId: "a1", analysis: FAKE_ANALYSIS, saveWarning: null });
    };

    await renderGenerator({ remainingGenerations: 1, isPro: true });
    await flush(3);

    expect(container.textContent).toContain("Analyse test générée");
  });

  it("redirige vers l'analyse terminée si le serveur signale alreadyResolved et un resourceId", async () => {
    sessionStorage.setItem(
      "tavyra:analysis-generation",
      JSON.stringify({ idempotencyKey: "idem-stored", reservationId: "res-known", topic: "Sujet repris", startedAt: Date.now() }),
    );
    installFetchMock();
    fetchHandler = async () => jsonResponse({ done: true, alreadyResolved: true });
    mockGetGenerationStatus.mockResolvedValue({ status: "completed", resourceId: "analysis-xyz", stage: null, lastError: null, createdAt: null });

    await renderGenerator({ remainingGenerations: 1, isPro: true });
    await flush(3);

    expect(mockPush).toHaveBeenCalledWith("/dashboard/analyses/analysis-xyz");
    expect(sessionStorage.getItem("tavyra:analysis-generation")).toBeNull();
  });

  it("affiche un message d'échec si le serveur signale alreadyResolved sans succès (libérée/expirée)", async () => {
    sessionStorage.setItem(
      "tavyra:analysis-generation",
      JSON.stringify({ idempotencyKey: "idem-stored", reservationId: "res-known", topic: "Sujet repris", startedAt: Date.now() }),
    );
    installFetchMock();
    fetchHandler = async () => jsonResponse({ done: true, alreadyResolved: true });
    mockGetGenerationStatus.mockResolvedValue({ status: "released", resourceId: null, stage: null, lastError: null, createdAt: null });

    await renderGenerator({ remainingGenerations: 1, isPro: true });
    await flush(3);

    expect(container.textContent).toMatch(/arrêtée|expiré/i);
  });

  it("sans aucune génération en cours en sessionStorage, démarre normalement en 'idle' (non-régression)", async () => {
    await renderGenerator({ remainingGenerations: 1, isPro: true });
    expect(mockGetGenerationStatus).not.toHaveBeenCalled();
    expect(container.querySelector("textarea")).not.toBeNull();
  });
});
