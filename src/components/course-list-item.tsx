import Link from "next/link";
import {
  computeCourseProgress,
  STATUS_LABELS,
  type CourseStatus,
} from "@/lib/courses/progress";

type CourseListItemData = {
  id: string;
  title: string;
  domain: string;
  level: string;
  chapterCount: number;
  currentChapterIndex: number | null;
  quizScore: number | null;
  quizTotal: number | null;
};

const STATUS_BADGE_CLASSES: Record<CourseStatus, string> = {
  not_started: "bg-white/[0.06] text-foreground-muted",
  in_progress: "bg-accent-blue/15 text-accent-blue-light",
  completed: "bg-emerald-500/15 text-emerald-300",
};

export function CourseListItem({ course }: { course: CourseListItemData }) {
  const { status, percent } = computeCourseProgress(course);
  const targetChapter = course.currentChapterIndex ?? 0;
  const hasStarted = status !== "not_started";

  return (
    <li className="rounded-2xl border border-border-subtle bg-white/[0.02] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{course.title}</p>
          <p className="mt-0.5 text-xs text-foreground-muted">
            {course.domain} · niveau {course.level}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE_CLASSES[status]}`}
        >
          {STATUS_LABELS[status]}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent-blue to-accent-violet"
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="shrink-0 text-xs text-foreground-muted">{percent}%</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground-muted">
          <span>
            Chapitre {Math.min(targetChapter, Math.max(course.chapterCount - 1, 0)) + 1}/
            {course.chapterCount}
          </span>
          {course.quizScore !== null && course.quizTotal !== null && (
            <span>
              Quiz : {course.quizScore}/{course.quizTotal}
            </span>
          )}
        </div>

        <Link
          href={`/dashboard/formations/${course.id}#chapitre-${targetChapter}`}
          className="rounded-full border border-border-subtle bg-white/5 px-4 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-white/10"
        >
          {hasStarted ? "Continuer" : "Commencer"}
        </Link>
      </div>
    </li>
  );
}
