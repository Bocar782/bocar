-- Formations générées par Lia : courses, chapitres, exemples (réels ou fictifs).
-- À exécuter dans le SQL Editor du dashboard Supabase (ou via `supabase db push`).

create extension if not exists "pgcrypto";

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  topic text not null,
  title text not null,
  domain text not null,
  level text not null,
  introduction text not null,
  objectives jsonb not null default '[]'::jsonb,
  summary text not null,
  key_points jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists courses_user_id_created_at_idx
  on public.courses (user_id, created_at desc);

create table if not exists public.course_chapters (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  position int not null,
  title text not null,
  explanation text not null,
  key_takeaway text not null,
  created_at timestamptz not null default now()
);

create index if not exists course_chapters_course_id_position_idx
  on public.course_chapters (course_id, position);

create table if not exists public.course_examples (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.course_chapters (id) on delete cascade,
  description text not null,
  is_real boolean not null default false,
  source_url text,
  source_title text,
  created_at timestamptz not null default now()
);

create index if not exists course_examples_chapter_id_idx
  on public.course_examples (chapter_id);

alter table public.courses enable row level security;
alter table public.course_chapters enable row level security;
alter table public.course_examples enable row level security;

-- Chaque utilisateur ne voit et ne modifie que ses propres formations.
drop policy if exists "courses_owner_all" on public.courses;
create policy "courses_owner_all"
  on public.courses
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "course_chapters_owner_all" on public.course_chapters;
create policy "course_chapters_owner_all"
  on public.course_chapters
  for all
  using (
    exists (
      select 1 from public.courses
      where courses.id = course_chapters.course_id
        and courses.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.courses
      where courses.id = course_chapters.course_id
        and courses.user_id = auth.uid()
    )
  );

drop policy if exists "course_examples_owner_all" on public.course_examples;
create policy "course_examples_owner_all"
  on public.course_examples
  for all
  using (
    exists (
      select 1 from public.course_chapters
      join public.courses on courses.id = course_chapters.course_id
      where course_chapters.id = course_examples.chapter_id
        and courses.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.course_chapters
      join public.courses on courses.id = course_chapters.course_id
      where course_chapters.id = course_examples.chapter_id
        and courses.user_id = auth.uid()
    )
  );
