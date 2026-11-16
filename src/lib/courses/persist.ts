import type { SupabaseClient } from "@supabase/supabase-js";
import type { GeneratedCourse, GeneratedModule } from "./schemas";

// Le pipeline de génération (generate.ts) produit encore une formation
// "plate" (une seule liste de chapitres, sans notion de module). À la
// sauvegarde, on l'organise systématiquement sous un module unique : c'est
// la même architecture que celle utilisée pour migrer les formations
// existantes (voir 0008_course_modules.sql), appliquée dès l'écriture pour
// que toute nouvelle formation ait, elle aussi, un module dès sa création.
const DEFAULT_MODULE_TITLE = "Module 1";
const DEFAULT_MODULE_POSITION = 0;

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

export async function saveCourse(
  supabase: SupabaseClient,
  userId: string,
  course: GeneratedCourse,
): Promise<string> {
  const { data: courseRow, error: courseError } = await supabase
    .from("courses")
    .insert({
      user_id: userId,
      topic: course.topic,
      title: course.title,
      domain: course.domain,
      level: course.level,
      introduction: course.introduction,
      objectives: course.objectives,
      summary: course.summary,
      key_points: course.keyPoints,
    })
    .select("id")
    .single();

  if (courseError || !courseRow) {
    throw new Error(
      `Échec de l'enregistrement de la formation : ${courseError?.message}`,
    );
  }

  const courseId = courseRow.id as string;

  const { data: moduleRow, error: moduleError } = await supabase
    .from("course_modules")
    .insert({
      course_id: courseId,
      position: DEFAULT_MODULE_POSITION,
      title: DEFAULT_MODULE_TITLE,
    })
    .select("id")
    .single();

  if (moduleError || !moduleRow) {
    throw new Error(`Échec de l'enregistrement du module : ${moduleError?.message}`);
  }

  const moduleId = moduleRow.id as string;

  const { data: chapterRows, error: chaptersError } = await supabase
    .from("course_chapters")
    .insert(
      course.chapters.map((chapter) => ({
        course_id: courseId,
        position: chapter.position,
        title: chapter.title,
        explanation: chapter.explanation,
        key_takeaway: chapter.keyTakeaway,
        module_id: moduleId,
        position_in_module: chapter.position,
      })),
    )
    .select("id, position");

  if (chaptersError || !chapterRows) {
    throw new Error(
      `Échec de l'enregistrement des chapitres : ${chaptersError?.message}`,
    );
  }

  const examples = course.chapters.map((chapter) => {
    const row = chapterRows.find((r) => r.position === chapter.position);
    if (!row) throw new Error("Chapitre introuvable après insertion.");
    return {
      chapter_id: row.id as string,
      description: chapter.example.description,
      is_real: chapter.example.isReal,
      source_url: chapter.example.sourceUrl,
      source_title: chapter.example.sourceTitle,
    };
  });

  const { error: examplesError } = await supabase
    .from("course_examples")
    .insert(examples);

  if (examplesError) {
    throw new Error(
      `Échec de l'enregistrement des exemples : ${examplesError.message}`,
    );
  }

  if (course.quiz.length > 0) {
    // Même logique que pour le module par défaut ci-dessus : crée le quiz
    // final (table `quizzes`, voir 0010_quizzes.sql) dès la sauvegarde,
    // pour que toute nouvelle formation ait, elle aussi, un quiz
    // exploitable par le système de tentatives (0011_quiz_attempts.sql).
    const { data: quizRow, error: quizRowError } = await supabase
      .from("quizzes")
      .insert({ course_id: courseId, module_id: null, kind: "final", position: 0 })
      .select("id")
      .single();

    if (quizRowError || !quizRow) {
      throw new Error(`Échec de l'enregistrement du quiz : ${quizRowError?.message}`);
    }

    const quizId = quizRow.id as string;

    const { error: quizError } = await supabase.from("course_quiz_questions").insert(
      course.quiz.map((q) => ({
        course_id: courseId,
        position: q.position,
        chapter_index: q.chapterIndex,
        question: q.question,
        choices: q.choices,
        correct_choice_index: q.correctChoiceIndex,
        explanation: q.explanation,
        quiz_id: quizId,
      })),
    );

    if (quizError) {
      throw new Error(`Échec de l'enregistrement du quiz : ${quizError.message}`);
    }
  }

  return courseId;
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
    .select("id, position, chapter_index, question, choices, correct_choice_index, explanation")
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
      explanation: q.explanation as string,
    })),
    quizId: (finalQuizRow?.id as string | undefined) ?? null,
  };
}
