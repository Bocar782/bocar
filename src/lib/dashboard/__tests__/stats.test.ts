// Vrai test : importe et exécute le VRAI src/lib/dashboard/stats.ts — seul
// le client Supabase (frontière externe) est mocké, même style que
// src/lib/courses/__tests__/persist.test.ts (fakeTable chaînable + thenable).
import { describe, expect, it } from "vitest";
import { getDashboardStats } from "@/lib/dashboard/stats";

function fakeTable(rows: unknown[]) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = chain;
  builder.eq = chain;
  builder.in = chain;
  builder.order = chain;
  builder.limit = chain;
  builder.not = chain;
  builder.then = (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
    Promise.resolve({ data: rows, error: null }).then(resolve);
  return builder;
}

function iso(daysAgo: number, hour = 10): string {
  const d = new Date();
  d.setUTCHours(hour, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString();
}

function makeSupabase(tables: Record<string, unknown[]>) {
  return { from: (table: string) => fakeTable(tables[table] ?? []) };
}

describe("getDashboardStats (vrai code)", () => {
  it("renvoie des stats à zéro sans aucune formation, sans planter", async () => {
    const supabase = makeSupabase({});
    const stats = await getDashboardStats(supabase as never, "user-1", []);

    expect(stats.totalCourses).toBe(0);
    expect(stats.completedCourses).toBe(0);
    expect(stats.inProgressCourses).toBe(0);
    expect(stats.avgProgressPercent).toBe(0);
    expect(stats.quizzesCompleted).toBe(0);
    expect(stats.avgQuizScorePercent).toBeNull();
    expect(stats.activeDayStreak).toBe(0);
    expect(stats.activityByDay).toHaveLength(14);
    expect(stats.recentActivity).toHaveLength(0);
  });

  it("calcule correctement le statut/la progression moyenne sur un mélange de formations", async () => {
    const courses = [
      { id: "c1", title: "Terminée", createdAt: iso(10), chapterCount: 4, currentChapterIndex: 3 },
      { id: "c2", title: "En cours", createdAt: iso(5), chapterCount: 4, currentChapterIndex: 1 },
      { id: "c3", title: "Pas commencée", createdAt: iso(1), chapterCount: 4, currentChapterIndex: null },
    ];
    const supabase = makeSupabase({
      course_chapters: [],
      quizzes: [],
      quiz_attempts: [],
      lesson_progress: [],
    });

    const stats = await getDashboardStats(supabase as never, "user-1", courses);

    expect(stats.totalCourses).toBe(3);
    expect(stats.completedCourses).toBe(1);
    expect(stats.inProgressCourses).toBe(1);
    // percent(c1)=100, percent(c2)=50, percent(c3)=0 -> moyenne = 50
    expect(stats.avgProgressPercent).toBe(50);
  });

  it("fusionne et trie par date décroissante les événements création/leçon/quiz, et calcule le score moyen", async () => {
    const courses = [
      { id: "c1", title: "Finance pour entrepreneurs", createdAt: iso(5), chapterCount: 3, currentChapterIndex: 1 },
    ];
    const supabase = makeSupabase({
      course_chapters: [{ id: "chap-1", title: "Chapitre 1", course_id: "c1" }],
      quizzes: [{ id: "quiz-1", course_id: "c1", kind: "final" }],
      lesson_progress: [{ chapter_id: "chap-1", completed_at: iso(2) }],
      quiz_attempts: [
        { quiz_id: "quiz-1", score: 8, total: 10, completed_at: iso(1) },
        { quiz_id: "quiz-1", score: 6, total: 10, completed_at: iso(3) },
      ],
    });

    const stats = await getDashboardStats(supabase as never, "user-1", courses);

    expect(stats.quizzesCompleted).toBe(2);
    expect(stats.avgQuizScorePercent).toBe(70); // moyenne de 80% et 60%

    // Ordre décroissant attendu : quiz(il y a 1j) > leçon(il y a 2j) > quiz(il y a 3j) > création(il y a 5j)
    expect(stats.recentActivity.map((e) => e.type)).toEqual([
      "quiz_completed",
      "lesson_completed",
      "quiz_completed",
      "course_created",
    ]);
    const firstEvent = stats.recentActivity[0];
    expect(firstEvent.type).toBe("quiz_completed");
    if (firstEvent.type === "quiz_completed") {
      expect(firstEvent.score).toBe(8);
      expect(firstEvent.courseTitle).toBe("Finance pour entrepreneurs");
    }
  });

  it("calcule une série de jours actifs consécutifs incluant aujourd'hui", async () => {
    const courses = [
      { id: "c1", title: "Formation", createdAt: iso(10), chapterCount: 5, currentChapterIndex: 0 },
    ];
    const supabase = makeSupabase({
      course_chapters: [
        { id: "chap-0", title: "Chap 0", course_id: "c1" },
        { id: "chap-1", title: "Chap 1", course_id: "c1" },
        { id: "chap-2", title: "Chap 2", course_id: "c1" },
      ],
      quizzes: [],
      quiz_attempts: [],
      lesson_progress: [
        { chapter_id: "chap-0", completed_at: iso(0) },
        { chapter_id: "chap-1", completed_at: iso(1) },
        { chapter_id: "chap-2", completed_at: iso(2) },
      ],
    });

    const stats = await getDashboardStats(supabase as never, "user-1", courses);

    expect(stats.activeDayStreak).toBe(3);
    expect(stats.activityByDay).toHaveLength(14);
    expect(stats.activityByDay.at(-1)?.count).toBeGreaterThanOrEqual(1);
  });

  it("calcule coursesCreatedThisWeek et une série cumulée cohérente (Prompt 06.2)", async () => {
    const courses = [
      { id: "c1", title: "Ancienne", createdAt: iso(20), chapterCount: 2, currentChapterIndex: 0 },
      { id: "c2", title: "Récente A", createdAt: iso(3), chapterCount: 2, currentChapterIndex: 0 },
      { id: "c3", title: "Récente B", createdAt: iso(1), chapterCount: 2, currentChapterIndex: 0 },
    ];
    const supabase = makeSupabase({
      course_chapters: [],
      quizzes: [],
      quiz_attempts: [],
      lesson_progress: [],
    });

    const stats = await getDashboardStats(supabase as never, "user-1", courses);

    expect(stats.coursesCreatedThisWeek).toBe(2);
    expect(stats.courseCountSeries).toHaveLength(14);
    // Jamais décroissant (nombre cumulé), et se termine au total réel.
    for (let i = 1; i < stats.courseCountSeries.length; i++) {
      expect(stats.courseCountSeries[i]).toBeGreaterThanOrEqual(stats.courseCountSeries[i - 1]);
    }
    expect(stats.courseCountSeries.at(-1)).toBe(3);
    // La formation vieille de 20 jours est déjà comptée au tout début de la fenêtre de 14 jours.
    expect(stats.courseCountSeries[0]).toBe(1);
  });

  it("ne renvoie une tendance de score que si les deux fenêtres de 7 jours ont des tentatives notées (Prompt 06.2)", async () => {
    const courses = [
      { id: "c1", title: "Formation", createdAt: iso(20), chapterCount: 2, currentChapterIndex: 1 },
    ];

    const noTrendSupabase = makeSupabase({
      course_chapters: [{ id: "chap-1", title: "Chap 1", course_id: "c1" }],
      quizzes: [{ id: "quiz-1", course_id: "c1", kind: "final" }],
      lesson_progress: [],
      // Toutes les tentatives dans les 7 derniers jours : aucune dans la fenêtre précédente.
      quiz_attempts: [{ quiz_id: "quiz-1", score: 9, total: 10, completed_at: iso(1) }],
    });
    const noTrendStats = await getDashboardStats(noTrendSupabase as never, "user-1", courses);
    expect(noTrendStats.quizScoreTrend).toBeNull();
    expect(noTrendStats.quizScoreSeries).toEqual([90]);

    const withTrendSupabase = makeSupabase({
      course_chapters: [{ id: "chap-1", title: "Chap 1", course_id: "c1" }],
      quizzes: [{ id: "quiz-1", course_id: "c1", kind: "final" }],
      lesson_progress: [],
      quiz_attempts: [
        { quiz_id: "quiz-1", score: 9, total: 10, completed_at: iso(1) }, // 90%, semaine en cours
        { quiz_id: "quiz-1", score: 6, total: 10, completed_at: iso(10) }, // 60%, semaine précédente
      ],
    });
    const withTrendStats = await getDashboardStats(withTrendSupabase as never, "user-1", courses);
    expect(withTrendStats.quizScoreTrend).toEqual({
      last7DaysAvgPercent: 90,
      previous7DaysAvgPercent: 60,
      deltaPoints: 30,
    });
  });
});
