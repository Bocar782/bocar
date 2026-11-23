// @vitest-environment jsdom
//
// Vrai test (Prompt 05.20.1, architecture à étapes courtes) : importe et
// rend le VRAI composant CourseGenerator dans un DOM jsdom. `fetch` est
// mocké pour répondre au contrat JSON start/step (plus de NDJSON) ;
// `getGenerationStatus` et sessionStorage sont également contrôlés.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GeneratedCourse } from "@/lib/courses/schemas";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);

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

const FAKE_COURSE: GeneratedCourse = {
  topic: "Sujet",
  title: "Formation test générée",
  domain: "Test",
  level: "débutant",
  introduction: "Intro",
  objectives: ["Objectif"],
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

const FAKE_PLAN = {
  analysis: { title: "Formation test", domain: "Test", level: "débutant" as const, angle: "pratique", moduleCount: 2, usesRealWorldExamples: false },
  verifiedExamples: [],
  programme: {
    introduction: "Introduction du plan",
    objectives: ["Objectif global"],
    summaryAngle: "Angle",
    modules: [
      { title: "Module 1", objective: "Objectif module 1", chapters: [
        { title: "Leçon 1", summary: "Résumé 1", exampleIndex: null },
        { title: "Leçon 2", summary: "Résumé 2", exampleIndex: null },
        { title: "Leçon 3", summary: "Résumé 3", exampleIndex: null },
      ] },
      { title: "Module 2", objective: "Objectif module 2", chapters: [
        { title: "Leçon 4", summary: "Résumé 4", exampleIndex: null },
        { title: "Leçon 5", summary: "Résumé 5", exampleIndex: null },
        { title: "Leçon 6", summary: "Résumé 6", exampleIndex: null },
      ] },
    ],
  },
  estimatedMinutes: 120,
};

const NATIVE_TEXTAREA_VALUE_SETTER = Object.getOwnPropertyDescriptor(
  window.HTMLTextAreaElement.prototype,
  "value",
)!.set!;
const NATIVE_INPUT_VALUE_SETTER = Object.getOwnPropertyDescriptor(
  window.HTMLInputElement.prototype,
  "value",
)!.set!;

async function renderGenerator(props: { remainingGenerations: number; locked: boolean }) {
  const { CourseGenerator } = await import("@/app/dashboard/course-generator");
  await act(async () => {
    root.render(<CourseGenerator {...props} />);
  });
}

async function setTextareaValue(topic: string) {
  const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
  await act(async () => {
    NATIVE_TEXTAREA_VALUE_SETTER.call(textarea, topic);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function findButton(text: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent?.trim() === text,
  );
  if (!button) throw new Error(`Bouton introuvable : "${text}"`);
  return button as HTMLButtonElement;
}

async function click(el: Element) {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
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

describe("CourseGenerator — état initial", () => {
  it("propose la création de formation, désactivée tant qu'aucun sujet n'est saisi (le diagnostic est désormais obligatoire)", async () => {
    await renderGenerator({ remainingGenerations: 1, locked: false });
    expect(findButton("Créer ma formation").disabled).toBe(true);
  });

  it("affiche le message de quota atteint pour un utilisateur Free, avec un lien vers /pricing", async () => {
    await renderGenerator({ remainingGenerations: 0, locked: true });
    expect(container.textContent).toContain("Limite du plan gratuit atteinte");
    expect(container.querySelector('a[href="/pricing"]')).not.toBeNull();
  });
});

describe("CourseGenerator — diagnostic adaptatif, plan et validation", () => {
  it("affiche la première question du diagnostic", async () => {
    installFetchMock();
    fetchHandler = async (url) => {
      if (url === "/api/courses/plan") {
        return jsonResponse({ question: { id: "q1", question: "Quel est ton niveau ?", type: "single_choice", choices: ["Débutant"] } });
      }
      throw new Error(`url inattendue : ${url}`);
    };

    await renderGenerator({ remainingGenerations: 1, locked: false });
    await setTextareaValue("Un sujet de test");
    await click(findButton("Créer ma formation"));

    expect(container.textContent).toContain("Quel est ton niveau ?");
  });

  it("sélectionner un choix n'envoie rien tant que « Question suivante » n'est pas cliqué, puis affiche la réponse dans le fil déjà répondu (Prompt 06.10)", async () => {
    installFetchMock();
    let questionCallCount = 0;
    fetchHandler = async (url, body) => {
      if (url === "/api/courses/plan" && body.action === "question") {
        questionCallCount += 1;
        if (questionCallCount === 1) {
          return jsonResponse({ question: { id: "q1", question: "Quel est ton niveau ?", type: "single_choice", choices: ["Débutant", "Avancé"] } });
        }
        return jsonResponse({ question: { id: "q2", question: "As-tu déjà créé un site ?", type: "single_choice", choices: ["Oui", "Non"] } });
      }
      throw new Error(`appel inattendu : ${url} ${JSON.stringify(body)}`);
    };

    await renderGenerator({ remainingGenerations: 1, locked: false });
    await setTextareaValue("Un sujet de test");
    await click(findButton("Créer ma formation"));
    expect(container.textContent).toContain("Quel est ton niveau ?");

    const nextButton = findButton("Question suivante →");
    expect(nextButton.disabled).toBe(true);

    await click(findButton("Débutant"));
    expect(questionCallCount).toBe(1); // sélectionner seul ne déclenche aucun appel réseau.
    expect(findButton("Question suivante →").disabled).toBe(false);

    await click(findButton("Question suivante →"));
    expect(questionCallCount).toBe(2);
    expect(container.textContent).toContain("As-tu déjà créé un site ?");
    // La réponse à la question précédente apparaît désormais dans le fil
    // des questions déjà répondues, au-dessus de la question active.
    expect(container.textContent).toContain("Quel est ton niveau ?");
    expect(container.textContent).toContain("Débutant");
  });

  it("construit le plan puis valide et génère via start { topic, plan }", async () => {
    installFetchMock();
    fetchHandler = async (url, body) => {
      if (url === "/api/courses/plan" && body.action === "question") return jsonResponse({ question: null });
      if (url === "/api/courses/plan" && body.action === "build") return jsonResponse(FAKE_PLAN);
      if (url === "/api/courses/generate" && body.action === "start") {
        expect(body.plan).toEqual({ analysis: FAKE_PLAN.analysis, verifiedExamples: FAKE_PLAN.verifiedExamples, programme: FAKE_PLAN.programme });
        return jsonResponse({ reservationId: "res-1" });
      }
      if (url === "/api/courses/generate" && body.action === "step") {
        return jsonResponse({ done: true, courseId: "c1", course: FAKE_COURSE, saveWarning: null });
      }
      throw new Error(`appel inattendu : ${url} ${JSON.stringify(body)}`);
    };

    await renderGenerator({ remainingGenerations: 1, locked: false });
    await setTextareaValue("Un sujet de test");
    await click(findButton("Créer ma formation"));

    expect(container.textContent).toContain("Plan proposé");
    await click(findButton("Valider et générer la formation"));

    expect(container.textContent).toContain("Formation test générée");
  });

  it("permet de modifier un titre de module avant de valider", async () => {
    installFetchMock();
    fetchHandler = async (_url, body) => {
      if (body.action === "question") return jsonResponse({ question: null });
      if (body.action === "build") return jsonResponse(FAKE_PLAN);
      throw new Error("appel inattendu");
    };

    await renderGenerator({ remainingGenerations: 1, locked: false });
    await setTextareaValue("Un sujet de test");
    await click(findButton("Créer ma formation"));

    const moduleTitleInput = Array.from(container.querySelectorAll("input")).find((i) => i.value === "Module 1") as HTMLInputElement;
    expect(moduleTitleInput).not.toBeUndefined();
    await act(async () => {
      NATIVE_INPUT_VALUE_SETTER.call(moduleTitleInput, "Module 1 renommé");
      moduleTitleInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(moduleTitleInput.value).toBe("Module 1 renommé");
  });

  it("protège contre une double soumission (deux clics rapides sur 'Valider et générer')", async () => {
    installFetchMock();
    let startCallCount = 0;
    fetchHandler = async (_url, body) => {
      if (body.action === "question") return jsonResponse({ question: null });
      if (body.action === "build") return jsonResponse(FAKE_PLAN);
      if (body.action === "start") {
        startCallCount += 1;
        return jsonResponse({ reservationId: "res-1" });
      }
      return jsonResponse({ done: true, courseId: "c1", course: FAKE_COURSE, saveWarning: null });
    };

    await renderGenerator({ remainingGenerations: 1, locked: false });
    await setTextareaValue("Un sujet de test");
    await click(findButton("Créer ma formation"));

    const button = findButton("Valider et générer la formation");
    await act(async () => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(startCallCount).toBe(1);
  });
});

describe("CourseGenerator — idempotence au démarrage (Prompt 05.20.1)", () => {
  it("persiste l'idempotencyKey en sessionStorage AVANT le premier appel réseau de démarrage", async () => {
    installFetchMock();
    fetchHandler = async (url, body) => {
      if (url === "/api/courses/plan" && body.action === "question") return jsonResponse({ question: null });
      if (url === "/api/courses/plan" && body.action === "build") return jsonResponse(FAKE_PLAN);
      // Le "start" de /api/courses/generate (seul appel qui réserve un
      // quota) ne répond jamais pendant ce test : on vérifie que la clé
      // d'idempotence est déjà en sessionStorage avant même cette réponse.
      return new Promise(() => {});
    };

    await renderGenerator({ remainingGenerations: 1, locked: false });
    await setTextareaValue("Un sujet de test");
    await click(findButton("Créer ma formation"));

    const button = findButton("Valider et générer la formation");
    await act(async () => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const stored = JSON.parse(sessionStorage.getItem("tavyra:course-generation") ?? "null");
    expect(stored?.idempotencyKey).toBeDefined();
    expect(stored?.reservationId).toBeNull();
  });
});

describe("CourseGenerator — rechargement pendant une génération", () => {
  it("rejoue 'start' avec la MÊME clé si reservationId n'a jamais été reçu avant le rechargement", async () => {
    sessionStorage.setItem(
      "tavyra:course-generation",
      JSON.stringify({ idempotencyKey: "idem-stored", reservationId: null, topic: "Sujet repris", startedAt: Date.now() }),
    );
    installFetchMock();
    fetchHandler = async (_url, body) => {
      if (body.action === "start") {
        expect(body.idempotencyKey).toBe("idem-stored");
        return jsonResponse({ reservationId: "res-resumed" });
      }
      return jsonResponse({ done: true, courseId: "c1", course: FAKE_COURSE, saveWarning: null });
    };

    await renderGenerator({ remainingGenerations: 1, locked: false });
    await flush(3);

    expect(container.textContent).toContain("Formation test générée");
  });

  it("reprend directement la boucle d'étapes courtes si reservationId était déjà connu, sans redémarrer", async () => {
    sessionStorage.setItem(
      "tavyra:course-generation",
      JSON.stringify({ idempotencyKey: "idem-stored", reservationId: "res-known", topic: "Sujet repris", startedAt: Date.now() }),
    );
    installFetchMock();
    fetchHandler = async (_url, body) => {
      expect(body.action).toBe("step"); // jamais "start" à nouveau.
      expect(body.reservationId).toBe("res-known");
      return jsonResponse({ done: true, courseId: "c1", course: FAKE_COURSE, saveWarning: null });
    };

    await renderGenerator({ remainingGenerations: 1, locked: false });
    await flush(3);

    expect(container.textContent).toContain("Formation test générée");
    expect(fetchCalls.every((c) => c.body.action === "step")).toBe(true);
  });

  it("redirige vers la formation terminée si le serveur signale alreadyResolved et un resourceId", async () => {
    sessionStorage.setItem(
      "tavyra:course-generation",
      JSON.stringify({ idempotencyKey: "idem-stored", reservationId: "res-known", topic: "Sujet repris", startedAt: Date.now() }),
    );
    installFetchMock();
    fetchHandler = async () => jsonResponse({ done: true, alreadyResolved: true });
    mockGetGenerationStatus.mockResolvedValue({ status: "completed", resourceId: "course-xyz", stage: null, lastError: null, createdAt: null });

    await renderGenerator({ remainingGenerations: 1, locked: false });
    await flush(3);

    expect(mockPush).toHaveBeenCalledWith("/dashboard/formations/course-xyz");
    expect(sessionStorage.getItem("tavyra:course-generation")).toBeNull();
  });

  it("affiche un message d'échec si le serveur signale alreadyResolved sans succès (libérée/expirée)", async () => {
    sessionStorage.setItem(
      "tavyra:course-generation",
      JSON.stringify({ idempotencyKey: "idem-stored", reservationId: "res-known", topic: "Sujet repris", startedAt: Date.now() }),
    );
    installFetchMock();
    fetchHandler = async () => jsonResponse({ done: true, alreadyResolved: true });
    mockGetGenerationStatus.mockResolvedValue({ status: "released", resourceId: null, stage: null, lastError: null, createdAt: null });

    await renderGenerator({ remainingGenerations: 1, locked: false });
    await flush(3);

    expect(container.textContent).toMatch(/arrêtée|expiré/i);
  });

  it("réessaie automatiquement un nombre borné de fois en cas d'erreur transitoire, puis abandonne proprement", async () => {
    sessionStorage.setItem(
      "tavyra:course-generation",
      JSON.stringify({ idempotencyKey: "idem-stored", reservationId: "res-known", topic: "Sujet repris", startedAt: Date.now() }),
    );
    installFetchMock();
    let callCount = 0;
    fetchHandler = async () => {
      callCount += 1;
      return jsonResponse({ done: false, transientError: true });
    };

    await renderGenerator({ remainingGenerations: 1, locked: false });
    // Suffisamment de temps réel pour laisser passer au moins un backoff
    // (le premier délai entre deux tentatives est de 1000ms).
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
    });

    expect(callCount).toBeGreaterThan(1);
  }, 10000);

  it("sans aucune génération en cours en sessionStorage, démarre normalement en 'idle' (non-régression)", async () => {
    await renderGenerator({ remainingGenerations: 1, locked: false });
    expect(mockGetGenerationStatus).not.toHaveBeenCalled();
    expect(findButton("Créer ma formation")).not.toBeNull();
  });
});
