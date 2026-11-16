import type { SupabaseClient } from "@supabase/supabase-js";
import type { GeneratedCourse, GeneratedModule, QuestionType } from "./schemas";

// Filet de sécurité uniquement : `generateCourse()` (Prompt 05.9) peuple
// toujours `course.modules` (1 à 4 modules réels). Ce module par défaut ne
// sert que si `course.modules` est absent/vide — même architecture que
// celle utilisée pour migrer les formations existantes (voir
// 0008_course_modules.sql), au cas où un appelant fournirait une formation
// sans aucun module.
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
 * Le pipeline de génération (generate.ts, Prompt 05.9) produit désormais
 * une véritable formation à 1-4 modules, chacun avec ses propres leçons et
 * son propre quiz (`course.modules`) : cette fonction transmet cette
 * structure réelle telle quelle au RPC, qui accepte nativement une liste
 * de modules depuis sa création (0012/0013_save_generated_course...sql,
 * jamais modifiées par ce prompt). Si `course.modules` est absent ou vide
 * (filet de sécurité, ne devrait plus arriver en pratique), retombe sur un
 * module unique couvrant tous les chapitres plats — même logique que la
 * migration des anciennes formations (0008_course_modules.sql).
 *
 * `reservationId` doit être une réservation `generation_reservations`
 * (0007_generation_reservations.sql) de type `course`, encore `pending`,
 * appartenant à l'utilisateur courant — obtenue via `reserveGenerationSlot`
 * AVANT d'appeler cette fonction (voir route.ts). Le RPC vérifie et
 * verrouille lui-même cette réservation, puis la marque `completed` dans
 * la MÊME transaction que l'enregistrement de la formation : il est donc
 * impossible d'appeler ce RPC sans réservation valide, avec la réservation
 * d'un autre utilisateur, une réservation déjà consommée/libérée, ou une
 * réservation de type `analysis` — et impossible que deux formations
 * soient créées à partir d'une seule réservation. L'appelant (route.ts) ne
 * doit PAS appeler `consumeReservation` après le succès de cette fonction :
 * ce serait une double consommation (sans effet, la réservation étant déjà
 * `completed`, mais inutile et trompeur) — seul `releaseReservation` reste
 * nécessaire, en cas d'échec de cet appel.
 */
export async function saveCourse(
  supabase: SupabaseClient,
  course: GeneratedCourse,
  reservationId: string,
): Promise<string> {
  const modules: GeneratedModule[] =
    course.modules && course.modules.length > 0
      ? course.modules
      : [
          {
            position: DEFAULT_MODULE_POSITION,
            title: DEFAULT_MODULE_TITLE,
            chapters: course.chapters,
            quiz: [],
          },
        ];

  const payload = {
    topic: course.topic,
    title: course.title,
    domain: course.domain,
    level: course.level,
    introduction: course.introduction,
    objectives: course.objectives,
    summary: course.summary,
    keyPoints: course.keyPoints,
    // Quiz final (Prompt 05.8) : questionType/correctChoiceIndexes sont
    // désormais transmis comme pour un quiz de module — le générateur
    // produit maintenant les 3 types pour le quiz final aussi, plus
    // seulement single_choice.
    quiz: course.quiz.map((q) => ({
      position: q.position,
      chapterIndex: q.chapterIndex,
      question: q.question,
      choices: q.choices,
      correctChoiceIndex: q.correctChoiceIndex,
      correctChoiceIndexes: q.correctChoiceIndexes ?? null,
      questionType: q.questionType ?? "single_choice",
      explanation: q.explanation,
    })),
    // Chaque module réel (Prompt 05.9), avec ses propres leçons et son
    // propre quiz — le RPC associe chaque quiz à SON module via la
    // position dans ce tableau, jamais par devinette : voir
    // 0012/0013_save_generated_course...sql.
    modules: modules.map((module) => ({
      position: module.position,
      title: module.title,
      chapters: module.chapters.map((chapter) => ({
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
      quiz: (module.quiz ?? []).map((q) => ({
        position: q.position,
        question: q.question,
        choices: q.choices,
        correctChoiceIndex: q.correctChoiceIndex,
        correctChoiceIndexes: q.correctChoiceIndexes ?? null,
        questionType: q.questionType ?? "single_choice",
        explanation: q.explanation,
      })),
    })),
  };

  const { data, error } = await supabase.rpc("save_generated_course", {
    p_course: payload,
    p_reservation_id: reservationId,
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

  // Un seul aller-retour pour TOUS les quiz de la formation (le final ET
  // chaque quiz de module) : chacun porte son `kind` et, pour un quiz de
  // module, son `module_id` réel — c'est cet identifiant, jamais une
  // position, qui relie un quiz à son module ci-dessous.
  const { data: quizRows, error: quizzesError } = await supabase
    .from("quizzes")
    .select("id, module_id, kind")
    .eq("course_id", courseId);

  if (quizzesError) throw new Error(`Échec du chargement des quiz : ${quizzesError.message}`);

  // De même, un seul aller-retour pour TOUTES les questions de la
  // formation, qu'elles appartiennent au quiz final ou à un quiz de
  // module : `quiz_id` (ajouté par 0010_quizzes.sql) permet de les
  // répartir correctement ci-dessous. Avant cette correction, ce
  // chargement ne filtrait que par `course_id` et mélangeait par erreur
  // les questions du quiz final avec celles de tout quiz de module —
  // sans conséquence tant qu'aucun quiz de module n'existait encore en
  // base, mais qui aurait faussé le quiz final dès le premier quiz de
  // module réellement sauvegardé (0012).
  const { data: questionRows, error: questionsError } = await supabase
    .from("course_quiz_questions")
    .select(
      "id, quiz_id, position, chapter_index, question, choices, correct_choice_index, correct_choice_indexes, question_type, explanation",
    )
    .eq("course_id", courseId)
    .order("position", { ascending: true });

  if (questionsError) {
    throw new Error(`Échec du chargement des questions de quiz : ${questionsError.message}`);
  }

  const questionsByQuizId = new Map<string, GeneratedCourse["quiz"]>();
  for (const q of questionRows ?? []) {
    // Toute question réelle est rattachée à un quiz depuis le backfill de
    // 0010_quizzes.sql ; ce garde-fou évite seulement qu'une ligne héritée
    // sans quiz_id ne fasse planter l'affichage.
    const quizId = q.quiz_id as string | null;
    if (!quizId) continue;
    const list = questionsByQuizId.get(quizId) ?? [];
    list.push({
      id: q.id as string,
      position: q.position as number,
      chapterIndex: (q.chapter_index as number | null) ?? null,
      question: q.question as string,
      choices: (q.choices ?? []) as string[],
      correctChoiceIndex: q.correct_choice_index as number,
      correctChoiceIndexes: (q.correct_choice_indexes as number[] | null) ?? null,
      questionType: (q.question_type as QuestionType) ?? "single_choice",
      explanation: q.explanation as string,
    });
    questionsByQuizId.set(quizId, list);
  }

  const finalQuizRow = (quizRows ?? []).find((z) => z.kind === "final") ?? null;
  const moduleQuizRowByModuleId = new Map(
    (quizRows ?? [])
      .filter((z) => z.kind === "module" && z.module_id)
      .map((z) => [z.module_id as string, z]),
  );

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
    const moduleQuizRow = moduleQuizRowByModuleId.get(moduleId) ?? null;
    const moduleQuizId = (moduleQuizRow?.id as string | undefined) ?? null;
    return {
      position: m.position as number,
      title: m.title as string,
      chapters: moduleChapters,
      quizId: moduleQuizId,
      quiz: moduleQuizId ? questionsByQuizId.get(moduleQuizId) ?? [] : [],
    };
  });

  const finalQuizId = (finalQuizRow?.id as string | undefined) ?? null;

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
    quiz: finalQuizId ? questionsByQuizId.get(finalQuizId) ?? [] : [],
    quizId: finalQuizId,
  };
}
