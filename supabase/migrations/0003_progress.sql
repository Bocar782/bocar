-- Progression de lecture et score du quiz, pour le tableau de bord
-- ("Mes formations" : reprendre où on s'est arrêté, % terminé, score).
-- À exécuter dans le SQL Editor du dashboard Supabase (ou via `supabase db push`),
-- après 0001_courses.sql et 0002_quiz.sql.

alter table public.courses
  add column if not exists current_chapter_index int,
  add column if not exists last_accessed_at timestamptz,
  add column if not exists quiz_score int,
  add column if not exists quiz_total int,
  add column if not exists quiz_completed_at timestamptz;
