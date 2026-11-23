// Vrai test : importe et exécute le VRAI src/app/dashboard/assistant/page.tsx.
// Frontières mockées : le client Supabase (auth) et les fonctions de lecture
// de src/lib/courses/persist.ts / plan.ts — déjà testées séparément
// (persist.test.ts, plan.test.ts, access.test.ts) ; ce test porte sur la
// composition de la page elle-même (quel composant se rend selon la
// sélection, quels chapitres sont marqués verrouillés).
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { GeneratedCourse } from "@/lib/courses/schemas";

const USER = { id: "user-1", email: "demo@tavyra.app" };

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: USER } }) },
  }),
}));

vi.mock("@/lib/courses/plan", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/courses/plan")>();
  return { ...actual, isOnFreePlan: async () => true };
});

// DashboardShell (via SidebarNav) appelle usePathname(), qui n'a pas de
// contexte App Router disponible lors d'un rendu SSR isolé comme celui-ci —
// seul ce hook est mocké, le reste de "next/navigation" (dont `redirect`,
// utilisé par la page elle-même) reste réel.
vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();
  return {
    ...actual,
    usePathname: () => "/dashboard/assistant",
    useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
  };
});

function makeChapter(position: number, title: string) {
  return {
    position,
    title,
    explanation: "Explication suffisamment longue pour ce test.",
    keyTakeaway: "À retenir.",
    example: { isReal: false, description: "Exemple.", sourceUrl: null, sourceTitle: null },
    exercise: null,
  };
}

function makeCourse(): GeneratedCourse {
  return {
    topic: "Sujet",
    title: "Comprendre les ETF",
    domain: "Finance",
    level: "débutant",
    introduction: "Intro",
    objectives: ["Obj"],
    summary: "Résumé",
    keyPoints: ["Point"],
    quiz: [],
    chapters: [
      makeChapter(0, "Chapitre 1"),
      makeChapter(1, "Chapitre 2"),
      makeChapter(2, "Chapitre 3"),
    ],
  };
}

const COURSE_LIST_ITEM = {
  id: "course-1",
  title: "Comprendre les ETF",
  domain: "Finance",
  level: "débutant",
  createdAt: new Date().toISOString(),
  chapterCount: 3,
  currentChapterIndex: 1,
  quizScore: null,
  quizTotal: null,
};

describe("AssistantPage (vrai code)", () => {
  it("affiche la liste des formations et une invite à en choisir une, sans formation sélectionnée", async () => {
    vi.resetModules();
    vi.doMock("@/lib/courses/persist", () => ({
      listCourses: async () => [COURSE_LIST_ITEM],
      getCourseById: async () => null,
    }));
    const { default: AssistantPage } = await import("@/app/dashboard/assistant/page");

    const element = await AssistantPage({
      params: Promise.resolve({}),
      searchParams: Promise.resolve({}),
    } as never);
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Comprendre les ETF");
    expect(html).toContain("Choisis une formation");
  });

  it("affiche le panneau d'assistant avec le chapitre en cours pré-sélectionné, formation choisie (plan gratuit = chapitre 2 verrouillé)", async () => {
    vi.resetModules();
    vi.doMock("@/lib/courses/persist", () => ({
      listCourses: async () => [COURSE_LIST_ITEM],
      getCourseById: async () => makeCourse(),
    }));
    const { default: AssistantPage } = await import("@/app/dashboard/assistant/page");

    const element = await AssistantPage({
      params: Promise.resolve({}),
      searchParams: Promise.resolve({ course: "course-1" }),
    } as never);
    const html = renderToStaticMarkup(element);

    // Plan gratuit : FREE_PLAN_UNLOCKED_CHAPTERS = 2, donc le chapitre 3
    // (position 2) doit apparaître marqué verrouillé dans le sélecteur.
    expect(html).toContain("Chapitre 3");
    expect(html).toContain("verrouillé");
    expect(html).toContain("Comprendre les ETF");
  });
});
