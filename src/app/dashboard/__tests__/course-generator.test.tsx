// @vitest-environment jsdom
//
// Vrai test (Prompt 05.18, audit des parcours utilisateur) : importe et
// rend le VRAI composant CourseGenerator dans un DOM jsdom, et simule un
// vrai flux NDJSON tel qu'émis par /api/courses/generate (route.ts) — seule
// la frontière externe (`fetch`) est mockée. Ce composant n'avait jusqu'ici
// aucun test : c'est pourtant lui qui analyse le flux streamé et décide de
// l'affichage (progression, erreur, formation prête, quota atteint), un
// point jamais couvert par les tests de route.ts (qui ne vérifient que ce
// que le SERVEUR envoie, jamais comment le CLIENT le consomme).
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GeneratedCourse } from "@/lib/courses/schemas";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom ne fournit pas IntersectionObserver : CourseView -> CourseSidebar
// -> useCurrentChapterIndex (scrollspy) en a besoin pour monter sans
// planter. Stub minimal, local à ce fichier.
class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mockRefresh.mockClear();
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

function mockFetchStream(lines: Record<string, unknown>[], ok = true, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok,
      status,
      body: ndjsonStream(lines),
      json: async () => (lines[0] as { error?: string }) ?? {},
    })),
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

async function renderGenerator(props: { remainingGenerations: number; locked: boolean }) {
  const { CourseGenerator } = await import("@/app/dashboard/course-generator");
  await act(async () => {
    root.render(<CourseGenerator {...props} />);
  });
}

// Un simple `textarea.value = x` ne met pas à jour la valeur telle que React
// la suit en interne (son "value tracker" intercepte le setter natif) :
// sans ce contournement standard, l'événement "input" dispatché ensuite ne
// déclenche jamais le vrai `onChange` du composant.
const NATIVE_TEXTAREA_VALUE_SETTER = Object.getOwnPropertyDescriptor(
  window.HTMLTextAreaElement.prototype,
  "value",
)!.set!;

async function typeSubjectAndSubmit(topic: string) {
  const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
  const form = container.querySelector("form") as HTMLFormElement;
  await act(async () => {
    NATIVE_TEXTAREA_VALUE_SETTER.call(textarea, topic);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    // Laisse le temps à la lecture asynchrone du flux de s'exécuter.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("CourseGenerator (vrai composant, Prompt 05.18)", () => {
  it("affiche le message de quota atteint pour un utilisateur Free, avec un lien vers /pricing", async () => {
    await renderGenerator({ remainingGenerations: 0, locked: true });

    expect(container.textContent).toContain("Limite du plan gratuit atteinte");
    const link = container.querySelector('a[href="/pricing"]');
    expect(link).not.toBeNull();
  });

  it("affiche le message de quota atteint pour un utilisateur Pro (texte différent, pas de lien pricing)", async () => {
    await renderGenerator({ remainingGenerations: 0, locked: false });

    expect(container.textContent).toContain("Limite mensuelle atteinte");
    expect(container.querySelector('a[href="/pricing"]')).toBeNull();
  });

  it("n'affiche pas le formulaire tant qu'aucun texte n'a été saisi (bouton désactivé)", async () => {
    await renderGenerator({ remainingGenerations: 1, locked: true });

    const button = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Générer ma formation",
    ) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("parse le flux NDJSON réel et affiche la formation quand le serveur renvoie 'done'", async () => {
    mockFetchStream([
      { stage: "analyse" },
      { stage: "chapitres" },
      { stage: "done", courseId: "course-123", course: FAKE_COURSE, saveWarning: null },
    ]);

    await renderGenerator({ remainingGenerations: 1, locked: false });
    await typeSubjectAndSubmit("Un sujet de test");

    expect(container.textContent).toContain("Formation test générée");
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("affiche l'avertissement de sauvegarde échouée transmis par le serveur, sans l'inventer", async () => {
    mockFetchStream([
      {
        stage: "done",
        courseId: null,
        course: FAKE_COURSE,
        saveWarning: "message d'avertissement du serveur",
      },
    ]);

    await renderGenerator({ remainingGenerations: 1, locked: false });
    await typeSubjectAndSubmit("Un sujet de test");

    expect(container.textContent).toContain("message d'avertissement du serveur");
  });

  it("affiche le message d'erreur du serveur quand le flux contient un stage 'error' (scénario : erreur pendant une génération)", async () => {
    mockFetchStream([
      { stage: "analyse" },
      { stage: "error", message: "Le sujet proposé ne permet pas de générer une formation." },
    ]);

    await renderGenerator({ remainingGenerations: 1, locked: false });
    await typeSubjectAndSubmit("Un sujet de test");

    expect(container.textContent).toContain(
      "Le sujet proposé ne permet pas de générer une formation.",
    );
    // Revient au formulaire (pas bloqué sur l'écran de progression).
    expect(container.querySelector("textarea")).not.toBeNull();
  });

  it("affiche une erreur générique si la requête échoue avant même de streamer (ex. 403/503)", async () => {
    mockFetchStream([{ error: "Impossible de vérifier ton quota pour le moment." }], false, 503);

    await renderGenerator({ remainingGenerations: 1, locked: false });
    await typeSubjectAndSubmit("Un sujet de test");

    expect(container.textContent).toContain("Impossible de vérifier ton quota pour le moment.");
  });
});
