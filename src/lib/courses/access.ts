import type { GeneratedChapter, GeneratedCourse, GeneratedModule } from "./schemas";
import { FREE_PLAN_UNLOCKED_CHAPTERS } from "./plan";

// Prompt 05.17.2 (correction des failles E1/E2/E3 de l'audit 05.17) :
// reproduit EXACTEMENT l'algorithme de verrouillage déjà utilisé par
// `course-view.tsx` (séquence module par module : chapitres puis quiz du
// module — une fois le premier chapitre verrouillé rencontré, lui et tout
// ce qui suit, y compris le quiz de SON module, devient verrouillé), pour
// qu'un seul et même calcul serve à la fois à décider ce qui est redacté
// côté serveur (cette fonction) et à l'affichage côté client
// (course-view.tsx continue d'opérer sur les mêmes `position`/longueurs,
// jamais sur du contenu sensible, donc sans besoin d'être réécrit).
export type CourseAccess = {
  unlockedCount: number;
  lockedChapterPositions: Set<number>;
  lockedModulePositions: Set<number>;
  /** Le quiz final (et le résumé qui l'accompagne) est-il verrouillé ? */
  finalLocked: boolean;
};

function normalizedModules(
  course: Pick<GeneratedCourse, "chapters" | "modules">,
): GeneratedModule[] {
  return course.modules && course.modules.length > 0
    ? course.modules
    : [{ position: 0, title: "", chapters: course.chapters }];
}

export function computeCourseAccess(
  course: Pick<GeneratedCourse, "chapters" | "modules" | "quiz">,
  isFreePlan: boolean,
): CourseAccess {
  const unlockedCount = isFreePlan
    ? Math.min(FREE_PLAN_UNLOCKED_CHAPTERS, course.chapters.length)
    : course.chapters.length;

  const lockedChapterPositions = new Set<number>();
  const lockedModulePositions = new Set<number>();
  let crossedLockBoundary = false;

  for (const courseModule of normalizedModules(course)) {
    for (const chapter of courseModule.chapters) {
      if (chapter.position >= unlockedCount) {
        crossedLockBoundary = true;
      }
      if (crossedLockBoundary) {
        lockedChapterPositions.add(chapter.position);
      }
    }
    if (courseModule.quiz && courseModule.quiz.length > 0 && crossedLockBoundary) {
      lockedModulePositions.add(courseModule.position);
    }
  }

  // Même règle que `isLockedForThisCourse` dans course-view.tsx : le plan
  // gratuit n'a jamais accès au quiz final (ni au résumé qui l'accompagne),
  // dès qu'il existe au moins un chapitre verrouillé OU un quiz final —
  // jamais transmis par le client, jamais paramétrable.
  const finalLocked = isFreePlan && (lockedChapterPositions.size > 0 || course.quiz.length > 0);

  return { unlockedCount, lockedChapterPositions, lockedModulePositions, finalLocked };
}

function redactChapter(chapter: GeneratedChapter): GeneratedChapter {
  return {
    ...chapter,
    explanation: "",
    keyTakeaway: "",
    example: { isReal: false, description: "", sourceUrl: null, sourceTitle: null },
    exercise: null,
  };
}

/**
 * Supprime du contenu renvoyé au navigateur tout ce qui appartient à un
 * chapitre ou à un quiz verrouillé pour le plan gratuit : explication,
 * exemple, exercice, et questions/réponses de quiz (y compris
 * `correctChoiceIndex(es)` et les explications de correction). Les
 * métadonnées structurelles nécessaires à l'affichage (id, position, titre,
 * `completed`) restent présentes — elles ne révèlent aucun contenu
 * pédagogique et sont déjà visibles dans le sommaire aujourd'hui, verrouillé
 * ou non. Un utilisateur Pro (ou tout utilisateur quand `isFreePlan` est
 * `false`) reçoit la formation strictement inchangée.
 */
export function redactLockedCourseContent(
  course: GeneratedCourse,
  isFreePlan: boolean,
): GeneratedCourse {
  if (!isFreePlan) return course;

  const access = computeCourseAccess(course, isFreePlan);

  const redactedByPosition = new Map(
    course.chapters.map((chapter) => [
      chapter.position,
      access.lockedChapterPositions.has(chapter.position) ? redactChapter(chapter) : chapter,
    ]),
  );

  const chapters = course.chapters.map(
    (chapter) => redactedByPosition.get(chapter.position) ?? chapter,
  );

  const modules = normalizedModules(course).map((courseModule) => ({
    ...courseModule,
    chapters: courseModule.chapters.map(
      (chapter) => redactedByPosition.get(chapter.position) ?? chapter,
    ),
    quiz: access.lockedModulePositions.has(courseModule.position) ? [] : courseModule.quiz,
  }));

  return {
    ...course,
    chapters,
    modules: course.modules && course.modules.length > 0 ? modules : course.modules,
    quiz: access.finalLocked ? [] : course.quiz,
    summary: access.finalLocked ? "" : course.summary,
    keyPoints: access.finalLocked ? [] : course.keyPoints,
  };
}
