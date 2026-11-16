"use server";

import { createClient } from "@/lib/supabase/server";

// Échecs silencieux volontaires : un raté de tracking ne doit jamais casser
// la lecture de la formation ou l'affichage du score du quiz.

export async function updateChapterProgress(
  courseId: string,
  chapterIndex: number,
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("courses")
      .update({
        current_chapter_index: chapterIndex,
        last_accessed_at: new Date().toISOString(),
      })
      .eq("id", courseId)
      .eq("user_id", user.id);
  } catch {
    // ignoré
  }
}

/**
 * Marque une leçon comme terminée ou non. La policy RLS de
 * `lesson_progress` (voir 0009_lesson_progress.sql) garantit à elle seule
 * qu'un utilisateur ne peut marquer que les leçons de ses propres
 * formations ; il n'y a pas de colonne `user_id` à vérifier ici.
 */
export async function setLessonCompletion(chapterId: string, completed: boolean) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    if (completed) {
      await supabase.from("lesson_progress").upsert({ chapter_id: chapterId });
    } else {
      await supabase.from("lesson_progress").delete().eq("chapter_id", chapterId);
    }
  } catch {
    // ignoré
  }
}

/**
 * Démarre une tentative de quiz pour l'utilisateur courant, via le RPC
 * `start_quiz_attempt` (voir 0011_quiz_attempts.sql) : `started_at` est
 * fixé côté base de données (now()), jamais transmis par ce code ni par
 * le navigateur. Retourne l'identifiant de la tentative à fournir ensuite
 * à `submitQuizAttempt`, ou `null` en cas d'échec — un raté ici ne doit
 * jamais empêcher l'utilisateur de passer le quiz, seul le suivi de
 * tentative serait alors absent cette fois (cohérent avec le reste du
 * tracking de progression de l'app).
 */
export async function startQuizAttempt(quizId: string): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("start_quiz_attempt", { p_quiz_id: quizId });
    if (error) return null;
    return (data as string | null) ?? null;
  } catch {
    return null;
  }
}

/**
 * Termine une tentative de quiz, via le RPC `submit_quiz_attempt` (voir
 * 0011_quiz_attempts.sql). Le score et le total ne sont JAMAIS transmis
 * ici : ils sont recalculés côté base de données à partir des vraies
 * bonnes réponses stockées dans `course_quiz_questions` — impossible de
 * falsifier son résultat depuis le navigateur. Si `attemptId` est absent
 * (ex. `startQuizAttempt` a échoué), ne fait rien : le quiz reste jouable,
 * seule la tentative ne serait pas enregistrée cette fois. Le RPC lui-même
 * met à jour `courses.quiz_score`/`quiz_total`/`quiz_completed_at` quand
 * il s'agit du quiz final — `recordQuizScore` ci-dessous n'a donc plus
 * besoin d'être appelée depuis ce chemin, mais reste définie et exportée
 * (compatibilité, au cas où un autre appelant en dépendrait).
 */
export type SubmittedQuizAnswer = {
  questionId: string;
  /** Pour `single_choice`/`true_false`. Absent pour `multiple_choice`. */
  selectedChoiceIndex?: number | null;
  /** Pour `multiple_choice` uniquement. Absent pour les deux autres types. */
  selectedChoiceIndexes?: number[] | null;
};

export async function submitQuizAttempt(
  attemptId: string | null,
  answers: SubmittedQuizAnswer[],
): Promise<{ score: number; total: number } | null> {
  if (!attemptId) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .rpc("submit_quiz_attempt", { p_attempt_id: attemptId, p_answers: answers })
      .single<{ score: number; total: number }>();
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

export type QuizAttemptSummary = {
  id: string;
  completedAt: string;
  score: number;
  total: number;
  percent: number;
};

/**
 * Récupère l'historique des tentatives (terminées) du quiz indiqué, pour
 * l'utilisateur connecté UNIQUEMENT — déterminé ici par
 * `supabase.auth.getUser()`, jamais par un identifiant transmis par
 * l'appelant. Le filtre explicite `.eq("user_id", user.id)` est redondant
 * avec la policy RLS `quiz_attempts_owner_select` (0011_quiz_attempts.sql),
 * mais appliqué quand même en défense en profondeur, comme pour le reste
 * des actions de ce fichier. Ne sélectionne jamais la colonne `answers`
 * (qui pourrait indirectement laisser deviner les bonnes réponses) : seuls
 * date, score, total et pourcentage sont exposés.
 *
 * Contrairement aux autres fonctions de ce fichier (tracking fire-and-
 * forget, échec silencieux), celle-ci lève une erreur en cas d'échec de la
 * requête : l'interface d'historique a besoin de distinguer "aucune
 * tentative" de "échec du chargement" pour afficher l'état approprié.
 */
export async function getQuizAttemptHistory(quizId: string): Promise<QuizAttemptSummary[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("quiz_attempts")
    .select("id, score, total, completed_at")
    .eq("quiz_id", quizId)
    .eq("user_id", user.id)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false });

  if (error) {
    throw new Error(`Échec du chargement de l'historique : ${error.message}`);
  }

  return (data ?? []).map((row) => {
    const score = row.score as number;
    const total = row.total as number;
    return {
      id: row.id as string,
      completedAt: row.completed_at as string,
      score,
      total,
      percent: total > 0 ? Math.round((score / total) * 100) : 0,
    };
  });
}

export async function recordQuizScore(
  courseId: string,
  score: number,
  total: number,
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("courses")
      .update({
        quiz_score: score,
        quiz_total: total,
        quiz_completed_at: new Date().toISOString(),
      })
      .eq("id", courseId)
      .eq("user_id", user.id);
  } catch {
    // ignoré
  }
}
