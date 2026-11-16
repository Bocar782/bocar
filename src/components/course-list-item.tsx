import {
  computeCourseProgress,
  STATUS_LABELS,
  type CourseStatus,
} from "@/lib/courses/progress";
import { Badge, type BadgeTone } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

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

const STATUS_BADGE_TONE: Record<CourseStatus, BadgeTone> = {
  not_started: "neutral",
  in_progress: "info",
  completed: "success",
};

export function CourseListItem({ course }: { course: CourseListItemData }) {
  const { status, percent } = computeCourseProgress(course);
  const targetChapter = course.currentChapterIndex ?? 0;
  const hasStarted = status !== "not_started";

  return (
    <li>
      <Card padding="sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{course.title}</p>
            <p className="mt-0.5 text-xs text-foreground-muted">
              {course.domain} · niveau {course.level}
            </p>
          </div>
          <Badge tone={STATUS_BADGE_TONE[status]}>{STATUS_LABELS[status]}</Badge>
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

          <Button
            href={`/dashboard/formations/${course.id}#chapitre-${targetChapter}`}
            variant="secondary"
            size="sm"
          >
            {hasStarted ? "Continuer" : "Commencer"}
          </Button>
        </div>
      </Card>
    </li>
  );
}
