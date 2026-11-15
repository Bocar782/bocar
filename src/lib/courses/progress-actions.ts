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
