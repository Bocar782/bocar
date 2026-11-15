import type { GeneratedCourse } from "@/lib/courses/schemas";
import { MarkdownContent } from "./markdown-content";
import { QuizView } from "./quiz-view";

function ChapterCard({
  chapter,
  index,
}: {
  chapter: GeneratedCourse["chapters"][number];
  index: number;
}) {
  return (
    <article
      id={`chapitre-${index}`}
      data-chapter-index={index}
      className="scroll-mt-6 rounded-2xl border border-border-subtle bg-white/[0.02] p-6 sm:p-8"
    >
      <span className="text-xs font-mono text-accent-violet-light">
        Chapitre {index + 1}
      </span>
      <h3 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
        {chapter.title}
      </h3>

      <div className="mt-4">
        <MarkdownContent content={chapter.explanation} />
      </div>

      <div className="mt-2 rounded-xl border border-l-4 border-border-subtle border-l-accent-blue/50 bg-white/[0.03] p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium uppercase tracking-wide text-accent-blue-light">
            {chapter.example.isReal ? "Exemple concret" : "Exemple illustratif (fictif)"}
          </span>
          {chapter.example.isReal && chapter.example.sourceUrl && (
            <a
              href={chapter.example.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-xs font-medium text-accent-violet-light underline underline-offset-2 hover:text-accent-blue-light"
            >
              Voir la source →
            </a>
          )}
        </div>
        <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
          {chapter.example.description}
        </p>
      </div>

      <div className="mt-4 rounded-xl border border-accent-violet/25 bg-accent-violet/[0.08] p-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-accent-violet-light">
          À retenir
        </span>
        <p className="mt-1.5 text-sm leading-relaxed text-foreground">
          {chapter.keyTakeaway}
        </p>
      </div>
    </article>
  );
}

export function CourseView({
  course,
  courseId = null,
}: {
  course: GeneratedCourse;
  courseId?: string | null;
}) {
  return (
    <div className="w-full max-w-3xl">
      <div className="flex flex-wrap items-center gap-2 text-xs text-foreground-muted">
        <span className="rounded-full border border-border-subtle bg-white/[0.03] px-3 py-1">
          {course.domain}
        </span>
        <span className="rounded-full border border-border-subtle bg-white/[0.03] px-3 py-1">
          Niveau {course.level}
        </span>
      </div>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        {course.title}
      </h1>

      <div className="mt-6">
        <MarkdownContent content={course.introduction} />
      </div>

      <section className="mt-2 rounded-2xl border border-border-subtle bg-white/[0.02] p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground-muted">
          Objectifs
        </h2>
        <ul className="mt-3 space-y-2">
          {course.objectives.map((objective, i) => (
            <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-foreground">
              <span className="mt-0.5 text-accent-violet-light">✓</span>
              <span>{objective}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-8 space-y-6">
        {course.chapters.map((chapter, i) => (
          <ChapterCard key={i} chapter={chapter} index={i} />
        ))}
      </div>

      <section className="relative mt-8 rounded-[28px] p-px">
        <div
          aria-hidden
          className="absolute inset-0 rounded-[28px] bg-gradient-to-br from-accent-blue/40 via-white/10 to-accent-violet/40"
        />
        <div className="relative rounded-[28px] bg-background-elevated/90 p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-foreground">Résumé final</h2>
          <div className="mt-3">
            <MarkdownContent content={course.summary} />
          </div>
          <ul className="mt-2 space-y-2">
            {course.keyPoints.map((point, i) => (
              <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-foreground">
                <span className="mt-0.5 text-accent-blue-light">★</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <QuizView quiz={course.quiz} courseId={courseId} />
    </div>
  );
}
