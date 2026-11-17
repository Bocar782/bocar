// Vrais tests automatisés (Prompt 05.20.1, architecture à étapes courtes) :
// importent et exécutent le VRAI code de generate.ts. Le client Anthropic
// est un simple objet mocké construit directement (ces fonctions le
// reçoivent en paramètre explicite, jamais via createAnthropicClient) —
// aucun appel réel à l'API Anthropic.
import { describe, expect, it, vi } from "vitest";
import {
  assembleCourseFromProgress,
  CourseGenerationError,
  decideNextCourseStep,
  EMPTY_COURSE_PROGRESS,
  performCourseStepUnit,
  stageForCourseUnit,
  type CourseStepInput,
  type CourseStepProgress,
} from "@/lib/courses/generate";
import type { Analysis, Programme, ProgrammeModule } from "@/lib/courses/schemas";

function makeModule(title: string, objective: string, chapterCount: number): ProgrammeModule {
  return {
    title,
    objective,
    chapters: Array.from({ length: chapterCount }, (_, i) => ({
      title: `Leçon ${i + 1} de ${title}`,
      summary: `Résumé ${i + 1}`,
      exampleIndex: null,
    })),
  };
}

function makeProgramme(modules: ProgrammeModule[]): Programme {
  return { introduction: "Introduction", objectives: ["Objectif global"], summaryAngle: "Angle", modules };
}

const ANALYSIS: Analysis = {
  title: "Formation test",
  domain: "Test",
  level: "débutant",
  angle: "pratique",
  moduleCount: 2,
  usesRealWorldExamples: false,
};

// 2 modules × 3 leçons = 6 leçons au total.
const PROGRAMME = makeProgramme([
  makeModule("Module 1", "Objectif 1", 3),
  makeModule("Module 2", "Objectif 2", 3),
]);

const INPUT: CourseStepInput = {
  topic: "Sujet de test",
  analysis: ANALYSIS,
  verifiedExamples: [],
  programme: PROGRAMME,
};

function fakeChapterResponse(title: string) {
  return {
    stop_reason: "end_turn",
    parsed_output: {
      explanation: `Explication suffisamment longue pour ${title} afin de passer la validation légère du contenu généré.`,
      keyTakeaway: `À retenir pour ${title}`,
      example: { isReal: false, description: `Exemple pour ${title}`, sourceUrl: null, sourceTitle: null },
      exercise: null,
    },
  };
}

function makeClientDispatch(handler: (systemPrompt: string) => unknown) {
  return { messages: { parse: vi.fn(async (args: { system: string }) => handler(args.system)), create: vi.fn() } };
}

describe("decideNextCourseStep (vraie fonction) — ordre des étapes", () => {
  it("demande d'abord chaque chapitre manquant, dans l'ordre global", () => {
    const unit = decideNextCourseStep(INPUT, EMPTY_COURSE_PROGRESS);
    expect(unit).toEqual({ kind: "chapter", globalIndex: 0 });
  });

  it("passe au résumé une fois tous les chapitres présents", () => {
    const progress: CourseStepProgress = {
      ...EMPTY_COURSE_PROGRESS,
      chapters: Object.fromEntries(
        Array.from({ length: 6 }, (_, i) => [String(i), { position: i, title: "x", explanation: "x", keyTakeaway: "x", example: { isReal: false, description: "x", sourceUrl: null, sourceTitle: null } }]),
      ),
    };
    expect(decideNextCourseStep(INPUT, progress)).toEqual({ kind: "summary" });
  });

  it("passe aux quiz de module un par un après le résumé", () => {
    const allChapters = Object.fromEntries(
      Array.from({ length: 6 }, (_, i) => [String(i), { position: i, title: "x", explanation: "x", keyTakeaway: "x", example: { isReal: false, description: "x", sourceUrl: null, sourceTitle: null } }]),
    );
    const progress: CourseStepProgress = {
      ...EMPTY_COURSE_PROGRESS,
      chapters: allChapters,
      summary: { summary: "Résumé", keyPoints: ["Point"] },
    };
    expect(decideNextCourseStep(INPUT, progress)).toEqual({ kind: "moduleQuiz", moduleIndex: 0 });

    const progress2 = { ...progress, moduleQuizzes: { "0": [] } };
    expect(decideNextCourseStep(INPUT, progress2)).toEqual({ kind: "moduleQuiz", moduleIndex: 1 });
  });

  it("passe au quiz final puis à l'assemblage une fois tout le reste prêt", () => {
    const allChapters = Object.fromEntries(
      Array.from({ length: 6 }, (_, i) => [String(i), { position: i, title: "x", explanation: "x", keyTakeaway: "x", example: { isReal: false, description: "x", sourceUrl: null, sourceTitle: null } }]),
    );
    const progress: CourseStepProgress = {
      ...EMPTY_COURSE_PROGRESS,
      chapters: allChapters,
      summary: { summary: "Résumé", keyPoints: ["Point"] },
      moduleQuizzes: { "0": [], "1": [] },
    };
    expect(decideNextCourseStep(INPUT, progress)).toEqual({ kind: "finalQuiz" });

    const progress2 = { ...progress, finalQuiz: [] };
    expect(decideNextCourseStep(INPUT, progress2)).toEqual({ kind: "assemble" });
  });
});

describe("stageForCourseUnit (vraie fonction)", () => {
  it("associe chaque unité à l'étape d'affichage attendue", () => {
    expect(stageForCourseUnit({ kind: "chapter", globalIndex: 0 })).toBe("chapitres");
    expect(stageForCourseUnit({ kind: "summary" })).toBe("finition");
    expect(stageForCourseUnit({ kind: "moduleQuiz", moduleIndex: 0 })).toBe("finition");
    expect(stageForCourseUnit({ kind: "finalQuiz" })).toBe("quizFinal");
    expect(stageForCourseUnit({ kind: "assemble" })).toBe("assemblage");
  });
});

describe("performCourseStepUnit (vraie fonction) — une seule unité de travail à la fois", () => {
  it("rédige UNE SEULE leçon par appel et renvoie un patch contenant uniquement cette leçon en plus", async () => {
    const client = makeClientDispatch((system) => {
      if (system.includes("rédiges une leçon complète")) return fakeChapterResponse("Leçon 1");
      throw new Error(`prompt inattendu : ${system.slice(0, 40)}`);
    });

    const patch = await performCourseStepUnit(client as never, INPUT, EMPTY_COURSE_PROGRESS, {
      kind: "chapter",
      globalIndex: 0,
    });

    expect(client.messages.parse).toHaveBeenCalledTimes(1);
    expect(Object.keys(patch.chapters ?? {})).toEqual(["0"]);
    expect(patch.chapters?.["0"].position).toBe(0);
  });

  it("rejette un contenu de leçon invalide (CourseGenerationError), sans committer de patch", async () => {
    const client = makeClientDispatch(() => ({
      stop_reason: "end_turn",
      parsed_output: { explanation: "", keyTakeaway: "", example: { isReal: false, description: "", sourceUrl: null, sourceTitle: null }, exercise: null },
    }));

    await expect(
      performCourseStepUnit(client as never, INPUT, EMPTY_COURSE_PROGRESS, { kind: "chapter", globalIndex: 0 }),
    ).rejects.toThrow(CourseGenerationError);
  });

  it("génère le résumé à partir des chapitres déjà présents dans la progression, jamais au-delà", async () => {
    const allChapters = Object.fromEntries(
      Array.from({ length: 6 }, (_, i) => [String(i), { position: i, title: `Leçon ${i}`, explanation: "x", keyTakeaway: `Retenir ${i}`, example: { isReal: false, description: "x", sourceUrl: null, sourceTitle: null } }]),
    );
    const progress: CourseStepProgress = { ...EMPTY_COURSE_PROGRESS, chapters: allChapters };

    const client = makeClientDispatch((system) => {
      if (system.includes("résumé final")) {
        return { stop_reason: "end_turn", parsed_output: { summary: "Résumé complet", keyPoints: ["Point 1"] } };
      }
      throw new Error(`prompt inattendu : ${system.slice(0, 40)}`);
    });

    const patch = await performCourseStepUnit(client as never, INPUT, progress, { kind: "summary" });

    expect(patch.summary).toEqual({ summary: "Résumé complet", keyPoints: ["Point 1"] });
  });

  it("génère le quiz d'un module à partir SEULEMENT des chapitres de ce module", async () => {
    const allChapters = Object.fromEntries(
      Array.from({ length: 6 }, (_, i) => [String(i), { position: i, title: `Leçon ${i}`, explanation: "x", keyTakeaway: "x", example: { isReal: false, description: "x", sourceUrl: null, sourceTitle: null } }]),
    );
    const progress: CourseStepProgress = {
      ...EMPTY_COURSE_PROGRESS,
      chapters: allChapters,
      summary: { summary: "Résumé", keyPoints: [] },
    };

    let receivedUser = "";
    const client = {
      messages: {
        parse: vi.fn(async (args: { system: string; messages: { content: string }[] }) => {
          if (args.system.includes("validation des acquis pour UN SEUL module")) {
            receivedUser = args.messages[0]?.content ?? "";
            return { stop_reason: "end_turn", parsed_output: { questions: [] } };
          }
          throw new Error("prompt inattendu");
        }),
        create: vi.fn(),
      },
    };

    const patch = await performCourseStepUnit(client as never, INPUT, progress, {
      kind: "moduleQuiz",
      moduleIndex: 1,
    });

    expect(Object.keys(patch.moduleQuizzes ?? {})).toEqual(["1"]);
    // Les leçons du module 1 (index 3,4,5) sont mentionnées, jamais celles du module 0.
    expect(receivedUser).toContain("Leçon 3");
    expect(receivedUser).not.toContain("Module 1\"");
  });
});

describe("assembleCourseFromProgress (vraie fonction)", () => {
  it("assemble une GeneratedCourse cohérente une fois toutes les unités prêtes", () => {
    const allChapters = Object.fromEntries(
      Array.from({ length: 6 }, (_, i) => [String(i), { position: i, title: `Leçon ${i}`, explanation: "x", keyTakeaway: "x", example: { isReal: false, description: "x", sourceUrl: null, sourceTitle: null } }]),
    );
    const progress: CourseStepProgress = {
      stage: "assemblage",
      chapters: allChapters,
      moduleQuizzes: { "0": [], "1": [] },
      summary: { summary: "Résumé complet", keyPoints: ["Point"] },
      finalQuiz: [],
    };

    const course = assembleCourseFromProgress(INPUT, progress);

    expect(course.chapters).toHaveLength(6);
    expect(course.modules).toHaveLength(2);
    expect(course.modules?.[0].chapters).toHaveLength(3);
    expect(course.modules?.[1].chapters.map((c) => c.title)).toEqual(["Leçon 3", "Leçon 4", "Leçon 5"]);
    expect(course.summary).toBe("Résumé complet");
  });

  it("refuse d'assembler si un chapitre manque (progression incohérente)", () => {
    const progress: CourseStepProgress = {
      stage: "assemblage",
      chapters: {},
      moduleQuizzes: {},
      summary: { summary: "x", keyPoints: [] },
      finalQuiz: [],
    };
    expect(() => assembleCourseFromProgress(INPUT, progress)).toThrow(CourseGenerationError);
  });
});
