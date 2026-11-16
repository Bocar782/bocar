// Vrais tests (Prompt 05.11) : importent et exécutent le VRAI
// src/lib/courses/persist.ts — seul le client Supabase (frontière externe)
// est mocké. Couvre la sauvegarde ET le rechargement de l'exercice
// facultatif, ainsi que la compatibilité avec une leçon sans exercice
// (formation ancienne ou sujet qui ne s'y prête pas).
import { describe, expect, it, vi } from "vitest";
import { getCourseById, saveCourse } from "@/lib/courses/persist";
import type { GeneratedCourse } from "@/lib/courses/schemas";

// ---------------------------------------------------------------------
// saveCourse
// ---------------------------------------------------------------------

function makeCourseWithExercise(): GeneratedCourse {
  return {
    topic: "Sujet",
    title: "Formation test",
    domain: "Test",
    level: "débutant",
    introduction: "Intro",
    objectives: ["Obj"],
    chapters: [],
    summary: "Résumé",
    keyPoints: ["Point"],
    quiz: [],
    modules: [
      {
        position: 0,
        title: "Module 1",
        quiz: [],
        chapters: [
          {
            position: 0,
            title: "Leçon avec exercice",
            explanation: "Explication suffisamment longue pour ce test.",
            keyTakeaway: "À retenir.",
            example: { isReal: false, description: "Exemple.", sourceUrl: null, sourceTitle: null },
            exercise: { prompt: "Fais ceci.", solution: "Voici comment." },
          },
          {
            position: 1,
            title: "Leçon sans exercice",
            explanation: "Autre explication suffisamment longue.",
            keyTakeaway: "À retenir aussi.",
            example: { isReal: false, description: "Autre exemple.", sourceUrl: null, sourceTitle: null },
            exercise: null,
          },
        ],
      },
    ],
  };
}

describe("saveCourse (vrai code) — transmission de l'exercice facultatif", () => {
  it("transmet l'exercice au RPC pour la leçon qui en a un, et null pour celle qui n'en a pas", async () => {
    let capturedPayload: { modules: { chapters: { exercise: unknown }[] }[] } | undefined;
    const supabase = {
      rpc: vi.fn(async (_fn: string, args: { p_course: typeof capturedPayload }) => {
        capturedPayload = args.p_course;
        return { data: "course-id", error: null };
      }),
    };

    const courseId = await saveCourse(supabase as never, makeCourseWithExercise(), "res-1");

    expect(courseId).toBe("course-id");
    expect(capturedPayload?.modules[0].chapters[0].exercise).toEqual({
      prompt: "Fais ceci.",
      solution: "Voici comment.",
    });
    expect(capturedPayload?.modules[0].chapters[1].exercise).toBeNull();
  });
});

// ---------------------------------------------------------------------
// getCourseById
// ---------------------------------------------------------------------

/** Constructeur minimal d'un faux query builder Supabase : chaînable
 * (select/eq/order/in renvoient le même objet) et "thenable" (awaitable
 * directement, comme le vrai builder quand aucun .single()/.maybeSingle()
 * n'est appelé). */
function fakeTable(rows: unknown[]) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = chain;
  builder.eq = chain;
  builder.order = chain;
  builder.in = chain;
  builder.maybeSingle = async () => ({ data: (rows[0] as unknown) ?? null, error: null });
  builder.then = (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
    Promise.resolve({ data: rows, error: null }).then(resolve);
  return builder;
}

function makeSupabaseForGetCourseById() {
  const tables: Record<string, unknown[]> = {
    courses: [
      {
        topic: "Sujet",
        title: "Formation test",
        domain: "Test",
        level: "débutant",
        introduction: "Intro",
        objectives: ["Obj"],
        summary: "Résumé",
        key_points: ["Point"],
      },
    ],
    course_chapters: [
      {
        id: "chap-1",
        position: 0,
        title: "Leçon avec exercice",
        explanation: "Explication.",
        key_takeaway: "À retenir.",
        exercise_prompt: "Fais ceci.",
        exercise_solution: "Voici comment.",
        module_id: "mod-1",
        position_in_module: 0,
        course_examples: { description: "Ex.", is_real: false, source_url: null, source_title: null },
      },
      {
        // Leçon d'une formation ANCIENNE (générée avant le Prompt 05.11) :
        // exercise_prompt/exercise_solution n'existent pas encore pour
        // elle, donc absentes du payload — pas seulement `null` explicite,
        // exactement ce qu'une vraie ligne pré-migration renverrait.
        id: "chap-2",
        position: 1,
        title: "Leçon ancienne, sans exercice",
        explanation: "Explication ancienne.",
        key_takeaway: "À retenir ancien.",
        module_id: "mod-1",
        position_in_module: 1,
        course_examples: { description: "Ex2.", is_real: false, source_url: null, source_title: null },
      },
    ],
    course_modules: [{ id: "mod-1", position: 0, title: "Module 1" }],
    quizzes: [],
    course_quiz_questions: [],
    lesson_progress: [],
  };

  return {
    from: vi.fn((table: string) => fakeTable(tables[table] ?? [])),
  };
}

describe("getCourseById (vrai code) — rechargement de l'exercice facultatif", () => {
  it("recharge l'exercice pour la leçon qui en a un, et null pour une leçon ancienne sans ces colonnes", async () => {
    const supabase = makeSupabaseForGetCourseById();

    const course = await getCourseById(supabase as never, "course-1");

    expect(course).not.toBeNull();
    const chapters = course!.chapters;
    expect(chapters).toHaveLength(2);

    const withExercise = chapters.find((c) => c.id === "chap-1");
    expect(withExercise?.exercise).toEqual({ prompt: "Fais ceci.", solution: "Voici comment." });

    const withoutExercise = chapters.find((c) => c.id === "chap-2");
    expect(withoutExercise?.exercise).toBeNull();
  });

  it("fonctionne avec plusieurs modules (regroupement correct des leçons par module)", async () => {
    const supabase = makeSupabaseForGetCourseById();
    // Ajoute un second module avec sa propre leçon, pour vérifier que le
    // regroupement par module_id reste correct avec >1 module.
    (supabase.from as unknown as { mockImplementation: (fn: (table: string) => unknown) => void }).mockImplementation(
      (table: string) => {
        const extra: Record<string, unknown[]> = {
          course_chapters: [
            {
              id: "chap-1",
              position: 0,
              title: "Leçon module A",
              explanation: "Explication.",
              key_takeaway: "À retenir.",
              exercise_prompt: null,
              exercise_solution: null,
              module_id: "mod-a",
              position_in_module: 0,
              course_examples: { description: "Ex.", is_real: false, source_url: null, source_title: null },
            },
            {
              id: "chap-2",
              position: 1,
              title: "Leçon module B",
              explanation: "Explication 2.",
              key_takeaway: "À retenir 2.",
              exercise_prompt: "Consigne B",
              exercise_solution: "Correction B",
              module_id: "mod-b",
              position_in_module: 0,
              course_examples: { description: "Ex2.", is_real: false, source_url: null, source_title: null },
            },
          ],
          course_modules: [
            { id: "mod-a", position: 0, title: "Module A" },
            { id: "mod-b", position: 1, title: "Module B" },
          ],
          courses: [
            {
              topic: "Sujet",
              title: "Formation multi-modules",
              domain: "Test",
              level: "débutant",
              introduction: "Intro",
              objectives: ["Obj"],
              summary: "Résumé",
              key_points: ["Point"],
            },
          ],
          quizzes: [],
          course_quiz_questions: [],
          lesson_progress: [],
        };
        return fakeTable(extra[table] ?? []);
      },
    );

    const course = await getCourseById(supabase as never, "course-2");

    expect(course?.modules).toHaveLength(2);
    expect(course?.modules?.[0].chapters[0].title).toBe("Leçon module A");
    expect(course?.modules?.[0].chapters[0].exercise).toBeNull();
    expect(course?.modules?.[1].chapters[0].title).toBe("Leçon module B");
    expect(course?.modules?.[1].chapters[0].exercise).toEqual({
      prompt: "Consigne B",
      solution: "Correction B",
    });
  });
});
