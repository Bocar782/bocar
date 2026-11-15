import type { SupabaseClient } from "@supabase/supabase-js";
import type { GeneratedCourse } from "./schemas";

type CourseListItem = {
  id: string;
  title: string;
  domain: string;
  level: string;
  createdAt: string;
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

  const { data: chapterRows, error: chaptersError } = await supabase
    .from("course_chapters")
    .insert(
      course.chapters.map((chapter) => ({
        course_id: courseId,
        position: chapter.position,
        title: chapter.title,
        explanation: chapter.explanation,
        key_takeaway: chapter.keyTakeaway,
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
    const { error: quizError } = await supabase.from("course_quiz_questions").insert(
      course.quiz.map((q) => ({
        course_id: courseId,
        position: q.position,
        chapter_index: q.chapterIndex,
        question: q.question,
        choices: q.choices,
        correct_choice_index: q.correctChoiceIndex,
        explanation: q.explanation,
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
    .select("id, title, domain, level, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Échec du chargement des formations : ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    domain: row.domain as string,
    level: row.level as string,
    createdAt: row.created_at as string,
  }));
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
    .select("id, position, title, explanation, key_takeaway, course_examples(description, is_real, source_url, source_title)")
    .eq("course_id", courseId)
    .order("position", { ascending: true });

  if (chaptersError) throw new Error(`Échec du chargement des chapitres : ${chaptersError.message}`);

  const { data: quizRows, error: quizError } = await supabase
    .from("course_quiz_questions")
    .select("position, chapter_index, question, choices, correct_choice_index, explanation")
    .eq("course_id", courseId)
    .order("position", { ascending: true });

  if (quizError) throw new Error(`Échec du chargement du quiz : ${quizError.message}`);

  return {
    topic: course.topic,
    title: course.title,
    domain: course.domain,
    level: course.level,
    introduction: course.introduction,
    objectives: (course.objectives ?? []) as string[],
    summary: course.summary,
    keyPoints: (course.key_points ?? []) as string[],
    chapters: (chapters ?? []).map((chapter) => {
      const example = Array.isArray(chapter.course_examples)
        ? chapter.course_examples[0]
        : chapter.course_examples;
      return {
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
      };
    }),
    quiz: (quizRows ?? []).map((q) => ({
      position: q.position as number,
      chapterIndex: (q.chapter_index as number | null) ?? null,
      question: q.question as string,
      choices: (q.choices ?? []) as string[],
      correctChoiceIndex: q.correct_choice_index as number,
      explanation: q.explanation as string,
    })),
  };
}
