import {
  computeCourseProgress,
  STATUS_LABELS,
  type CourseStatus,
} from "@/lib/courses/progress";
import { CourseCover } from "./dashboard/course-cover";
import { IconGraduationCap } from "./marketing/icons";
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
    <li className="h-full">
      <Card padding="sm" className="lift flex h-full flex-col">
        <div className="flex items-start justify-between gap-2">
          <CourseCover
            seed={course.id}
            icon={<IconGraduationCap width={18} height={18} />}
            className="h-11 w-11"
          />
          <Badge tone={STATUS_BADGE_TONE[status]}>{STATUS_LABELS[status]}</Badge>
        </div>

        <p className="mt-3 line-clamp-2 font-medium leading-snug text-foreground">
          {course.title}
        </p>
        <p className="mt-1 text-xs text-foreground-muted">
          {course.domain} · niveau {course.level}
        </p>

        <div className="mt-4 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-overlay/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-from via-brand-via to-brand-to"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="shrink-0 text-xs text-foreground-muted">{percent}%</span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground-muted">
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
          fullWidth
          className="mt-4"
        >
          {hasStarted ? "Continuer" : "Commencer"}
        </Button>
      </Card>
    </li>
  );
}
