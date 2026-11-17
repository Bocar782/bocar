// Vrais tests automatisés (Prompt 05.20.1, architecture à étapes courtes) :
// importent et exécutent le VRAI code de generate.ts. Le client Anthropic
// est un simple objet mocké construit directement — aucun appel réel.
import { describe, expect, it, vi } from "vitest";
import {
  AnalysisGenerationError,
  assembleAnalysisFromProgress,
  decideNextAnalysisStep,
  EMPTY_ANALYSIS_PROGRESS,
  performAnalysisStepUnit,
  stageForAnalysisUnit,
  type AnalysisStepInput,
  type AnalysisStepProgress,
} from "@/lib/analysis/generate";
import type { AnalysisBrief, VerifiedCase } from "@/lib/analysis/schemas";

const INPUT: AnalysisStepInput = { topic: "Sujet de test" };

const BRIEF: AnalysisBrief = {
  title: "Analyse test",
  domain: "Test",
  introduction: "Introduction",
  researchAngle: "Angle",
  caseCount: 2,
  searchQueries: ["requête 1", "requête 2"],
};

const CASES: VerifiedCase[] = [
  { name: "Cas A", summary: "Résumé A", outcome: "succès", sourceUrl: "https://a.example.com", sourceTitle: "Source A" },
  { name: "Cas B", summary: "Résumé B", outcome: "échec", sourceUrl: "https://b.example.com", sourceTitle: "Source B" },
];

function makeClient(
  handler: (args: { system: string; messages: { content: string }[] }) => unknown,
) {
  return { messages: { parse: vi.fn(async (args: never) => handler(args)), create: vi.fn() } };
}

describe("decideNextAnalysisStep (vraie fonction) — ordre des étapes", () => {
  it("commence par le cadrage", () => {
    expect(decideNextAnalysisStep(EMPTY_ANALYSIS_PROGRESS)).toEqual({ kind: "cadrage" });
  });

  it("passe à un tour de recherche une fois le cadrage fait", () => {
    const progress: AnalysisStepProgress = { ...EMPTY_ANALYSIS_PROGRESS, brief: BRIEF };
    expect(decideNextAnalysisStep(progress)).toEqual({ kind: "research_turn" });
  });

  it("redemande un tour de recherche tant que la recherche n'est pas terminée, même avec un état partiel", () => {
    const progress: AnalysisStepProgress = {
      ...EMPTY_ANALYSIS_PROGRESS,
      brief: BRIEF,
      research: { messages: [], resumes: 1, findings: "notes partielles", realSources: [], done: false },
    };
    expect(decideNextAnalysisStep(progress)).toEqual({ kind: "research_turn" });
  });

  it("passe à l'extraction des cas une fois la recherche terminée", () => {
    const progress: AnalysisStepProgress = {
      ...EMPTY_ANALYSIS_PROGRESS,
      brief: BRIEF,
      research: { messages: [], resumes: 2, findings: "notes complètes", realSources: [], done: true },
    };
    expect(decideNextAnalysisStep(progress)).toEqual({ kind: "extract" });
  });

  it("rédige chaque section une par une, dans l'ordre, après la recherche", () => {
    const progress: AnalysisStepProgress = { ...EMPTY_ANALYSIS_PROGRESS, brief: BRIEF, verifiedCases: CASES };
    expect(decideNextAnalysisStep(progress)).toEqual({ kind: "section", index: 0 });

    const progress2: AnalysisStepProgress = {
      ...progress,
      sections: { "0": { position: 0, name: "Cas A", outcome: "succès", content: "x", lessons: [], source: { index: 0, url: "x", title: "x" } } },
    };
    expect(decideNextAnalysisStep(progress2)).toEqual({ kind: "section", index: 1 });
  });

  it("passe à la synthèse puis à l'assemblage une fois toutes les sections prêtes", () => {
    const sections = {
      "0": { position: 0, name: "Cas A", outcome: "succès" as const, content: "x", lessons: [], source: { index: 0, url: "x", title: "x" } },
      "1": { position: 1, name: "Cas B", outcome: "échec" as const, content: "x", lessons: [], source: { index: 1, url: "x", title: "x" } },
    };
    const progress: AnalysisStepProgress = { ...EMPTY_ANALYSIS_PROGRESS, brief: BRIEF, verifiedCases: CASES, sections };
    expect(decideNextAnalysisStep(progress)).toEqual({ kind: "synthese" });

    const progress2 = { ...progress, synthesis: { synthesis: "x", keyLessons: [] } };
    expect(decideNextAnalysisStep(progress2)).toEqual({ kind: "assemble" });
  });
});

describe("stageForAnalysisUnit (vraie fonction)", () => {
  it("associe chaque unité à l'étape d'affichage attendue", () => {
    expect(stageForAnalysisUnit({ kind: "cadrage" })).toBe("cadrage");
    expect(stageForAnalysisUnit({ kind: "research_turn" })).toBe("recherche");
    expect(stageForAnalysisUnit({ kind: "extract" })).toBe("recherche");
    expect(stageForAnalysisUnit({ kind: "section", index: 0 })).toBe("redaction");
    expect(stageForAnalysisUnit({ kind: "synthese" })).toBe("synthese");
    expect(stageForAnalysisUnit({ kind: "assemble" })).toBe("assemblage");
  });
});

describe("performAnalysisStepUnit (vraie fonction) — une seule unité à la fois", () => {
  it("exécute le cadrage et renvoie uniquement `brief`", async () => {
    const client = makeClient((args) => {
      if (args.system.includes("Tu cadres une demande d'analyse")) {
        return { stop_reason: "end_turn", parsed_output: BRIEF };
      }
      throw new Error(`prompt inattendu : ${args.system.slice(0, 40)}`);
    });

    const patch = await performAnalysisStepUnit(client as never, INPUT, EMPTY_ANALYSIS_PROGRESS, { kind: "cadrage" });

    expect(patch.brief?.title).toBe("Analyse test");
  });

  it("research_turn : exécute UN SEUL appel Anthropic et renvoie un état `done:true` si le modèle ne demande pas de reprise", async () => {
    const create = vi.fn(async () => ({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "notes de recherche" }],
    }));
    const client = { messages: { create, parse: vi.fn() } };
    const progress: AnalysisStepProgress = { ...EMPTY_ANALYSIS_PROGRESS, brief: BRIEF };

    const patch = await performAnalysisStepUnit(client as never, INPUT, progress, { kind: "research_turn" });

    expect(create).toHaveBeenCalledTimes(1);
    expect(patch.research?.done).toBe(true);
    expect(patch.research?.findings).toContain("notes de recherche");
  });

  it("research_turn : renvoie `done:false` sur pause_turn, pour qu'un NOUVEL appel (étape suivante) reprenne le même tour", async () => {
    const create = vi.fn(async () => ({
      stop_reason: "pause_turn",
      content: [{ type: "text", text: "recherche en cours" }],
    }));
    const client = { messages: { create, parse: vi.fn() } };
    const progress: AnalysisStepProgress = { ...EMPTY_ANALYSIS_PROGRESS, brief: BRIEF };

    const patch = await performAnalysisStepUnit(client as never, INPUT, progress, { kind: "research_turn" });

    expect(create).toHaveBeenCalledTimes(1);
    expect(patch.research?.done).toBe(false);
    expect(patch.research?.resumes).toBe(0);
  });

  it("research_turn : reprend l'état précédent plutôt que de recommencer, et accumule les trouvailles des tours successifs", async () => {
    const create = vi.fn(async () => ({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "second tour" }],
    }));
    const client = { messages: { create, parse: vi.fn() } };
    const progress: AnalysisStepProgress = {
      ...EMPTY_ANALYSIS_PROGRESS,
      brief: BRIEF,
      research: {
        messages: [{ role: "user", content: "premier tour" }],
        resumes: 0,
        findings: "premier tour",
        realSources: [],
        done: false,
      },
    };

    const patch = await performAnalysisStepUnit(client as never, INPUT, progress, { kind: "research_turn" });

    expect(create).toHaveBeenCalledTimes(1);
    expect(patch.research?.resumes).toBe(1);
    expect(patch.research?.findings).toBe("premier tour\n\nsecond tour");
    expect(patch.research?.messages).toHaveLength(2);
  });

  it("extract : échoue (AnalysisGenerationError) si la recherche ne trouve pas assez de cas vérifiés", async () => {
    const client = {
      messages: {
        create: vi.fn(),
        parse: vi.fn(async (args: { system: string }) => {
          if (args.system.includes("extrais des cas réels")) {
            return { stop_reason: "end_turn", parsed_output: { cases: [] } };
          }
          throw new Error("prompt inattendu");
        }),
      },
    };
    const progress: AnalysisStepProgress = {
      ...EMPTY_ANALYSIS_PROGRESS,
      brief: BRIEF,
      research: { messages: [], resumes: 0, findings: "notes", realSources: [], done: true },
    };

    await expect(
      performAnalysisStepUnit(client as never, INPUT, progress, { kind: "extract" }),
    ).rejects.toThrow(AnalysisGenerationError);
    expect(client.messages.create).not.toHaveBeenCalled();
  });

  it("rédige UNE SEULE section à la fois et renvoie un patch contenant uniquement cette section", async () => {
    const client = makeClient((args) => {
      if (args.system.includes("une section d'analyse approfondie")) {
        return { stop_reason: "end_turn", parsed_output: { content: "Contenu de la section", lessons: ["Leçon"] } };
      }
      throw new Error(`prompt inattendu : ${args.system.slice(0, 40)}`);
    });
    const progress: AnalysisStepProgress = { ...EMPTY_ANALYSIS_PROGRESS, brief: BRIEF, verifiedCases: CASES };

    const patch = await performAnalysisStepUnit(client as never, INPUT, progress, { kind: "section", index: 1 });

    expect(Object.keys(patch.sections ?? {})).toEqual(["1"]);
    expect(patch.sections?.["1"].name).toBe("Cas B");
  });

  it("génère la synthèse à partir de toutes les sections déjà rédigées", async () => {
    const sections = {
      "0": { position: 0, name: "Cas A", outcome: "succès" as const, content: "x", lessons: ["l1"], source: { index: 0, url: "x", title: "x" } },
      "1": { position: 1, name: "Cas B", outcome: "échec" as const, content: "x", lessons: ["l2"], source: { index: 1, url: "x", title: "x" } },
    };
    const progress: AnalysisStepProgress = { ...EMPTY_ANALYSIS_PROGRESS, brief: BRIEF, verifiedCases: CASES, sections };

    const client = makeClient((args) => {
      if (args.system.includes("synthèse pédagogique finale")) {
        return { stop_reason: "end_turn", parsed_output: { synthesis: "Synthèse", keyLessons: ["Leçon clé"] } };
      }
      throw new Error(`prompt inattendu : ${args.system.slice(0, 40)}`);
    });

    const patch = await performAnalysisStepUnit(client as never, INPUT, progress, { kind: "synthese" });

    expect(patch.synthesis).toEqual({ synthesis: "Synthèse", keyLessons: ["Leçon clé"] });
  });
});

describe("assembleAnalysisFromProgress (vraie fonction)", () => {
  it("assemble une GeneratedDeepAnalysis cohérente une fois toutes les unités prêtes", () => {
    const sections = {
      "0": { position: 0, name: "Cas A", outcome: "succès" as const, content: "x", lessons: ["l1"], source: { index: 0, url: "https://a.example.com", title: "Source A" } },
      "1": { position: 1, name: "Cas B", outcome: "échec" as const, content: "x", lessons: ["l2"], source: { index: 1, url: "https://b.example.com", title: "Source B" } },
    };
    const progress: AnalysisStepProgress = {
      stage: "assemblage",
      brief: BRIEF,
      verifiedCases: CASES,
      sections,
      synthesis: { synthesis: "Synthèse finale", keyLessons: ["Leçon clé"] },
    };

    const analysis = assembleAnalysisFromProgress(INPUT, progress);

    expect(analysis.sections).toHaveLength(2);
    expect(analysis.sources).toHaveLength(2);
    expect(analysis.synthesis).toBe("Synthèse finale");
  });

  it("refuse d'assembler si une section manque (progression incohérente)", () => {
    const progress: AnalysisStepProgress = {
      stage: "assemblage",
      brief: BRIEF,
      verifiedCases: CASES,
      sections: {},
      synthesis: { synthesis: "x", keyLessons: [] },
    };
    expect(() => assembleAnalysisFromProgress(INPUT, progress)).toThrow(AnalysisGenerationError);
  });
});
