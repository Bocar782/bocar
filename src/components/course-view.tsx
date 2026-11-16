"use client";

import { useState } from "react";
import type { GeneratedCourse, GeneratedModule } from "@/lib/courses/schemas";
import { FREE_PLAN_UNLOCKED_CHAPTERS } from "@/lib/courses/plan";
import { setLessonCompletion } from "@/lib/courses/progress-actions";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { CourseSidebar } from "./course-sidebar";
import { ExerciseBlock } from "./exercise-block";
import { MarkdownContent } from "./markdown-content";
import { QuizView } from "./quiz-view";

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function ChapterCard({
  chapter,
  index,
  totalChapters,
  completed,
  onToggleComplete,
  nextOverride,
}: {
  chapter: GeneratedCourse["chapters"][number];
  index: number;
  totalChapters: number;
  completed: boolean;
  /** Absent si la leçon n'a pas encore d'identifiant persisté (génération fraîche, pas encore sauvegardée). */
  onToggleComplete?: (chapterId: string, completed: boolean) => void;
  /**
   * Remplace la cible par défaut du bouton "Leçon suivante" (chapitre
   * suivant, ou résumé pour la toute dernière leçon). Fourni par
   * `CourseView` uniquement pour la dernière leçon d'un module qui possède
   * un quiz : le bouton doit alors mener à CE quiz avant de passer au
   * module suivant. Absent dans tous les autres cas — comportement
   * inchangé, y compris pour une formation sans aucun quiz de module.
   */
  nextOverride?: { id: string; label: string };
}) {
  const isFirst = index === 0;
  const isLast = index === totalChapters - 1;
  const nextId = nextOverride?.id ?? (isLast ? "resume-section" : `chapitre-${index + 1}`);
  const nextLabel = nextOverride?.label ?? (isLast ? "Passer au résumé" : "Leçon suivante");

  return (
    <article
      id={`chapitre-${index}`}
      data-chapter-index={index}
      className="scroll-mt-6 rounded-2xl border border-border-subtle bg-white/[0.02] p-6 sm:p-8"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-mono text-accent-violet-light">
          Chapitre {index + 1}
        </span>
        {chapter.id && onToggleComplete && (
          <button
            type="button"
            onClick={() => onToggleComplete(chapter.id as string, !completed)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              completed
                ? "border-accent-blue/40 bg-accent-blue/10 text-accent-blue-light"
                : "border-border-subtle bg-white/[0.03] text-foreground-muted hover:bg-white/[0.06] hover:text-foreground"
            }`}
          >
            {completed ? (
              <>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                  <path
                    d="M2.5 6.5l2.5 2.5 4.5-5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Terminée
              </>
            ) : (
              "Marquer comme terminée"
            )}
          </button>
        )}
      </div>
      <h3 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
        {chapter.title}
      </h3>

      <div className="mt-4">
        <MarkdownContent content={chapter.explanation} />
      </div>

      <Card variant="accent-blue" className="mt-2">
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
      </Card>

      <Card variant="accent-violet" className="mt-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-accent-violet-light">
          À retenir
        </span>
        <p className="mt-1.5 text-sm leading-relaxed text-foreground">
          {chapter.keyTakeaway}
        </p>
      </Card>

      {chapter.exercise && <ExerciseBlock exercise={chapter.exercise} />}

      {/* flex-col sur mobile : le bouton "Leçon suivante" passe sous le
          précédent plutôt que de rester collé au bord droit, pour ne jamais
          se retrouver sous le bouton de chat flottant (bottom-right fixe). */}
      <div className="mt-5 flex flex-col items-start gap-3 border-t border-border-subtle pt-4 sm:flex-row sm:items-center sm:justify-between">
        {!isFirst ? (
          <button
            type="button"
            onClick={() => scrollToId(`chapitre-${index - 1}`)}
            className="inline-flex items-center gap-1.5 text-sm text-foreground-muted transition-colors hover:text-foreground"
          >
            ← Leçon précédente
          </button>
        ) : (
          <span className="hidden sm:inline" />
        )}
        <button
          type="button"
          onClick={() => scrollToId(nextId)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-accent-violet-light transition-colors hover:text-accent-blue-light"
        >
          {nextLabel} →
        </button>
      </div>
    </article>
  );
}

/**
 * Quiz propre à un module (Prompt 05.7), affiché juste après la dernière
 * leçon de ce module. Réutilise intégralement `QuizView` (mêmes types de
 * question, même système de tentatives/historique) — seul un titre propre
 * au module lui est passé ; `quizId` (jamais déduit par position, voir
 * `getCourseById`) lui donne son propre historique, totalement indépendant
 * de celui du quiz final et de celui des autres modules.
 */
function ModuleQuizSection({ module }: { module: GeneratedModule }) {
  if (!module.quiz || module.quiz.length === 0) return null;
  return (
    <div id={`module-quiz-${module.position}`} className="scroll-mt-6">
      <span className="text-xs font-mono text-accent-violet-light">
        Fin du module — {module.title}
      </span>
      <QuizView
        quiz={module.quiz}
        quizId={module.quizId ?? null}
        title={`Quiz du module « ${module.title} »`}
        description="pour vérifier ce que tu as retenu de ce module."
      />
    </div>
  );
}

function SummarySection({ course }: { course: GeneratedCourse }) {
  return (
    <section id="resume-section" className="mt-8 scroll-mt-6">
      <Card variant="elevated">
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
      </Card>
    </section>
  );
}

/**
 * Aperçu du contenu verrouillé : un CTA clair et non flouté, suivi d'une
 * prévisualisation floutée (tronquée en hauteur, fondue vers l'arrière-plan)
 * pour montrer qu'il y a bien du contenu derrière sans forcer à le
 * parcourir. `inert` retire toute interactivité (clic, focus clavier) du
 * contenu flouté sans le masquer du rendu visuel.
 */
function LockedPreview({
  remainingChapters,
  hasQuiz,
  children,
}: {
  remainingChapters: number;
  hasQuiz: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-8">
      <Card variant="elevated">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-violet/15 text-lg">
            🔒
          </span>
          <p className="text-base font-semibold text-foreground">
            {remainingChapters} chapitre{remainingChapters > 1 ? "s" : ""}
            {hasQuiz ? " + le quiz final" : ""} t&apos;attendent
          </p>
          <p className="max-w-sm text-sm text-foreground-muted">
            Tu as terminé l&apos;aperçu gratuit de cette formation. Débloque
            la version complète pour continuer ta lecture et valider tes
            acquis.
          </p>
          <Button href="/pricing" className="mt-2">
            Débloquer la formation complète
          </Button>
        </div>
      </Card>

      <div className="relative mt-6 max-h-[560px] overflow-hidden rounded-[28px]">
        <div
          inert
          aria-hidden
          className="select-none space-y-6 blur-sm"
        >
          {children}
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-background to-transparent"
        />
      </div>
    </div>
  );
}

export function CourseView({
  course,
  courseId = null,
  locked = false,
}: {
  course: GeneratedCourse;
  courseId?: string | null;
  /** Plan gratuit : flouter tout ce qui suit les premiers chapitres. */
  locked?: boolean;
}) {
  // État local optimiste : reflète immédiatement un clic sur "Marquer comme
  // terminée" sans attendre un rechargement de la page. Initialisé depuis
  // `chapter.completed` (lui-même rempli par `getCourseById` depuis la
  // table `lesson_progress` — absent/false juste après une génération
  // fraîche, avant toute sauvegarde).
  const [completedIds, setCompletedIds] = useState<Set<string>>(
    () => new Set(course.chapters.filter((c) => c.completed && c.id).map((c) => c.id as string)),
  );

  function handleToggleComplete(chapterId: string, completed: boolean) {
    setCompletedIds((prev) => {
      const next = new Set(prev);
      if (completed) next.add(chapterId);
      else next.delete(chapterId);
      return next;
    });
    // Appel "fire-and-forget", cohérent avec le reste du tracking de
    // progression de l'app (updateChapterProgress, recordQuizScore) : un
    // échec ne doit jamais bloquer la lecture, l'état local reste la
    // source de vérité affichée.
    if (courseId) setLessonCompletion(chapterId, completed);
  }

  const isChapterCompleted = (chapter: GeneratedCourse["chapters"][number]) =>
    Boolean(chapter.id && completedIds.has(chapter.id));

  const totalChapters = course.chapters.length;
  const completedCount = course.chapters.filter(isChapterCompleted).length;

  // Une formation fraîchement générée (pas encore relue depuis la base)
  // n'a pas encore de `modules` : on retombe sur un module implicite
  // unique, purement pour l'affichage du sommaire (rien n'est persisté).
  const modules: GeneratedModule[] =
    course.modules && course.modules.length > 0
      ? course.modules
      : [{ position: 0, title: "Contenu de la formation", chapters: course.chapters }];

  const unlockedCount = locked
    ? Math.min(FREE_PLAN_UNLOCKED_CHAPTERS, course.chapters.length)
    : course.chapters.length;
  const maxChapterIndex = locked ? unlockedCount - 1 : undefined;

  // Séquence de blocs à afficher, module par module : les leçons de ce
  // module suivies (si ce module a un quiz) de son propre bloc quiz, pour
  // que chaque quiz de module apparaisse juste après la dernière leçon de
  // CE module — jamais à un autre endroit. `chapter.position` (position
  // globale, inchangée) reste l'identifiant utilisé pour la numérotation,
  // le scrollspy et le verrouillage : regrouper par module ne change rien
  // à ces mécanismes existants.
  type RenderBlock =
    | { kind: "chapter"; chapter: GeneratedCourse["chapters"][number] }
    | { kind: "moduleQuiz"; module: GeneratedModule };

  const blocks: RenderBlock[] = modules.flatMap((module) => [
    ...module.chapters.map((chapter): RenderBlock => ({ kind: "chapter", chapter })),
    ...(module.quiz && module.quiz.length > 0
      ? [{ kind: "moduleQuiz" as const, module }]
      : []),
  ]);

  // Même seuil de verrouillage qu'aujourd'hui (plan gratuit = les N
  // premiers chapitres), appliqué à cette séquence de blocs plutôt qu'à la
  // liste plate : dès le premier chapitre verrouillé rencontré, ce
  // chapitre ET tout ce qui suit (y compris le quiz du module en cours)
  // basculent dans la section floutée — un quiz de module n'est donc
  // jamais visible avant que toutes ses leçons ne le soient.
  let crossedLockBoundary = false;
  const unlockedBlocks: RenderBlock[] = [];
  const restBlocks: RenderBlock[] = [];
  for (const block of blocks) {
    if (block.kind === "chapter" && block.chapter.position >= unlockedCount) {
      crossedLockBoundary = true;
    }
    (crossedLockBoundary ? restBlocks : unlockedBlocks).push(block);
  }

  const lockedChapterCount = restBlocks.filter((b) => b.kind === "chapter").length;
  const isLockedForThisCourse = locked && lockedChapterCount + course.quiz.length > 0;

  // Pour la DERNIÈRE leçon de chaque module qui a un quiz : le bouton
  // "Leçon suivante" de cette leçon doit mener à ce quiz plutôt qu'au
  // module suivant (ou au résumé, si c'est aussi la toute dernière leçon
  // de la formation). Un module sans quiz n'a aucune entrée ici, donc son
  // comportement reste exactement celui d'aujourd'hui.
  const nextOverrideByChapterPosition = new Map<number, { id: string; label: string }>();
  for (const courseModule of modules) {
    if (!courseModule.quiz || courseModule.quiz.length === 0) continue;
    const lastChapter = courseModule.chapters[courseModule.chapters.length - 1];
    if (!lastChapter) continue;
    nextOverrideByChapterPosition.set(lastChapter.position, {
      id: `module-quiz-${courseModule.position}`,
      label: "Faire le quiz du module",
    });
  }

  function renderBlock(block: RenderBlock) {
    if (block.kind === "chapter") {
      return (
        <ChapterCard
          key={`chapitre-${block.chapter.position}`}
          chapter={block.chapter}
          index={block.chapter.position}
          totalChapters={totalChapters}
          completed={isChapterCompleted(block.chapter)}
          onToggleComplete={handleToggleComplete}
          nextOverride={nextOverrideByChapterPosition.get(block.chapter.position)}
        />
      );
    }
    return <ModuleQuizSection key={`module-quiz-${block.module.position}`} module={block.module} />;
  }

  const rest = (
    <>
      {restBlocks.length > 0 && (
        <div className="space-y-6">{restBlocks.map(renderBlock)}</div>
      )}
      <SummarySection course={course} />
      <QuizView quiz={course.quiz} quizId={course.quizId ?? null} />
    </>
  );

  return (
    <div className="w-full max-w-6xl lg:flex lg:items-start lg:gap-8">
      <CourseSidebar
        modules={modules}
        totalChapters={totalChapters}
        completedCount={completedCount}
        unlockedCount={unlockedCount}
        hasQuiz={course.quiz.length > 0}
        maxChapterIndex={maxChapterIndex}
      />

      <div className="mx-auto w-full max-w-3xl lg:mx-0 lg:min-w-0 lg:flex-1">
        <div id="formation-top" className="flex flex-wrap items-center gap-2 text-xs text-foreground-muted">
          <span className="rounded-full border border-border-subtle bg-white/[0.03] px-3 py-1">
            {course.domain}
          </span>
          <span className="rounded-full border border-border-subtle bg-white/[0.03] px-3 py-1">
            Niveau {course.level}
          </span>
          {isLockedForThisCourse && (
            <span className="rounded-full border border-border-subtle bg-white/[0.03] px-3 py-1">
              Formation gratuite
            </span>
          )}
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

        <div className="mt-8 space-y-6">{unlockedBlocks.map(renderBlock)}</div>

        {isLockedForThisCourse ? (
          <LockedPreview
            remainingChapters={lockedChapterCount}
            hasQuiz={course.quiz.length > 0}
          >
            {rest}
          </LockedPreview>
        ) : (
          rest
        )}
      </div>
    </div>
  );
}
