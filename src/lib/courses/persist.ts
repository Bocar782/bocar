import type { SupabaseClient } from "@supabase/supabase-js";
import type { GeneratedCourse, GeneratedModule, QuestionType } from "./schemas";

// Le pipeline de génération (generate.ts) produit encore une formation
// "plate" (une seule liste de chapitres, sans notion de module). À la
// sauvegarde, on l'organise systématiquement sous un module unique : c'est
// la même architecture que celle utilisée pour migrer les formations
// existantes (voir 0008_course_modules.sql), appliquée dès l'écriture pour
// que toute nouvelle formation ait, elle aussi, un module dès sa création.
export const DEFAULT_MODULE_TITLE = "Module 1";
export const DEFAULT_MODULE_POSITION = 0;

type CourseListItem = {
  id: string;
  title: string;
  domain: string;
  level: string;
  createdAt: string;
  chapterCount: number;
  currentChapterIndex: number | null;
  quizScore: number | null;
  quizTotal: number | null;
};

/**
 * Enregistre une formation complète (modules, leçons, exemples, quiz final,
 * quiz de module, questions) en UN SEUL appel au RPC SECURITY DEFINER
 * `save_generated_course` (voir 0012_save_generated_course_atomic.sql),
 * plutôt qu'en une séquence d'appels REST indépendants. Cette fonction SQL
 * s'exécute comme une instruction unique : si une erreur survient à
 * n'importe quelle étape (contrainte violée, donnée incohérente...), TOUT
 * ce qu'elle a déjà écrit durant cet appel est annulé automatiquement —
 * jamais de formation partiellement enregistrée. `auth.uid()` (jamais un
 * id transmis par ce code) détermine le propriétaire côté serveur, et
 * aucun identifiant de ressource existante n'est accepté en entrée : il
 * est donc structurellement impossible d'associer un module ou un quiz à
 * une autre formation.
 *
 * Le pipeline de génération (generate.ts) produit encore une formation
 * "plate" (une seule liste de chapitres, sans notion de module) : on
 * l'organise ici sous un module unique avant l'appel, comme le faisait déjà
 * l'ancienne version de cette fonction — même architecture que celle
 * utilisée pour migrer les formations existantes (voir
 * 0008_course_modules.sql). Le RPC lui-même accepte une liste de modules
 * (pas seulement un), pour rester correct si la génération produit un jour
 * plusieurs modules sans nécessiter de nouvelle migration.
 */
export async function saveCourse(
  supabase: SupabaseClient,
  course: GeneratedCourse,
): Promise<string> {
  const moduleQuiz = course.moduleQuizzes?.find(
    (mq) => mq.modulePosition === DEFAULT_MODULE_POSITION,
  );

  const payload = {
    topic: course.topic,
    title: course.title,
    domain: course.domain,
    level: course.level,
    introduction: course.introduction,
    objectives: course.objectives,
    summary: course.summary,
    keyPoints: course.keyPoints,
    // Quiz final : mêmes champs qu'avant cette évolution (question_type /
    // correct_choice_indexes ne sont pas transmis, le RPC applique les
    // mêmes valeurs par défaut que les anciennes insertions directes).
    quiz: course.quiz.map((q) => ({
      position: q.position,
      chapterIndex: q.chapterIndex,
      question: q.question,
      choices: q.choices,
      correctChoiceIndex: q.correctChoiceIndex,
      explanation: q.explanation,
    })),
    modules: [
      {
        position: DEFAULT_MODULE_POSITION,
        title: DEFAULT_MODULE_TITLE,
        chapters: course.chapters.map((chapter) => ({
          position: chapter.position,
          title: chapter.title,
          explanation: chapter.explanation,
          keyTakeaway: chapter.keyTakeaway,
          example: {
            isReal: chapter.example.isReal,
            description: chapter.example.description,
            sourceUrl: chapter.example.sourceUrl,
            sourceTitle: chapter.example.sourceTitle,
          },
        })),
        quiz: (moduleQuiz?.questions ?? []).map((q) => ({
          position: q.position,
          question: q.question,
          choices: q.choices,
          correctChoiceIndex: q.correctChoiceIndex,
          correctChoiceIndexes: q.correctChoiceIndexes ?? null,
          questionType: q.questionType ?? "single_choice",
          explanation: q.explanation,
        })),
      },
    ],
  };

  const { data, error } = await supabase.rpc("save_generated_course", {
    p_course: payload,
  });

  if (error || !data) {
    throw new Error(`Échec de l'enregistrement de la formation : ${error?.message}`);
  }

  return data as string;
}

export async function listCourses(
  supabase: SupabaseClient,
  userId: string,
): Promise<CourseListItem[]> {
  const { data, error } = await supabase
    .from("courses")
    .select(
      "id, title, domain, level, created_at, current_chapter_index, quiz_score, quiz_total, course_chapters(count)",
    )
    .eq("user_id", userId)
    .order("last_accessed_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Échec du chargement des formations : ${error.message}`);

  return (data ?? []).map((row) => {
    const chapters = Array.isArray(row.course_chapters)
      ? row.course_chapters[0]
      : row.course_chapters;
    return {
      id: row.id as string,
      title: row.title as string,
      domain: row.domain as string,
      level: row.level as string,
      createdAt: row.created_at as string,
      chapterCount: (chapters?.count as number) ?? 0,
      currentChapterIndex: (row.current_chapter_index as number | null) ?? null,
      quizScore: (row.quiz_score as number | null) ?? null,
      quizTotal: (row.quiz_total as number | null) ?? null,
    };
  });
}

export async function countTotalGenerations(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("courses")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) throw new Error(`Échec du calcul de l'utilisation : ${error.message}`);

  return count ?? 0;
}

export async function countGenerationsSince(
  supabase: SupabaseClient,
  userId: string,
  sinceIso: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("courses")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", sinceIso);

  if (error) throw new Error(`Échec du calcul de l'utilisation : ${error.message}`);

  return count ?? 0;
}

export async function getCourseById(
  supabase: SupabaseClient,
  courseId: string,
): Promise<GeneratedCourse | null> {
  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("topic, title, domain, level, introduction, objectives, summary, key_points")
    .eq("id", courseId)
    .maybeSingle();

  if (courseError) throw new Error(`Échec du chargement : ${courseError.message}`);
  if (!course) return null;

  const { data: chapters, error: chaptersError } = await supabase
    .from("course_chapters")
    .select(
      "id, position, title, explanation, key_takeaway, module_id, position_in_module, course_examples(description, is_real, source_url, source_title)",
    )
    .eq("course_id", courseId)
    .order("position", { ascending: true });

  if (chaptersError) throw new Error(`Échec du chargement des chapitres : ${chaptersError.message}`);

  const { data: moduleRows, error: modulesError } = await supabase
    .from("course_modules")
    .select("id, position, title")
    .eq("course_id", courseId)
    .order("position", { ascending: true });

  if (modulesError) throw new Error(`Échec du chargement des modules : ${modulesError.message}`);

  const { data: quizRows, error: quizError } = await supabase
    .from("course_quiz_questions")
    .select(
      "id, position, chapter_index, question, choices, correct_choice_index, correct_choice_indexes, question_type, explanation",
    )
    .eq("course_id", courseId)
    .order("position", { ascending: true });

  if (quizError) throw new Error(`Échec du chargement du quiz : ${quizError.message}`);

  const { data: finalQuizRow, error: finalQuizError } = await supabase
    .from("quizzes")
    .select("id")
    .eq("course_id", courseId)
    .eq("kind", "final")
    .maybeSingle();

  if (finalQuizError) {
    throw new Error(`Échec du chargement du quiz final : ${finalQuizError.message}`);
  }

  const chapterIds = (chapters ?? []).map((chapter) => chapter.id as string);
  const { data: progressRows, error: progressError } =
    chapterIds.length > 0
      ? await supabase
          .from("lesson_progress")
          .select("chapter_id")
          .in("chapter_id", chapterIds)
      : { data: [] as { chapter_id: string }[], error: null };

  if (progressError) {
    throw new Error(`Échec du chargement de la progression : ${progressError.message}`);
  }

  const completedChapterIds = new Set((progressRows ?? []).map((r) => r.chapter_id as string));

  const generatedChapters = (chapters ?? []).map((chapter) => {
    const example = Array.isArray(chapter.course_examples)
      ? chapter.course_examples[0]
      : chapter.course_examples;
    const id = chapter.id as string;
    return {
      id,
      position: chapter.position as number,
      title: chapter.title as string,
      explanation: chapter.explanation as string,
      keyTakeaway: chapter.key_takeaway as string,
      example: {
        isReal: Boolean(example?.is_real),
        description: (example?.description as string) ?? "",
        sourceUrl: (example?.source_url as string | null) ?? null,
        sourceTitle: (example?.source_title as string | null) ?? null,
      },
      completed: completedChapterIds.has(id),
    };
  });

  // Regroupement par module, purement additif : `generatedChapters`
  // ci-dessus (exposé comme `chapters`) reste la liste plate faisant
  // autorité pour tout le reste de l'application (chat, progression, quiz,
  // verrouillage du plan gratuit).
  const chapterModuleLinks = (chapters ?? []).map((chapter, i) => ({
    moduleId: (chapter.module_id as string | null) ?? null,
    positionInModule:
      (chapter.position_in_module as number | null) ?? generatedChapters[i].position,
    chapter: generatedChapters[i],
  }));

  const modules: GeneratedModule[] = (moduleRows ?? []).map((m) => {
    const moduleId = m.id as string;
    const moduleChapters = chapterModuleLinks
      .filter((link) => link.moduleId === moduleId)
      .sort((a, b) => a.positionInModule - b.positionInModule)
      .map((link) => link.chapter);
    return {
      position: m.position as number,
      title: m.title as string,
      chapters: moduleChapters,
    };
  });

  return {
    topic: course.topic,
    title: course.title,
    domain: course.domain,
    level: course.level,
    introduction: course.introduction,
    objectives: (course.objectives ?? []) as string[],
    summary: course.summary,
    keyPoints: (course.key_points ?? []) as string[],
    chapters: generatedChapters,
    modules,
    quiz: (quizRows ?? []).map((q) => ({
      id: q.id as string,
      position: q.position as number,
      chapterIndex: (q.chapter_index as number | null) ?? null,
      question: q.question as string,
      choices: (q.choices ?? []) as string[],
      correctChoiceIndex: q.correct_choice_index as number,
      correctChoiceIndexes: (q.correct_choice_indexes as number[] | null) ?? null,
      questionType: (q.question_type as QuestionType) ?? "single_choice",
      explanation: q.explanation as string,
    })),
    quizId: (finalQuizRow?.id as string | undefined) ?? null,
  };
}
