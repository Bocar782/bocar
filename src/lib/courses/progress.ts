export type CourseStatus = "not_started" | "in_progress" | "completed";

export function computeCourseProgress(course: {
  chapterCount: number;
  currentChapterIndex: number | null;
}): { status: CourseStatus; percent: number } {
  if (course.chapterCount === 0 || course.currentChapterIndex === null) {
    return { status: "not_started", percent: 0 };
  }

  const percent = Math.min(
    100,
    Math.round(((course.currentChapterIndex + 1) / course.chapterCount) * 100),
  );
  const status: CourseStatus =
    course.currentChapterIndex >= course.chapterCount - 1 ? "completed" : "in_progress";

  return { status, percent };
}

export const STATUS_LABELS: Record<CourseStatus, string> = {
  not_started: "Pas commencée",
  in_progress: "En cours",
  completed: "Terminée",
};
