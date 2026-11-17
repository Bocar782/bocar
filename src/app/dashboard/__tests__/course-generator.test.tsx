// @vitest-environment jsdom
//
// Vrai test (Prompt 05.18.1) : importe et rend le VRAI composant
// CourseGenerator dans un DOM jsdom — seules les frontières externes
// (`fetch`, `getGenerationStatus`, sessionStorage) sont mockées/contrôlées.
// Couvre le nouveau parcours en plusieurs étapes (diagnostic adaptatif,
// plan modifiable, validation, génération réelle, reprise après
// rechargement) exigé par ce prompt.
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

function ndjsonStream(lines: Record<string, unknown>[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`));
      }
      controller.close();
    },
  });
}

type FetchCall = { url: string; body: unknown };
let fetchCalls: FetchCall[] = [];
let fetchHandler: (url: string, body: unknown) => Promise<{ ok: boolean; status: number; body?: ReadableStream<Uint8Array>; json: () => Promise<unknown> }>;

function installFetchMock() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      fetchCalls.push({ url, body });
      return fetchHandler(url, body);
    }),
  );
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
  analysis: {
    title: "Formation test",
    domain: "Test",
    level: "débutant" as const,
    angle: "pratique",
    moduleCount: 2,
    usesRealWorldExamples: false,
  },
  verifiedExamples: [],
  programme: {
    introduction: "Introduction du plan",
    objectives: ["Objectif global"],
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

beforeEach(() => {
  fetchCalls = [];
});

describe("CourseGenerator — état initial (Prompt 05.18.1)", () => {
  it("propose le diagnostic guidé ET la configuration rapide, désactivés tant qu'aucun sujet n'est saisi", async () => {
    await renderGenerator({ remainingGenerations: 1, locked: false });

    expect(findButton("Créer avec le diagnostic guidé").disabled).toBe(true);
    expect(findButton("Configuration rapide (sans diagnostic)").disabled).toBe(true);
  });

  it("affiche le message de quota atteint pour un utilisateur Free, avec un lien vers /pricing", async () => {
    await renderGenerator({ remainingGenerations: 0, locked: true });

    expect(container.textContent).toContain("Limite du plan gratuit atteinte");
    expect(container.querySelector('a[href="/pricing"]')).not.toBeNull();
  });

  it("affiche le message de quota atteint pour un utilisateur Pro (texte différent)", async () => {
    await renderGenerator({ remainingGenerations: 0, locked: false });

    expect(container.textContent).toContain("Limite mensuelle atteinte");
  });
});

describe("CourseGenerator — configuration rapide (parcours inchangé, sans diagnostic)", () => {
  it("appelle directement /api/courses/generate avec { topic } seul, sans jamais appeler /api/courses/plan", async () => {
    installFetchMock();
    fetchHandler = async () => ({
      ok: true,
      status: 200,
      body: ndjsonStream([{ stage: "done", courseId: "course-1", course: FAKE_COURSE, saveWarning: null }]),
      json: async () => ({}),
    });

    await renderGenerator({ remainingGenerations: 1, locked: false });
    await setTextareaValue("Un sujet de test");
    await click(findButton("Configuration rapide (sans diagnostic)"));

    expect(container.textContent).toContain("Formation test générée");
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].url).toBe("/api/courses/generate");
    expect(fetchCalls[0].body).toEqual({ topic: "Un sujet de test" });
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("affiche le message d'erreur du serveur sur un stage 'error' (scénario : erreur pendant une génération)", async () => {
    installFetchMock();
    fetchHandler = async () => ({
      ok: true,
      status: 200,
      body: ndjsonStream([{ stage: "error", message: "Le sujet proposé ne permet pas de générer une formation." }]),
      json: async () => ({}),
    });

    await renderGenerator({ remainingGenerations: 1, locked: false });
    await setTextareaValue("Un sujet de test");
    await click(findButton("Configuration rapide (sans diagnostic)"));

    expect(container.textContent).toContain("Le sujet proposé ne permet pas de générer une formation.");
    expect(container.querySelector("textarea")).not.toBeNull();
  });
});

describe("CourseGenerator — diagnostic adaptatif (Prompt 05.18.1)", () => {
  it("affiche la première question renvoyée par le serveur après avoir cliqué sur le diagnostic guidé", async () => {
    installFetchMock();
    fetchHandler = async (url) => {
      if (url === "/api/courses/plan") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            question: { id: "q1", question: "Quel est ton niveau actuel ?", type: "single_choice", choices: ["Débutant", "Avancé"] },
          }),
        };
      }
      throw new Error(`url inattendue : ${url}`);
    };

    await renderGenerator({ remainingGenerations: 1, locked: false });
    await setTextareaValue("Un sujet de test");
    await click(findButton("Créer avec le diagnostic guidé"));

    expect(container.textContent).toContain("Quel est ton niveau actuel ?");
    expect(fetchCalls[0].body).toEqual({ action: "question", topic: "Un sujet de test", previousAnswers: [] });
  });

  it("transmet la réponse choisie, enchaîne les questions, puis construit le plan quand le serveur signale la fin du diagnostic", async () => {
    installFetchMock();
    let questionCallCount = 0;
    fetchHandler = async (url, body) => {
      if (url === "/api/courses/plan" && (body as { action: string }).action === "question") {
        questionCallCount += 1;
        if (questionCallCount === 1) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              question: { id: "q1", question: "Quel est ton niveau ?", type: "single_choice", choices: ["Débutant"] },
            }),
          };
        }
        return { ok: true, status: 200, json: async () => ({ question: null }) };
      }
      if (url === "/api/courses/plan" && (body as { action: string }).action === "build") {
        return { ok: true, status: 200, json: async () => FAKE_PLAN };
      }
      throw new Error(`appel inattendu : ${url} ${JSON.stringify(body)}`);
    };

    await renderGenerator({ remainingGenerations: 1, locked: false });
    await setTextareaValue("Un sujet de test");
    await click(findButton("Créer avec le diagnostic guidé"));
    await click(findButton("Débutant"));

    // Le deuxième appel "question" transmet bien la réponse donnée.
    const questionCalls = fetchCalls.filter(
      (c) => c.url === "/api/courses/plan" && (c.body as { action: string }).action === "question",
    );
    expect(questionCalls).toHaveLength(2);
    expect(
      (questionCalls[1].body as { previousAnswers: { answer: string }[] }).previousAnswers[0].answer,
    ).toBe("Débutant");

    // Le plan proposé est maintenant affiché.
    expect(container.textContent).toContain("Plan proposé");
    expect(container.textContent).toContain("Module 1");
    const buildCall = fetchCalls.find(
      (c) => c.url === "/api/courses/plan" && (c.body as { action: string }).action === "build",
    );
    expect(buildCall).toBeDefined();
  });

  it("permet d'ignorer le diagnostic à tout moment et de passer à la configuration rapide", async () => {
    installFetchMock();
    fetchHandler = async (url, body) => {
      if (url === "/api/courses/plan") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            question: { id: "q1", question: "Quel est ton niveau ?", type: "single_choice", choices: ["Débutant"] },
          }),
        };
      }
      if (url === "/api/courses/generate") {
        expect(body).toEqual({ topic: "Un sujet de test" }); // jamais de plan/diagnostic transmis ici.
        return {
          ok: true,
          status: 200,
          body: ndjsonStream([{ stage: "done", courseId: "c1", course: FAKE_COURSE, saveWarning: null }]),
          json: async () => ({}),
        };
      }
      throw new Error(`url inattendue : ${url}`);
    };

    await renderGenerator({ remainingGenerations: 1, locked: false });
    await setTextareaValue("Un sujet de test");
    await click(findButton("Créer avec le diagnostic guidé"));

    expect(container.textContent).toContain("Quel est ton niveau ?");
    await click(findButton("Passer directement à la configuration rapide (sans diagnostic)"));

    expect(container.textContent).toContain("Formation test générée");
  });
});

describe("CourseGenerator — plan proposé, modification, ajustement et validation (Prompt 05.18.1)", () => {
  async function reachPlanReview() {
    installFetchMock();
    fetchHandler = async (url, body) => {
      if (url === "/api/courses/plan" && (body as { action: string }).action === "question") {
        return { ok: true, status: 200, json: async () => ({ question: null }) };
      }
      if (url === "/api/courses/plan" && (body as { action: string }).action === "build") {
        return { ok: true, status: 200, json: async () => FAKE_PLAN };
      }
      throw new Error(`appel inattendu : ${url}`);
    };

    await renderGenerator({ remainingGenerations: 1, locked: false });
    await setTextareaValue("Un sujet de test");
    await click(findButton("Créer avec le diagnostic guidé"));
  }

  it("affiche les modules/leçons/objectifs/durée estimée du plan", async () => {
    await reachPlanReview();

    expect(container.textContent).toContain("Module 1");
    expect(container.textContent).toContain("Module 2");
    expect(container.textContent).toContain("Objectif global");
    expect(container.textContent).toContain("Durée estimée");
  });

  it("permet de modifier un titre de module avant de valider", async () => {
    await reachPlanReview();

    // Les inputs contrôlés par React n'exposent pas leur valeur via
    // l'attribut HTML `value` (seulement via la propriété JS) : on ne peut
    // donc pas les retrouver avec un sélecteur CSS `input[value=...]`.
    const moduleTitleInput = Array.from(container.querySelectorAll("input")).find(
      (input) => input.value === "Module 1",
    ) as HTMLInputElement;
    expect(moduleTitleInput).not.toBeUndefined();
    await act(async () => {
      NATIVE_INPUT_VALUE_SETTER.call(moduleTitleInput, "Module 1 renommé");
      moduleTitleInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    // `textContent` n'inclut jamais la valeur d'un <input> (ce n'est pas du
    // texte enfant) : on relit la propriété `.value` du même champ.
    expect(moduleTitleInput.value).toBe("Module 1 renommé");
  });

  it("envoie une demande d'ajustement et remplace le plan affiché par la réponse du serveur", async () => {
    await reachPlanReview();

    await click(findButton("Demander un ajustement"));
    const textarea = Array.from(container.querySelectorAll("textarea")).find((t) =>
      t.placeholder.startsWith("Décris l'ajustement"),
    ) as HTMLTextAreaElement;
    await act(async () => {
      NATIVE_TEXTAREA_VALUE_SETTER.call(textarea, "Ajoute plus d'exercices pratiques");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const adjustedPlan = {
      ...FAKE_PLAN,
      programme: { ...FAKE_PLAN.programme, modules: [{ ...FAKE_PLAN.programme.modules[0], title: "Module ajusté" }] },
    };
    fetchHandler = async (url, body) => {
      expect(url).toBe("/api/courses/plan");
      expect((body as { action: string }).action).toBe("adjust");
      expect((body as { adjustmentRequest: string }).adjustmentRequest).toBe(
        "Ajoute plus d'exercices pratiques",
      );
      return { ok: true, status: 200, json: async () => adjustedPlan };
    };

    await click(findButton("Envoyer l'ajustement"));

    const moduleTitleInput = Array.from(container.querySelectorAll("input")).find(
      (input) => input.value === "Module ajusté",
    );
    expect(moduleTitleInput).not.toBeUndefined();
  });

  it("valide le plan et lance /api/courses/generate avec { topic, plan } — jamais de quota consommé avant cet instant", async () => {
    await reachPlanReview();

    fetchHandler = async (url, body) => {
      expect(url).toBe("/api/courses/generate");
      const parsed = body as { topic: string; plan: unknown };
      expect(parsed.topic).toBe("Un sujet de test");
      expect(parsed.plan).toEqual({
        analysis: FAKE_PLAN.analysis,
        verifiedExamples: FAKE_PLAN.verifiedExamples,
        programme: FAKE_PLAN.programme,
      });
      return {
        ok: true,
        status: 200,
        body: ndjsonStream([
          { reservationId: "res-1" },
          { stage: "done", courseId: "c1", course: FAKE_COURSE, saveWarning: null },
        ]),
        json: async () => ({}),
      };
    };

    await click(findButton("Valider et générer la formation"));

    expect(container.textContent).toContain("Formation test générée");
  });

  it("protège contre une double soumission (deux clics rapides sur 'Valider et générer' n'appellent /api/courses/generate qu'une seule fois)", async () => {
    await reachPlanReview();

    let callCount = 0;
    fetchHandler = async () => {
      callCount += 1;
      return {
        ok: true,
        status: 200,
        body: ndjsonStream([{ stage: "done", courseId: "c1", course: FAKE_COURSE, saveWarning: null }]),
        json: async () => ({}),
      };
    };

    const button = findButton("Valider et générer la formation");
    await act(async () => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(callCount).toBe(1);
  });
});

describe("CourseGenerator — rechargement pendant une génération (Prompt 05.18.1)", () => {
  it("affiche un avis clair et retrouve l'état réel (toujours en cours) plutôt que de redémarrer de zéro", async () => {
    sessionStorage.setItem(
      "tavyra:course-generation",
      JSON.stringify({ reservationId: "res-stored", topic: "Sujet repris", startedAt: Date.now() }),
    );
    mockGetGenerationStatus.mockResolvedValue({ status: "pending", resourceId: null, createdAt: null });

    await renderGenerator({ remainingGenerations: 1, locked: false });

    expect(container.textContent).toMatch(/vérification|toujours en cours/i);
    expect(mockGetGenerationStatus).toHaveBeenCalledWith("res-stored", "course");
  });

  it("redirige vers la formation terminée si le serveur confirme qu'elle est 'completed'", async () => {
    sessionStorage.setItem(
      "tavyra:course-generation",
      JSON.stringify({ reservationId: "res-stored", topic: "Sujet repris", startedAt: Date.now() }),
    );
    mockGetGenerationStatus.mockResolvedValue({
      status: "completed",
      resourceId: "course-xyz",
      createdAt: null,
    });

    await renderGenerator({ remainingGenerations: 1, locked: false });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockPush).toHaveBeenCalledWith("/dashboard/formations/course-xyz");
    expect(sessionStorage.getItem("tavyra:course-generation")).toBeNull();
  });

  it("affiche un message d'échec si le serveur confirme que la réservation a été libérée (génération ratée)", async () => {
    sessionStorage.setItem(
      "tavyra:course-generation",
      JSON.stringify({ reservationId: "res-stored", topic: "Sujet repris", startedAt: Date.now() }),
    );
    mockGetGenerationStatus.mockResolvedValue({ status: "released", resourceId: null, createdAt: null });

    await renderGenerator({ remainingGenerations: 1, locked: false });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.textContent).toMatch(/arrêtée|expiré/i);
    expect(sessionStorage.getItem("tavyra:course-generation")).toBeNull();
  });

  it("ne prétend JAMAIS qu'une génération continue si son état ne peut pas être confirmé (statut 'unknown')", async () => {
    sessionStorage.setItem(
      "tavyra:course-generation",
      JSON.stringify({ reservationId: "res-stored", topic: "Sujet repris", startedAt: Date.now() }),
    );
    mockGetGenerationStatus.mockResolvedValue({ status: "unknown", resourceId: null, createdAt: null });

    await renderGenerator({ remainingGenerations: 1, locked: false });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.textContent).not.toMatch(/toujours en cours(?!.*impossible)/i);
    expect(container.textContent).toMatch(/impossible de confirmer/i);
  });

  it("sans aucune génération en cours en sessionStorage, démarre normalement en 'idle' (non-régression)", async () => {
    await renderGenerator({ remainingGenerations: 1, locked: false });

    expect(mockGetGenerationStatus).not.toHaveBeenCalled();
    expect(findButton("Créer avec le diagnostic guidé")).not.toBeNull();
  });
});
