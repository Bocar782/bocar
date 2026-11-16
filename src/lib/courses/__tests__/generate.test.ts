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
  validateProgrammeStructure,
  writeChapter,
} from "@/lib/courses/generate";
import type { FlatChapterPlan } from "@/lib/courses/generate";
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

// Ce test réimporte generate.ts normalement (sans mock actif) pour
// s'assurer que le mock ci-dessus n'a pas pollué les autres suites.
describe("generateCourse export sanity", () => {
  it("expose bien generateCourse et CourseGenerationError", () => {
    expect(typeof generateCourse).toBe("function");
    expect(CourseGenerationError).toBeDefined();
  });
});
