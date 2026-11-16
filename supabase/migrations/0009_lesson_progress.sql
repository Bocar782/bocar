-- Suivi explicite des leçons terminées (Prompt 04 : interface des
-- formations modules/leçons). À exécuter après 0008_course_modules.sql.
--
-- Complète `courses.current_chapter_index`/`last_accessed_at` (inchangés,
-- toujours utilisés pour reprendre à la dernière position consultée) avec
-- un vrai suivi "terminé/pas terminé" par leçon, pour afficher un
-- pourcentage de progression et un nombre de leçons terminées fiables.
--
-- L'existence d'une ligne pour un `chapter_id` donné signifie "leçon
-- terminée" ; son absence signifie "pas terminée". Pas de colonne
-- booléenne séparée à garder synchronisée.

create table if not exists public.lesson_progress (
  chapter_id uuid primary key references public.course_chapters (id) on delete cascade,
  completed_at timestamptz not null default now()
);

alter table public.lesson_progress enable row level security;

-- Même schéma de policy que `course_examples_owner_all` /
-- `course_quiz_questions_owner_all` : propriété vérifiée par double
-- jointure jusqu'à `courses.user_id`. Il n'y a ici qu'une seule colonne de
-- liaison (`chapter_id`), donc aucun risque analogue au problème corrigé
-- sur `course_chapters.module_id` dans 0008 (pas de deuxième référence
-- pouvant être désynchronisée de la formation réelle).
drop policy if exists "lesson_progress_owner_all" on public.lesson_progress;
create policy "lesson_progress_owner_all"
  on public.lesson_progress
  for all
  using (
    exists (
      select 1 from public.course_chapters
      join public.courses on courses.id = course_chapters.course_id
      where course_chapters.id = lesson_progress.chapter_id
        and courses.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.course_chapters
      join public.courses on courses.id = course_chapters.course_id
      where course_chapters.id = lesson_progress.chapter_id
        and courses.user_id = auth.uid()
    )
  );
