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
