// Vrais tests (Prompt 05.17.1, correction de la faille critique de
// l'audit 05.17) : importent et exécutent le VRAI src/lib/analysis/
// persist.ts — seul le client Supabase (frontière externe) est mocké.
// `saveDeepAnalysis` passe désormais par le RPC `save_generated_analysis`
// (voir 0020_restrict_content_tables_to_owner_select.sql) plutôt que par
// un insert direct sur `deep_analyses`, qui n'a plus qu'une policy RLS de
// lecture.
import { describe, expect, it, vi } from "vitest";
import { saveDeepAnalysis } from "@/lib/analysis/persist";
import type { GeneratedDeepAnalysis } from "@/lib/analysis/schemas";

function makeAnalysis(): GeneratedDeepAnalysis {
  return {
    topic: "Sujet",
    title: "Analyse test",
    domain: "Test",
    introduction: "Intro",
    sections: [
      {
        position: 0,
        name: "Section 1",
        outcome: "succès",
        content: "Contenu 1",
        lessons: ["Leçon de section"],
        source: { index: 0, url: "https://example.com", title: "Source" },
      },
    ],
    synthesis: "Synthèse",
    keyLessons: ["Leçon"],
    sources: [],
  };
}

describe("saveDeepAnalysis (vrai code) — passe par le RPC save_generated_analysis", () => {
  it("appelle le RPC save_generated_analysis (jamais un insert direct) avec le bon payload et la réservation", async () => {
    let capturedArgs: { p_analysis: Record<string, unknown>; p_reservation_id: string } | undefined;
    const supabase = {
      rpc: vi.fn(async (fnName: string, args: typeof capturedArgs) => {
        expect(fnName).toBe("save_generated_analysis");
        capturedArgs = args;
        return { data: "analysis-id", error: null };
      }),
      from: vi.fn(() => {
        throw new Error("saveDeepAnalysis ne doit plus jamais appeler .from() directement");
      }),
    };

    const analysisId = await saveDeepAnalysis(supabase as never, makeAnalysis(), "res-1");

    expect(analysisId).toBe("analysis-id");
    expect(supabase.from).not.toHaveBeenCalled();
    expect(capturedArgs?.p_reservation_id).toBe("res-1");
    expect(capturedArgs?.p_analysis).toMatchObject({
      topic: "Sujet",
      title: "Analyse test",
      domain: "Test",
      introduction: "Intro",
      synthesis: "Synthèse",
      keyLessons: ["Leçon"],
    });
  });

  it("propage une erreur générique (jamais le détail brut) quand le RPC échoue", async () => {
    const supabase = {
      rpc: vi.fn(async () => ({
        data: null,
        error: new Error('column "secret" of relation "deep_analyses" does not exist'),
      })),
    };

    await expect(saveDeepAnalysis(supabase as never, makeAnalysis(), "res-1")).rejects.toThrow(
      "Échec de l'enregistrement de l'analyse",
    );
  });
});
