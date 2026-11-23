import type { SupabaseClient } from "@supabase/supabase-js";
import { computeCourseProgress } from "@/lib/courses/progress";

// Prompt 06.1 : stats et activité RÉELLES du tableau de bord — aucune
// valeur affichée n'est inventée ou estimée, tout vient de lignes
// effectivement présentes en base (courses, lesson_progress, quiz_attempts).
// Suit le même style de requêtes que getCourseById (plusieurs allers-
// retours simples + jointure en mémoire) plutôt qu'un embedding PostgREST
// multi-niveaux non testé localement.

export type ActivityEvent =
  | { type: "course_created"; at: string; courseId: string; courseTitle: string }
  | {
      type: "lesson_completed";
      at: string;
      courseId: string;
      courseTitle: string;
      chapterTitle: string;
    }
  | {
      type: "quiz_completed";
      at: string;
      courseId: string;
      courseTitle: string;
      kind: "final" | "module";
      score: number;
      total: number;
    };

export type DashboardStats = {
  totalCourses: number;
  completedCourses: number;
  inProgressCourses: number;
  avgProgressPercent: number;
  quizzesCompleted: number;
  avgQuizScorePercent: number | null;
  activeDayStreak: number;
  activityByDay: { date: string; count: number }[];
  recentActivity: ActivityEvent[];
};

const ACTIVITY_WINDOW_DAYS = 14;
const RECENT_ACTIVITY_LIMIT = 8;

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Calcule les statistiques réelles d'apprentissage d'un utilisateur à
 * partir des formations déjà chargées (évite une requête `courses`
 * redondante : le tableau de bord a déjà `listCourses()`).
 */
export async function getDashboardStats(
  supabase: SupabaseClient,
  userId: string,
  courses: {
    id: string;
    title: string;
    createdAt: string;
    chapterCount: number;
    currentChapterIndex: number | null;
  }[],
): Promise<DashboardStats> {
  const courseIds = courses.map((c) => c.id);
  const courseTitleById = new Map(courses.map((c) => [c.id, c.title]));

  const progresses = courses.map((c) => computeCourseProgress(c));
  const totalCourses = courses.length;
  const completedCourses = progresses.filter((p) => p.status === "completed").length;
  const inProgressCourses = progresses.filter((p) => p.status === "in_progress").length;
  const avgProgressPercent =
    totalCourses === 0
      ? 0
      : Math.round(progresses.reduce((sum, p) => sum + p.percent, 0) / totalCourses);

  const [chaptersResult, quizzesResult, attemptsResult] = await Promise.all([
    courseIds.length > 0
      ? supabase
          .from("course_chapters")
          .select("id, title, course_id")
          .in("course_id", courseIds)
      : Promise.resolve({ data: [], error: null }),
    courseIds.length > 0
      ? supabase.from("quizzes").select("id, course_id, kind").in("course_id", courseIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("quiz_attempts")
      .select("quiz_id, score, total, completed_at")
      .eq("user_id", userId)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(200),
  ]);

  if (chaptersResult.error) {
    throw new Error(`Échec du chargement des chapitres : ${chaptersResult.error.message}`);
  }
  if (quizzesResult.error) {
    throw new Error(`Échec du chargement des quiz : ${quizzesResult.error.message}`);
  }
  if (attemptsResult.error) {
    throw new Error(`Échec du chargement des tentatives de quiz : ${attemptsResult.error.message}`);
  }

  const chapters = (chaptersResult.data ?? []) as { id: string; title: string; course_id: string }[];
  const chapterIds = chapters.map((c) => c.id);
  const chapterById = new Map(chapters.map((c) => [c.id, c]));

  const quizzes = (quizzesResult.data ?? []) as {
    id: string;
    course_id: string;
    kind: "final" | "module";
  }[];
  const quizById = new Map(quizzes.map((q) => [q.id, q]));

  const { data: progressRows, error: progressError } =
    chapterIds.length > 0
      ? await supabase
          .from("lesson_progress")
          .select("chapter_id, completed_at")
          .in("chapter_id", chapterIds)
          .order("completed_at", { ascending: false })
          .limit(200)
      : { data: [] as { chapter_id: string; completed_at: string }[], error: null };

  if (progressError) {
    throw new Error(`Échec du chargement de la progression : ${progressError.message}`);
  }

  const attempts = (attemptsResult.data ?? []) as {
    quiz_id: string;
    score: number | null;
    total: number | null;
    completed_at: string;
  }[];

  const quizzesCompleted = attempts.length;
  const scoredAttempts = attempts.filter(
    (a) => a.score !== null && a.total !== null && a.total > 0,
  );
  const avgQuizScorePercent =
    scoredAttempts.length === 0
      ? null
      : Math.round(
          (scoredAttempts.reduce((sum, a) => sum + a.score! / a.total!, 0) /
            scoredAttempts.length) *
            100,
        );

  const events: ActivityEvent[] = [];

  for (const course of courses) {
    events.push({
      type: "course_created",
      at: course.createdAt,
      courseId: course.id,
      courseTitle: course.title,
    });
  }

  for (const row of progressRows ?? []) {
    const chapter = chapterById.get(row.chapter_id as string);
    if (!chapter) continue;
    const courseTitle = courseTitleById.get(chapter.course_id) ?? "Formation";
    events.push({
      type: "lesson_completed",
      at: row.completed_at as string,
      courseId: chapter.course_id,
      courseTitle,
      chapterTitle: chapter.title,
    });
  }

  for (const attempt of attempts) {
    const quiz = quizById.get(attempt.quiz_id);
    if (!quiz || attempt.score === null || attempt.total === null) continue;
    const courseTitle = courseTitleById.get(quiz.course_id) ?? "Formation";
    events.push({
      type: "quiz_completed",
      at: attempt.completed_at,
      courseId: quiz.course_id,
      courseTitle,
      kind: quiz.kind,
      score: attempt.score,
      total: attempt.total,
    });
  }

  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const today = new Date();
  const activityByDay: { date: string; count: number }[] = [];
  const countByDay = new Map<string, number>();
  for (const event of events) {
    const key = dayKey(event.at);
    countByDay.set(key, (countByDay.get(key) ?? 0) + 1);
  }
  for (let i = ACTIVITY_WINDOW_DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    activityByDay.push({ date: key, count: countByDay.get(key) ?? 0 });
  }

  // Série de jours actifs consécutifs (aujourd'hui ou hier inclus) — un
  // utilisateur qui n'a rien fait aujourd'hui mais était actif hier garde sa
  // série affichée jusqu'à la fin de la journée en cours.
  let activeDayStreak = 0;
  const todayKey = today.toISOString().slice(0, 10);
  const hasToday = countByDay.has(todayKey);
  const cursor = new Date(today);
  if (!hasToday) cursor.setDate(cursor.getDate() - 1);
  for (;;) {
    const key = cursor.toISOString().slice(0, 10);
    if (!countByDay.has(key)) break;
    activeDayStreak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return {
    totalCourses,
    completedCourses,
    inProgressCourses,
    avgProgressPercent,
    quizzesCompleted,
    avgQuizScorePercent,
    activeDayStreak,
    activityByDay,
    recentActivity: events.slice(0, RECENT_ACTIVITY_LIMIT),
  };
}
