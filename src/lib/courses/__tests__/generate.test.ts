// Vrais tests automatisés (Prompt 05.9, dernières sécurisations) :
// importent et exécutent le VRAI code de src/lib/courses/generate.ts
// (pas une copie de sa logique) — seul le client Anthropic (frontière
// externe payante) est mocké. Aucun appel réel à l'API Anthropic.
import { describe, expect, it, vi } from "vitest";
import {
  ConcurrencyLimiter,
  CourseGenerationError,
  MAX_CHAPTERS_PER_MODULE,
  MAX_CONCURRENT_AI_CALLS,
  MAX_MODULE_COUNT,
  MIN_CHAPTERS_PER_MODULE,
  MIN_MODULE_COUNT,
  flattenModulePlans,
  generateCourse,
  validateChapterContent,
  validateProgrammeStructure,
  writeChapter,
} from "@/lib/courses/generate";
import type { FlatChapterPlan } from "@/lib/courses/generate";
import type { Analysis, ChapterContent, Programme, ProgrammeModule } from "@/lib/courses/schemas";

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
  return {
    introduction: "Introduction",
    objectives: ["Objectif global"],
    summaryAngle: "Angle",
    modules,
  };
}

const ANALYSIS: Analysis = {
  title: "Formation test",
  domain: "Test",
  level: "débutant",
  angle: "pratique",
  moduleCount: 3,
  usesRealWorldExamples: false,
};

// ---------------------------------------------------------------------
// validateProgrammeStructure — vraie fonction importée
// ---------------------------------------------------------------------

describe("validateProgrammeStructure (vrai code)", () => {
  it("refuse 1 module", () => {
    const errors = validateProgrammeStructure(makeProgramme([makeModule("M1", "Obj1", 4)]));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join(" ")).toMatch(/Nombre de modules invalide/);
  });

  it("refuse 5 modules", () => {
    const programme = makeProgramme(
      Array.from({ length: 5 }, (_, i) => makeModule(`M${i + 1}`, `Obj${i + 1}`, 4)),
    );
    const errors = validateProgrammeStructure(programme);
    expect(errors.join(" ")).toMatch(/Nombre de modules invalide/);
  });

  it("refuse un module à 2 leçons", () => {
    const programme = makeProgramme([makeModule("M1", "Obj1", 2), makeModule("M2", "Obj2", 4)]);
    const errors = validateProgrammeStructure(programme);
    expect(errors.some((e) => e.includes("Module 1") && e.includes("leçon"))).toBe(true);
  });

  it("refuse un module à 6 leçons", () => {
    const programme = makeProgramme([makeModule("M1", "Obj1", 6), makeModule("M2", "Obj2", 4)]);
    const errors = validateProgrammeStructure(programme);
    expect(errors.some((e) => e.includes("Module 1") && e.includes("leçon"))).toBe(true);
  });

  it(`accepte une structure valide (${MIN_MODULE_COUNT} à ${MAX_MODULE_COUNT} modules, ${MIN_CHAPTERS_PER_MODULE} à ${MAX_CHAPTERS_PER_MODULE} leçons)`, () => {
    const valid2 = makeProgramme([makeModule("M1", "Obj1", MIN_CHAPTERS_PER_MODULE), makeModule("M2", "Obj2", MAX_CHAPTERS_PER_MODULE)]);
    const valid4 = makeProgramme([
      makeModule("M1", "Obj1", 3),
      makeModule("M2", "Obj2", 4),
      makeModule("M3", "Obj3", 5),
      makeModule("M4", "Obj4", 3),
    ]);
    expect(validateProgrammeStructure(valid2)).toEqual([]);
    expect(validateProgrammeStructure(valid4)).toEqual([]);
  });

  it("refuse un titre ou un objectif vide même avec un nombre de leçons valide", () => {
    const emptyTitle = makeProgramme([makeModule("", "Obj1", 4), makeModule("M2", "Obj2", 4)]);
    const emptyObjective = makeProgramme([makeModule("M1", "   ", 4), makeModule("M2", "Obj2", 4)]);
    expect(validateProgrammeStructure(emptyTitle).some((e) => e.includes("titre manquant ou vide"))).toBe(true);
    expect(
      validateProgrammeStructure(emptyObjective).some((e) => e.includes("objectif pédagogique manquant ou vide")),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------
// flattenModulePlans — vraie fonction importée
// ---------------------------------------------------------------------

describe("flattenModulePlans (vrai code)", () => {
  it("transmet le bon titre/objectif/position à chaque leçon, par module", () => {
    const modules = [makeModule("Module A", "Objectif A", 3), makeModule("Module B", "Objectif B", 4)];
    const flat: FlatChapterPlan[] = flattenModulePlans(modules);

    expect(flat).toHaveLength(7);
    expect(flat.every((p) => p.totalModules === 2)).toBe(true);

    const moduleA = flat.filter((p) => p.moduleIndex === 0);
    const moduleB = flat.filter((p) => p.moduleIndex === 1);

    expect(moduleA.every((p) => p.moduleTitle === "Module A" && p.moduleObjective === "Objectif A")).toBe(true);
    expect(moduleB.every((p) => p.moduleTitle === "Module B" && p.moduleObjective === "Objectif B")).toBe(true);
    expect(moduleA.map((p) => p.positionInModule)).toEqual([0, 1, 2]);
    expect(moduleB.map((p) => p.positionInModule)).toEqual([0, 1, 2, 3]);
    expect(flat.map((p) => p.globalIndex)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

// ---------------------------------------------------------------------
// ConcurrencyLimiter — vraie classe importée
// ---------------------------------------------------------------------

describe("ConcurrencyLimiter (vrai code)", () => {
  it(`ne dépasse jamais ${MAX_CONCURRENT_AI_CALLS} exécutions simultanées`, async () => {
    const limiter = new ConcurrencyLimiter(MAX_CONCURRENT_AI_CALLS);
    let current = 0;
    let maxObserved = 0;

    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        limiter.run(async () => {
          current += 1;
          maxObserved = Math.max(maxObserved, current);
          await new Promise((r) => setTimeout(r, 5 + (i % 3) * 5));
          current -= 1;
          return i;
        }),
      ),
    );

    expect(maxObserved).toBeLessThanOrEqual(MAX_CONCURRENT_AI_CALLS);
    expect(maxObserved).toBe(MAX_CONCURRENT_AI_CALLS);
    expect(results).toEqual(Array.from({ length: 20 }, (_, i) => i));
  });

  it("propage les erreurs sans rester bloqué", async () => {
    const limiter = new ConcurrencyLimiter(MAX_CONCURRENT_AI_CALLS);

    await expect(
      Promise.all([
        limiter.run(async () => "ok"),
        limiter.run(async () => {
          throw new Error("échec simulé");
        }),
      ]),
    ).rejects.toThrow("échec simulé");

    // Le sémaphore doit rester utilisable après une erreur (place libérée
    // dans le `finally` du vrai code).
    let maxAfter = 0;
    let currentAfter = 0;
    const after = await Promise.all(
      Array.from({ length: 6 }, () =>
        limiter.run(async () => {
          currentAfter += 1;
          maxAfter = Math.max(maxAfter, currentAfter);
          await new Promise((r) => setTimeout(r, 5));
          currentAfter -= 1;
          return true;
        }),
      ),
    );
    expect(after.every(Boolean)).toBe(true);
    expect(maxAfter).toBeLessThanOrEqual(MAX_CONCURRENT_AI_CALLS);
  });
});

// ---------------------------------------------------------------------
// writeChapter — vraie fonction importée, client Anthropic mocké :
// vérifie la transmission RÉELLE de moduleObjective dans le prompt envoyé.
// ---------------------------------------------------------------------

describe("writeChapter (vrai code, client Anthropic mocké)", () => {
  it("transmet le titre, l'objectif du module et la position de la leçon dans le prompt réellement envoyé", async () => {
    const modules = [makeModule("Fondamentaux", "Savoir identifier les bases", 3), makeModule("Avancé", "Savoir appliquer en situation réelle", 4)];
    const plans = flattenModulePlans(modules);
    const plan = plans[4]; // 2e leçon du module "Avancé" (moduleIndex 1, positionInModule 1)

    let capturedUser = "";
    const mockClient = {
      messages: {
        parse: vi.fn(async (args: { system: string; messages: { content: string }[] }) => {
          // `client.messages.parse` reçoit `messages: [{ role: "user", content }]`
          // (voir parseStructured dans generate.ts) — pas un champ `user` direct.
          capturedUser = args.messages[0].content;
          return {
            stop_reason: "end_turn",
            parsed_output: {
              explanation: "Explication.",
              keyTakeaway: "À retenir.",
              example: { isReal: false, description: "Exemple fictif.", sourceUrl: null, sourceTitle: null },
            },
          };
        }),
      },
    };

    await writeChapter(mockClient as never, ANALYSIS, modules, plan, null);

    expect(mockClient.messages.parse).toHaveBeenCalledTimes(1);
    expect(capturedUser).toContain(plan.moduleTitle);
    expect(capturedUser).toContain(plan.moduleObjective);
    expect(capturedUser).toContain("Avancé");
    expect(capturedUser).toContain("Savoir appliquer en situation réelle");
    expect(capturedUser).toContain(`module ${plan.moduleIndex + 1}/${plan.totalModules}`);
    expect(capturedUser).toContain(`${plan.positionInModule + 1}ᵉ sur ${plan.chaptersInModule}`);
    // L'objectif du MODULE SUIVANT ne doit jamais apparaître comme étant
    // celui de cette leçon (vérifie qu'on transmet le bon module, pas
    // n'importe lequel).
    expect(capturedUser).not.toContain("Fondamentaux\" (module 2");
  });
});

// ---------------------------------------------------------------------
// generateCourse — vraie orchestration importée, client Anthropic mocké :
// vérifie la propagation d'une erreur de structure et l'absence d'appels
// coûteux supplémentaires après l'échec.
// ---------------------------------------------------------------------

function systemIncludes(system: string, needle: string): boolean {
  return system.includes(needle);
}

describe("generateCourse (vrai code, client Anthropic mocké) — échec de structure", () => {
  it("rejette avec CourseGenerationError et n'appelle jamais la rédaction de leçon/quiz/résumé après un programme invalide persistant", async () => {
    const calls: string[] = [];

    const parse = vi.fn(async (args: { system: string }) => {
      if (systemIncludes(args.system, "ingénierie pédagogique")) {
        calls.push("analyse");
        return {
          stop_reason: "end_turn",
          parsed_output: { ...ANALYSIS },
        };
      }
      if (systemIncludes(args.system, "plan détaillé d'une formation structurée en modules")) {
        calls.push("programme");
        // Toujours invalide (1 seul module) — même après la tentative de
        // correction : le vrai buildProgramme() doit abandonner proprement.
        return {
          stop_reason: "end_turn",
          parsed_output: {
            introduction: "Intro",
            objectives: ["Obj"],
            summaryAngle: "Angle",
            modules: [{ title: "Unique", objective: "Objectif", chapters: [
              { title: "L1", summary: "S1", exampleIndex: null },
              { title: "L2", summary: "S2", exampleIndex: null },
              { title: "L3", summary: "S3", exampleIndex: null },
            ] }],
          },
        };
      }
      if (systemIncludes(args.system, "rédiges une leçon complète et pédagogique")) {
        calls.push("chapitre");
      }
      if (systemIncludes(args.system, "résumé final d'une formation à partir de ses points clés")) {
        calls.push("resume");
      }
      if (systemIncludes(args.system, "validation des acquis pour UN SEUL module")) {
        calls.push("quiz_module");
      }
      if (systemIncludes(args.system, "quiz FINAL d'une formation")) {
        calls.push("quiz_final");
      }
      throw new Error(`system prompt inattendu dans ce test : ${args.system.slice(0, 60)}`);
    });

    vi.doMock("@/lib/anthropic/client", () => ({
      createAnthropicClient: () => ({ messages: { parse, create: vi.fn() } }),
    }));

    vi.resetModules();
    const { generateCourse: realGenerateCourse, CourseGenerationError: RealError } = await import(
      "@/lib/courses/generate"
    );

    await expect(realGenerateCourse("Sujet de test", () => {})).rejects.toThrow(RealError);

    // L'analyse (1) puis exactement 2 tentatives de programme (initiale +
    // 1 correction, jamais plus) : aucun appel coûteux de rédaction de
    // leçon, de résumé ou de quiz n'a lieu après l'échec de structure.
    expect(calls).toEqual(["analyse", "programme", "programme"]);
    expect(calls.filter((c) => c === "chapitre")).toHaveLength(0);
    expect(calls.filter((c) => c === "resume")).toHaveLength(0);
    expect(calls.filter((c) => c === "quiz_module")).toHaveLength(0);
    expect(calls.filter((c) => c === "quiz_final")).toHaveLength(0);

    vi.doUnmock("@/lib/anthropic/client");
    vi.resetModules();
  });
});

// ---------------------------------------------------------------------
// validateChapterContent — vraie fonction importée (Prompt 05.11, LOT D)
// ---------------------------------------------------------------------

function makePlan(overrides: Partial<FlatChapterPlan> = {}): FlatChapterPlan {
  return {
    globalIndex: 0,
    moduleIndex: 0,
    totalModules: 1,
    moduleTitle: "Module",
    moduleObjective: "Objectif",
    positionInModule: 0,
    chaptersInModule: 3,
    title: "Leçon",
    summary: "Résumé",
    exampleIndex: null,
    ...overrides,
  };
}

function makeChapterContent(overrides: Partial<ChapterContent> = {}): ChapterContent {
  return {
    explanation: "Une explication suffisamment longue pour passer la validation légère de longueur.",
    keyTakeaway: "À retenir.",
    example: { isReal: false, description: "Un exemple.", sourceUrl: null, sourceTitle: null },
    exercise: null,
    ...overrides,
  };
}

describe("validateChapterContent (vrai code)", () => {
  it("accepte un contenu valide sans exercice", () => {
    expect(validateChapterContent(makeChapterContent(), makePlan())).toEqual([]);
  });

  it("accepte un contenu valide AVEC un exercice cohérent (consigne + correction)", () => {
    const content = makeChapterContent({ exercise: { prompt: "Fais ceci.", solution: "Voici comment." } });
    expect(validateChapterContent(content, makePlan())).toEqual([]);
  });

  it("n'exige pas de longueur artificielle : une explication courte mais au-dessus du plancher est acceptée", () => {
    const content = makeChapterContent({ explanation: "Une explication courte mais déjà suffisante ici." });
    expect(validateChapterContent(content, makePlan())).toEqual([]);
  });

  it("refuse une explication anormalement vide ou tronquée", () => {
    const content = makeChapterContent({ explanation: "Trop court." });
    const errors = validateChapterContent(content, makePlan());
    expect(errors.some((e) => e.includes("explication anormalement"))).toBe(true);
  });

  it("refuse un encadré à retenir vide", () => {
    const content = makeChapterContent({ keyTakeaway: "   " });
    const errors = validateChapterContent(content, makePlan());
    expect(errors.some((e) => e.includes("à retenir"))).toBe(true);
  });

  it("refuse un exemple vide", () => {
    const content = makeChapterContent({
      example: { isReal: false, description: "   ", sourceUrl: null, sourceTitle: null },
    });
    const errors = validateChapterContent(content, makePlan());
    expect(errors.some((e) => e.includes("exemple manquant ou vide"))).toBe(true);
  });

  it("refuse un exercice incohérent : consigne présente mais correction vide", () => {
    const content = makeChapterContent({ exercise: { prompt: "Fais ceci.", solution: "   " } });
    const errors = validateChapterContent(content, makePlan());
    expect(errors.some((e) => e.includes("exercice présent mais incomplet"))).toBe(true);
  });

  it("refuse un exercice incohérent : correction présente mais consigne vide", () => {
    const content = makeChapterContent({ exercise: { prompt: "", solution: "Voici comment." } });
    const errors = validateChapterContent(content, makePlan());
    expect(errors.some((e) => e.includes("exercice présent mais incomplet"))).toBe(true);
  });
});

// ---------------------------------------------------------------------
// writeChapter — vérifie la transmission des nouvelles consignes LOT B/C
// ---------------------------------------------------------------------

describe("writeChapter (vrai code) — nouvelles consignes LOT B/C", () => {
  it("transmet la consigne anti-répétition inter-leçons et la consigne d'exercice facultatif", async () => {
    const modules = [makeModule("Module A", "Objectif A", 3)];
    const plan = flattenModulePlans(modules)[0];

    let capturedSystem = "";
    let capturedUser = "";
    const mockClient = {
      messages: {
        parse: vi.fn(async (args: { system: string; messages: { content: string }[] }) => {
          capturedSystem = args.system;
          capturedUser = args.messages[0].content;
          return {
            stop_reason: "end_turn",
            parsed_output: makeChapterContent(),
          };
        }),
      },
    };

    await writeChapter(mockClient as never, ANALYSIS, modules, plan, null);

    expect(capturedUser).toMatch(/connaissances NOUVELLES/);
    expect(capturedUser).toMatch(/ne réexplique jamais/);
    expect(capturedSystem).toMatch(/analogie ou un contre-exemple/);
    expect(capturedSystem).toMatch(/tableau comparatif/);
    expect(capturedSystem).toMatch(/exercice pratique/);
    expect(capturedUser).toMatch(/laisse `exercise` à null/);
  });
});

// ---------------------------------------------------------------------
// generateCourse — succès complet multi-modules, avec et sans exercice
// ---------------------------------------------------------------------

describe("generateCourse (vrai code, client Anthropic mocké) — succès complet multi-modules", () => {
  it("génère 2 modules (3 leçons chacun), transmet l'exercice jusqu'au résultat pour les leçons qui en ont, null pour les autres", async () => {
    let chapterCallCount = 0;

    const parse = vi.fn(async (args: { system: string }) => {
      if (systemIncludes(args.system, "ingénierie pédagogique")) {
        return {
          stop_reason: "end_turn",
          parsed_output: { ...ANALYSIS, moduleCount: 2, usesRealWorldExamples: false },
        };
      }
      if (systemIncludes(args.system, "plan détaillé d'une formation structurée en modules")) {
        return {
          stop_reason: "end_turn",
          parsed_output: {
            introduction: "Intro",
            objectives: ["Obj"],
            summaryAngle: "Angle",
            modules: [
              {
                title: "Module A",
                objective: "Objectif A",
                chapters: [
                  { title: "A1", summary: "SA1", exampleIndex: null },
                  { title: "A2", summary: "SA2", exampleIndex: null },
                  { title: "A3", summary: "SA3", exampleIndex: null },
                ],
              },
              {
                title: "Module B",
                objective: "Objectif B",
                chapters: [
                  { title: "B1", summary: "SB1", exampleIndex: null },
                  { title: "B2", summary: "SB2", exampleIndex: null },
                  { title: "B3", summary: "SB3", exampleIndex: null },
                ],
              },
            ],
          },
        };
      }
      if (systemIncludes(args.system, "rédiges une leçon complète et pédagogique")) {
        chapterCallCount += 1;
        const hasExercise = chapterCallCount % 2 === 1; // une sur deux a un exercice
        return {
          stop_reason: "end_turn",
          parsed_output: makeChapterContent({
            explanation: `Explication suffisamment longue pour la leçon numéro ${chapterCallCount}, qui passe la validation.`,
            exercise: hasExercise ? { prompt: "Consigne.", solution: "Correction." } : null,
          }),
        };
      }
      if (systemIncludes(args.system, "résumé final d'une formation à partir de ses points clés")) {
        return { stop_reason: "end_turn", parsed_output: { summary: "Résumé final.", keyPoints: ["Point 1"] } };
      }
      if (systemIncludes(args.system, "validation des acquis pour UN SEUL module")) {
        return { stop_reason: "end_turn", parsed_output: { questions: [] } };
      }
      if (systemIncludes(args.system, "quiz FINAL d'une formation")) {
        return { stop_reason: "end_turn", parsed_output: { questions: [] } };
      }
      throw new Error(`system prompt inattendu dans ce test : ${args.system.slice(0, 60)}`);
    });

    vi.doMock("@/lib/anthropic/client", () => ({
      createAnthropicClient: () => ({ messages: { parse, create: vi.fn() } }),
    }));
    vi.resetModules();
    const { generateCourse: realGenerateCourse } = await import("@/lib/courses/generate");

    const course = await realGenerateCourse("Sujet multi-modules", () => {});

    expect(course.modules).toHaveLength(2);
    expect(course.chapters).toHaveLength(6);
    expect(chapterCallCount).toBe(6);

    const withExercise = course.chapters.filter((c) => c.exercise !== null);
    const withoutExercise = course.chapters.filter((c) => c.exercise === null);
    expect(withExercise.length).toBeGreaterThan(0);
    expect(withoutExercise.length).toBeGreaterThan(0);
    expect(withExercise[0].exercise).toEqual({ prompt: "Consigne.", solution: "Correction." });

    vi.doUnmock("@/lib/anthropic/client");
    vi.resetModules();
  });
});

// ---------------------------------------------------------------------
// generateCourse — rejet d'un contenu de leçon invalide (LOT D)
// ---------------------------------------------------------------------

describe("generateCourse (vrai code, client Anthropic mocké) — rejet d'un contenu de leçon invalide", () => {
  it("rejette avec CourseGenerationError si une leçon revient avec une explication anormalement vide, sans jamais appeler résumé ni quiz", async () => {
    const calls: string[] = [];

    const parse = vi.fn(async (args: { system: string }) => {
      if (systemIncludes(args.system, "ingénierie pédagogique")) {
        return {
          stop_reason: "end_turn",
          parsed_output: { ...ANALYSIS, moduleCount: 2, usesRealWorldExamples: false },
        };
      }
      if (systemIncludes(args.system, "plan détaillé d'une formation structurée en modules")) {
        return {
          stop_reason: "end_turn",
          parsed_output: {
            introduction: "Intro",
            objectives: ["Obj"],
            summaryAngle: "Angle",
            modules: [
              {
                title: "Module A",
                objective: "Objectif A",
                chapters: [
                  { title: "A1", summary: "SA1", exampleIndex: null },
                  { title: "A2", summary: "SA2", exampleIndex: null },
                  { title: "A3", summary: "SA3", exampleIndex: null },
                ],
              },
              {
                title: "Module B",
                objective: "Objectif B",
                chapters: [
                  { title: "B1", summary: "SB1", exampleIndex: null },
                  { title: "B2", summary: "SB2", exampleIndex: null },
                  { title: "B3", summary: "SB3", exampleIndex: null },
                ],
              },
            ],
          },
        };
      }
      if (systemIncludes(args.system, "rédiges une leçon complète et pédagogique")) {
        calls.push("chapitre");
        // Explication anormalement vide : doit être rejetée par
        // validateChapterContent, bien AVANT tout résumé/quiz.
        return {
          stop_reason: "end_turn",
          parsed_output: makeChapterContent({ explanation: "Trop court." }),
        };
      }
      if (systemIncludes(args.system, "résumé final d'une formation à partir de ses points clés")) {
        calls.push("resume");
        return { stop_reason: "end_turn", parsed_output: { summary: "x", keyPoints: [] } };
      }
      if (systemIncludes(args.system, "validation des acquis pour UN SEUL module")) {
        calls.push("quiz_module");
        return { stop_reason: "end_turn", parsed_output: { questions: [] } };
      }
      if (systemIncludes(args.system, "quiz FINAL d'une formation")) {
        calls.push("quiz_final");
        return { stop_reason: "end_turn", parsed_output: { questions: [] } };
      }
      throw new Error(`system prompt inattendu dans ce test : ${args.system.slice(0, 60)}`);
    });

    vi.doMock("@/lib/anthropic/client", () => ({
      createAnthropicClient: () => ({ messages: { parse, create: vi.fn() } }),
    }));
    vi.resetModules();
    const { generateCourse: realGenerateCourse, CourseGenerationError: RealError } = await import(
      "@/lib/courses/generate"
    );

    let caughtError: unknown;
    try {
      await realGenerateCourse("Sujet", () => {});
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(RealError);
    expect((caughtError as Error).message).toMatch(/leçon invalide|explication anormalement/);
    expect(calls.filter((c) => c === "resume")).toHaveLength(0);
    expect(calls.filter((c) => c === "quiz_module")).toHaveLength(0);
    expect(calls.filter((c) => c === "quiz_final")).toHaveLength(0);

    vi.doUnmock("@/lib/anthropic/client");
    vi.resetModules();
  });
});

// Ce test réimporte generate.ts normalement (sans mock actif) pour
// s'assurer que le mock ci-dessus n'a pas pollué les autres suites.
describe("generateCourse export sanity", () => {
  it("expose bien generateCourse et CourseGenerationError", () => {
    expect(typeof generateCourse).toBe("function");
    expect(CourseGenerationError).toBeDefined();
  });
});
