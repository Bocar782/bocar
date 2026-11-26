import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("mode test : aucun appel Anthropic", () => {
  it("formation + analyse complètes sans réseau", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { createAnthropicClient } = await import("@/lib/anthropic/client");
    const g = await import("@/lib/courses/generate");
    const a = await import("@/lib/analysis/generate");
    const client = createAnthropicClient();

    const answers = [{ questionId: "niveau", question: "Ton niveau ?", answer: "Débutant complet" }];
    const q = await g.generateAdaptiveDiagnosticQuestion(client, "le marketing digital", []);
    expect(q.question).not.toBeNull();

    const plan = await g.buildCoursePlan(client, "le marketing digital", { diagnosticAnswers: answers });
    const input = { topic: "le marketing digital", analysis: plan.analysis, verifiedExamples: plan.verifiedExamples, programme: plan.programme };
    const progress = { ...g.EMPTY_COURSE_PROGRESS };
    for (let i = 0; i < 50; i++) {
      const unit = g.decideNextCourseStep(input, progress);
      if (unit.kind === "assemble") break;
      Object.assign(progress, await g.performCourseStepUnit(client, input, progress, unit));
    }
    const course = g.assembleCourseFromProgress(input, progress);
    expect(course.chapters.length).toBe(9);
    expect(course.introduction).toContain("Débutant complet");

    const aIn = { topic: "lancer une marque de vêtements" };
    const ap: Record<string, unknown> = { stage: "cadrage", sections: {} };
    for (let i = 0; i < 30; i++) {
      const unit = a.decideNextAnalysisStep(ap as never);
      if (unit.kind === "assemble") break;
      Object.assign(ap, await a.performAnalysisStepUnit(client, aIn, ap as never, unit));
    }
    const analysis = a.assembleAnalysisFromProgress(aIn, ap as never);
    expect(analysis.sections.length).toBe(3);

    await expect(client.messages.create({ model: "x", max_tokens: 1, messages: [] })).rejects.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});
