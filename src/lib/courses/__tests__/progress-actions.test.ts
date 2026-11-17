// Vrais tests (Prompt 05.17.1, correction de la faille critique de
// l'audit 05.17) : importent et exécutent les VRAIES fonctions de
// src/lib/courses/progress-actions.ts — seul le client Supabase
// (frontière externe) est mocké. `updateChapterProgress` et
// `recordQuizScore` passent désormais par les RPC `update_chapter_progress`
// et `record_quiz_score` (voir
// 0020_restrict_content_tables_to_owner_select.sql) plutôt que par un
// update direct sur `courses`, qui n'a plus qu'une policy RLS de lecture.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRpc = vi.fn(async () => ({ data: true, error: null }));
const mockFrom = vi.fn(() => {
  throw new Error("ne doit plus jamais appeler .from(\"courses\") directement");
});
const mockGetUser = vi.fn(async () => ({ data: { user: { id: "user-1" } } }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    rpc: mockRpc,
    from: mockFrom,
    auth: { getUser: mockGetUser },
  }),
}));

beforeEach(() => {
  mockRpc.mockClear();
  mockFrom.mockClear();
});

describe("updateChapterProgress (vrai code)", () => {
  it("appelle le RPC update_chapter_progress avec le bon courseId/chapterIndex, jamais .from(\"courses\")", async () => {
    const { updateChapterProgress } = await import("@/lib/courses/progress-actions");

    await updateChapterProgress("course-1", 3);

    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRpc).toHaveBeenCalledWith("update_chapter_progress", {
      p_course_id: "course-1",
      p_chapter_index: 3,
    });
  });

  it("échoue silencieusement si le RPC lève une exception (tracking fire-and-forget)", async () => {
    mockRpc.mockRejectedValueOnce(new Error("panne simulée"));
    const { updateChapterProgress } = await import("@/lib/courses/progress-actions");

    await expect(updateChapterProgress("course-1", 3)).resolves.toBeUndefined();
  });
});

describe("recordQuizScore (vrai code)", () => {
  it("appelle le RPC record_quiz_score avec le bon courseId/score/total, jamais .from(\"courses\")", async () => {
    const { recordQuizScore } = await import("@/lib/courses/progress-actions");

    await recordQuizScore("course-1", 8, 10);

    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRpc).toHaveBeenCalledWith("record_quiz_score", {
      p_course_id: "course-1",
      p_score: 8,
      p_total: 10,
    });
  });

  it("échoue silencieusement si le RPC lève une exception (tracking fire-and-forget)", async () => {
    mockRpc.mockRejectedValueOnce(new Error("panne simulée"));
    const { recordQuizScore } = await import("@/lib/courses/progress-actions");

    await expect(recordQuizScore("course-1", 8, 10)).resolves.toBeUndefined();
  });
});
