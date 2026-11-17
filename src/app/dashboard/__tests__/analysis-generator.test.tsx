// @vitest-environment jsdom
//
// Vrai test (Prompt 05.18, audit des parcours utilisateur) : importe et
// rend le VRAI composant AnalysisGenerator dans un DOM jsdom, et simule un
// vrai flux NDJSON tel qu'émis par /api/analysis/generate (route.ts) —
// seule la frontière externe (`fetch`) est mockée. Même constat que pour
// CourseGenerator : aucun test n'existait jusqu'ici pour la logique
// client (parsing du flux, quota Free/Pro, erreur).
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GeneratedDeepAnalysis } from "@/lib/analysis/schemas";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

const FAKE_ANALYSIS: GeneratedDeepAnalysis = {
  topic: "Sujet",
  title: "Analyse test générée",
  domain: "Test",
  introduction: "Intro",
  sections: [
    {
      position: 0,
      name: "Section 1",
      outcome: "succès",
      content: "Contenu 1",
      lessons: ["Leçon"],
      source: { index: 0, url: "https://example.com", title: "Source" },
    },
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

describe("AnalysisGenerator (vrai composant, Prompt 05.18)", () => {
  it("affiche le mur Pro pour un utilisateur Free (jamais de formulaire)", async () => {
    await renderGenerator({ remainingGenerations: 0, isPro: false });

    expect(container.textContent).toContain("Fonctionnalité réservée au plan Pro");
    expect(container.querySelector("textarea")).toBeNull();
    expect(container.querySelector('a[href="/pricing"]')).not.toBeNull();
  });

  it("affiche le quota atteint pour un utilisateur Pro qui a épuisé ses analyses du mois", async () => {
    await renderGenerator({ remainingGenerations: 0, isPro: true });

    expect(container.textContent).toContain("Limite mensuelle atteinte");
    expect(container.querySelector("textarea")).toBeNull();
  });

  it("affiche le formulaire pour un Pro avec du quota restant", async () => {
    await renderGenerator({ remainingGenerations: 1, isPro: true });

    expect(container.querySelector("textarea")).not.toBeNull();
    const button = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Lancer l'analyse",
    ) as HTMLButtonElement;
    expect(button.disabled).toBe(true); // topic vide.
  });

  it("parse le flux NDJSON réel et affiche l'analyse quand le serveur renvoie 'done'", async () => {
    mockFetchStream([
      { stage: "cadrage" },
      { stage: "done", analysisId: "analysis-123", analysis: FAKE_ANALYSIS, saveWarning: null },
    ]);

    await renderGenerator({ remainingGenerations: 1, isPro: true });
    await typeSubjectAndSubmit("Un sujet de test");

    expect(container.textContent).toContain("Analyse test générée");
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("affiche le message d'erreur du serveur quand le flux contient un stage 'error' (scénario : erreur pendant une génération)", async () => {
    mockFetchStream([
      { stage: "cadrage" },
      { stage: "error", message: "Le sujet proposé ne permet pas d'identifier de cas réels pertinents." },
    ]);

    await renderGenerator({ remainingGenerations: 1, isPro: true });
    await typeSubjectAndSubmit("Un sujet de test");

    expect(container.textContent).toContain(
      "Le sujet proposé ne permet pas d'identifier de cas réels pertinents.",
    );
    expect(container.querySelector("textarea")).not.toBeNull();
  });
});
