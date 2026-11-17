// Vrais tests (Prompt 05.17.2, correction E1 de l'audit 05.17) : importent
// et exécutent le VRAI src/lib/courses/access.ts.
import { describe, expect, it } from "vitest";
import { computeCourseAccess, redactLockedCourseContent } from "@/lib/courses/access";
import type { GeneratedChapter, GeneratedCourse, QuizQuestion } from "@/lib/courses/schemas";

function chapter(position: number, overrides: Partial<GeneratedChapter> = {}): GeneratedChapter {
  return {
    id: `chapter-${position}`,
    position,
    title: `Chapitre ${position + 1}`,
    explanation: `Explication réelle du chapitre ${position + 1}`,
    keyTakeaway: `À retenir ${position + 1}`,
    example: {
      isReal: false,
      description: `Exemple réel du chapitre ${position + 1}`,
      sourceUrl: null,
      sourceTitle: null,
    },
    exercise: { prompt: "Exercice", solution: "Solution" },
    completed: false,
    ...overrides,
  };
}

function question(id: string, correctChoiceIndex = 0): QuizQuestion {
  return {
    id,
    position: 0,
    chapterIndex: null,
    question: `Question ${id}`,
    choices: ["A", "B"],
    correctChoiceIndex,
    questionType: "single_choice",
    explanation: `Explication de la bonne réponse ${id}`,
  };
}

// Formation à 4 chapitres répartis sur 2 modules (2 chapitres chacun), avec
// un quiz par module et un quiz final — scénario représentatif utilisé par
// plusieurs tests ci-dessous.
function makeCourse(): GeneratedCourse {
  const chapters = [chapter(0), chapter(1), chapter(2), chapter(3)];
  return {
    topic: "Sujet",
    title: "Formation test",
    domain: "Test",
    level: "débutant",
    introduction: "Intro",
    objectives: ["Objectif 1"],
    chapters,
    modules: [
      { position: 0, title: "Module 1", chapters: [chapters[0], chapters[1]], quizId: "quiz-m1", quiz: [question("m1-q1")] },
      { position: 1, title: "Module 2", chapters: [chapters[2], chapters[3]], quizId: "quiz-m2", quiz: [question("m2-q1")] },
    ],
    summary: "Résumé complet de la formation",
    keyPoints: ["Point clé 1", "Point clé 2"],
    quiz: [question("final-q1")],
    quizId: "quiz-final",
  };
}

describe("computeCourseAccess", () => {
  it("plan Pro : rien n'est verrouillé", () => {
    const access = computeCourseAccess(makeCourse(), false);
    expect(access.unlockedCount).toBe(4);
    expect(access.lockedChapterPositions.size).toBe(0);
    expect(access.lockedModulePositions.size).toBe(0);
    expect(access.finalLocked).toBe(false);
  });

  it("plan Free : seuls les FREE_PLAN_UNLOCKED_CHAPTERS (2) premiers chapitres sont débloqués", () => {
    const access = computeCourseAccess(makeCourse(), true);
    expect(access.unlockedCount).toBe(2);
    expect(access.lockedChapterPositions).toEqual(new Set([2, 3]));
  });

  it("plan Free : le quiz du module entièrement avant la frontière reste débloqué", () => {
    const access = computeCourseAccess(makeCourse(), true);
    // Module 1 (chapitres 0 et 1) est entièrement dans la zone gratuite.
    expect(access.lockedModulePositions.has(0)).toBe(false);
    // Module 2 (chapitres 2 et 3) est entièrement verrouillé.
    expect(access.lockedModulePositions.has(1)).toBe(true);
  });

  it("plan Free : un module à cheval sur la frontière est entièrement verrouillé (y compris son quiz)", () => {
    const chapters = [chapter(0), chapter(1), chapter(2)];
    const course: GeneratedCourse = {
      ...makeCourse(),
      chapters,
      modules: [
        { position: 0, title: "Module 1", chapters, quizId: "quiz-m1", quiz: [question("m1-q1")] },
      ],
      quiz: [],
    };
    const access = computeCourseAccess(course, true);
    // Chapitre 2 (position >= 2) verrouille tout le reste du module, y
    // compris le quiz de CE module, même si ses chapitres 0 et 1 étaient
    // débloqués.
    expect(access.lockedChapterPositions).toEqual(new Set([2]));
    expect(access.lockedModulePositions.has(0)).toBe(true);
  });

  it("plan Free : le quiz final est TOUJOURS verrouillé dès qu'il existe, même pour une formation entièrement dans la zone gratuite", () => {
    const chapters = [chapter(0), chapter(1)]; // exactement FREE_PLAN_UNLOCKED_CHAPTERS : aucun chapitre verrouillé.
    const course: GeneratedCourse = {
      ...makeCourse(),
      chapters,
      modules: [{ position: 0, title: "Module 1", chapters, quiz: [] }],
      quiz: [question("final-q1")],
    };
    const access = computeCourseAccess(course, true);
    expect(access.lockedChapterPositions.size).toBe(0);
    expect(access.finalLocked).toBe(true);
  });

  it("plan Free : sans aucun quiz final et aucun chapitre verrouillé, rien n'est verrouillé", () => {
    const chapters = [chapter(0), chapter(1)];
    const course: GeneratedCourse = {
      ...makeCourse(),
      chapters,
      modules: [{ position: 0, title: "Module 1", chapters, quiz: [] }],
      quiz: [],
    };
    const access = computeCourseAccess(course, true);
    expect(access.finalLocked).toBe(false);
  });
});

describe("redactLockedCourseContent", () => {
  it("plan Pro : la formation est retournée strictement inchangée (même référence)", () => {
    const course = makeCourse();
    const result = redactLockedCourseContent(course, false);
    expect(result).toBe(course);
  });

  it("plan Free : conserve id/position/title/completed des chapitres verrouillés, mais vide tout le contenu pédagogique", () => {
    const course = makeCourse();
    const result = redactLockedCourseContent(course, true);

    const lockedChapter = result.chapters.find((c) => c.position === 2)!;
    expect(lockedChapter.id).toBe("chapter-2");
    expect(lockedChapter.title).toBe("Chapitre 3");
    expect(lockedChapter.completed).toBe(false);
    expect(lockedChapter.explanation).toBe("");
    expect(lockedChapter.keyTakeaway).toBe("");
    expect(lockedChapter.example).toEqual({
      isReal: false,
      description: "",
      sourceUrl: null,
      sourceTitle: null,
    });
    expect(lockedChapter.exercise).toBeNull();
  });

  it("plan Free : conserve intégralement le contenu des chapitres débloqués", () => {
    const course = makeCourse();
    const result = redactLockedCourseContent(course, true);

    const unlockedChapter = result.chapters.find((c) => c.position === 0)!;
    expect(unlockedChapter.explanation).toBe("Explication réelle du chapitre 1");
    expect(unlockedChapter.example.description).toBe("Exemple réel du chapitre 1");
    expect(unlockedChapter.exercise).toEqual({ prompt: "Exercice", solution: "Solution" });
  });

  it("plan Free : vide le tableau de questions d'un quiz de module verrouillé (plus aucune réponse exposée)", () => {
    const course = makeCourse();
    const result = redactLockedCourseContent(course, true);

    const module1 = result.modules!.find((m) => m.position === 0)!;
    const module2 = result.modules!.find((m) => m.position === 1)!;
    expect(module1.quiz).toEqual([question("m1-q1")]); // débloqué : inchangé.
    expect(module2.quiz).toEqual([]); // verrouillé : vidé entièrement.
  });

  it("plan Free : vide le quiz final, le résumé et les points clés quand ils sont verrouillés", () => {
    const course = makeCourse();
    const result = redactLockedCourseContent(course, true);

    expect(result.quiz).toEqual([]);
    expect(result.summary).toBe("");
    expect(result.keyPoints).toEqual([]);
  });

  it("plan Free : les chapitres redactés le sont aussi dans la vue groupée par module (mêmes objets)", () => {
    const course = makeCourse();
    const result = redactLockedCourseContent(course, true);

    const module2 = result.modules!.find((m) => m.position === 1)!;
    expect(module2.chapters.every((c) => c.explanation === "")).toBe(true);
  });
});
