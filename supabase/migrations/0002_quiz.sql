-- Quiz final de chaque formation (10 questions à choix multiples, générées
-- à partir du contenu réel de la formation uniquement).
-- À exécuter dans le SQL Editor du dashboard Supabase (ou via `supabase db push`),
-- après 0001_courses.sql.

create table if not exists public.course_quiz_questions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  position int not null,
  chapter_index int,
  question text not null,
  choices jsonb not null,
  correct_choice_index int not null,
  explanation text not null,
  created_at timestamptz not null default now()
);

create index if not exists course_quiz_questions_course_id_position_idx
  on public.course_quiz_questions (course_id, position);

alter table public.course_quiz_questions enable row level security;

drop policy if exists "course_quiz_questions_owner_all" on public.course_quiz_questions;
create policy "course_quiz_questions_owner_all"
  on public.course_quiz_questions
  for all
  using (
    exists (
      select 1 from public.courses
      where courses.id = course_quiz_questions.course_id
        and courses.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.courses
      where courses.id = course_quiz_questions.course_id
        and courses.user_id = auth.uid()
    )
  );
