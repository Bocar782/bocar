// @vitest-environment jsdom
//
// Vrai test (Prompt 06.8) : importe et rend le VRAI composant CourseView
// dans un DOM jsdom, et vérifie le libellé du bouton "Continuer cette
// formation" (ajouté sous l'image de garde) selon l'état réel de
// progression — jamais une position fixe, toujours dérivé des leçons
// effectivement marquées terminées. Vérifie aussi que l'image de garde
// (CourseCover) est bien présente.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CourseView } from "@/components/course-view";
import type { GeneratedCourse } from "@/lib/courses/schemas";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = IntersectionObserverStub;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

function makeChapter(position: number, completed: boolean) {
  return {
    id: `chap-${position}`,
    position,
    title: `Chapitre ${position + 1}`,
    explanation: "Explication suffisamment longue pour ce test.",
    keyTakeaway: "À retenir.",
    example: { isReal: false, description: "Exemple.", sourceUrl: null, sourceTitle: null },
    exercise: null,
    completed,
  };
}

function makeCourse(completedFlags: boolean[]): GeneratedCourse {
  return {
    topic: "Sujet",
    title: "Comprendre les ETF",
    domain: "Finance",
    level: "débutant",
    introduction: "Intro",
    objectives: ["Objectif"],
    summary: "Résumé",
    keyPoints: ["Point"],
    quiz: [],
    chapters: completedFlags.map((c, i) => makeChapter(i, c)),
  };
}

function render(course: GeneratedCourse) {
  act(() => {
    root.render(<CourseView course={course} courseId="course-1" locked={false} />);
  });
}

describe("CourseView — image de garde et bouton de reprise (Prompt 06.8)", () => {
  it("affiche une image de garde (CourseCover) en haut de la formation", () => {
    render(makeCourse([false, false, false]));
    // CourseCover rend un dégradé de fond sur un conteneur de grande
    // hauteur, sans texte propre — on vérifie sa présence via la classe
    // qui le distingue des autres blocs (rounded-[28px] + h-48, uniques à
    // ce composant sur cette page).
    expect(container.querySelector(".h-48")).not.toBeNull();
  });

  it("propose « Commencer cette formation » quand rien n'est terminé", () => {
    render(makeCourse([false, false, false]));
    expect(container.textContent).toContain("Commencer cette formation");
  });

  it("propose « Continuer cette formation » quand certaines leçons sont terminées mais pas toutes", () => {
    render(makeCourse([true, false, false]));
    expect(container.textContent).toContain("Continuer cette formation");
    expect(container.textContent).not.toContain("Commencer cette formation");
  });

  it("propose « Revoir le résumé » quand toutes les leçons sont terminées", () => {
    render(makeCourse([true, true, true]));
    expect(container.textContent).toContain("Revoir le résumé");
    expect(container.textContent).not.toContain("Continuer cette formation");
  });
});
