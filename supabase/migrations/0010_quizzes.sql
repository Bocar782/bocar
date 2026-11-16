-- Fondations SQL du nouveau système de quiz (Prompt 05.2) : un quiz final
-- par formation, un quiz par module, plusieurs types de questions. La table
-- quiz_attempts (historique des tentatives) n'est PAS créée ici — étape
-- séparée (Prompt 05.3).
-- À exécuter après 0009_lesson_progress.sql.

-- ---------------------------------------------------------------------
-- 1. Table `quizzes` : une ligne par quiz réellement existant (le quiz
--    final d'une formation, ou le quiz d'un de ses modules).
-- ---------------------------------------------------------------------

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  module_id uuid references public.course_modules (id) on delete cascade,
  kind text not null check (kind in ('final', 'module')),
  position int not null,
  created_at timestamptz not null default now()
);

-- Un quiz final n'a pas de module ; un quiz de module en a obligatoirement
-- un. Empêche par construction toute ligne incohérente (ex. kind='final'
-- avec un module_id renseigné).
alter table public.quizzes
  drop constraint if exists quizzes_kind_module_id_consistency;
alter table public.quizzes
  add constraint quizzes_kind_module_id_consistency
  check (
    (kind = 'final' and module_id is null)
    or (kind = 'module' and module_id is not null)
  );

create index if not exists quizzes_course_id_position_idx
  on public.quizzes (course_id, position);

-- Au plus un quiz final par formation.
create unique index if not exists quizzes_one_final_per_course
  on public.quizzes (course_id)
  where kind = 'final';

-- Au plus un quiz par module (la contrainte ci-dessus garantit que
-- module_id n'est non nul que pour kind='module', donc cet index suffit à
-- empêcher deux quiz de module pour le même module).
create unique index if not exists quizzes_one_quiz_per_module
  on public.quizzes (module_id)
  where kind = 'module';

alter table public.quizzes enable row level security;

-- Même schéma que la policy de `course_chapters` renforcée en 0008 :
-- propriété de la formation vérifiée via `courses.user_id`, PLUS cohérence
-- module_id/course_id vérifiée dans le `with check` — sans cette seconde
-- vérification, un utilisateur pourrait créer un quiz dans SA formation
-- mais le rattacher au module d'une AUTRE formation (y compris d'un autre
-- utilisateur), exactement le problème corrigé sur course_chapters.module_id
-- dans 0008.
drop policy if exists "quizzes_owner_all" on public.quizzes;
create policy "quizzes_owner_all"
  on public.quizzes
  for all
  using (
    exists (
      select 1 from public.courses
      where courses.id = quizzes.course_id
        and courses.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.courses
      where courses.id = quizzes.course_id
        and courses.user_id = auth.uid()
    )
    and (
      module_id is null
      or exists (
        select 1 from public.course_modules
        where course_modules.id = quizzes.module_id
          and course_modules.course_id = quizzes.course_id
      )
    )
  );

-- Contrainte SQL en complément de la RLS (et non à sa place) : une RLS
-- s'applique au rôle qui exécute la requête (`authenticated` ici), pas à
-- un rôle qui la contournerait (ex. service_role, utilisé par les webhooks
-- Stripe). Ce trigger fait respecter l'invariant module_id/course_id au
-- niveau de la table elle-même, quel que soit le rôle qui écrit.
create or replace function public.check_quiz_module_consistency()
returns trigger
language plpgsql
as $$
begin
  if new.module_id is not null and not exists (
    select 1 from public.course_modules
    where course_modules.id = new.module_id
      and course_modules.course_id = new.course_id
  ) then
    raise exception 'quizzes.module_id must belong to the same course_id';
  end if;
  return new;
end;
$$;

drop trigger if exists quizzes_check_module_consistency on public.quizzes;
create trigger quizzes_check_module_consistency
  before insert or update on public.quizzes
  for each row
  execute function public.check_quiz_module_consistency();

-- ---------------------------------------------------------------------
-- 2. `course_quiz_questions` : colonnes additives, rien de retiré.
--    `course_id` et `correct_choice_index` restent inchangés et toujours
--    utilisés par le quiz final existant (non modifié par cette migration).
-- ---------------------------------------------------------------------

alter table public.course_quiz_questions
  add column if not exists quiz_id uuid references public.quizzes (id) on delete cascade,
  add column if not exists question_type text not null default 'single_choice'
    check (question_type in ('single_choice', 'multiple_choice', 'true_false')),
  add column if not exists correct_choice_indexes jsonb;

-- Cohérence type de question / colonne de bonne(s) réponse(s) utilisée :
-- `correct_choice_indexes` (tableau) uniquement pour 'multiple_choice',
-- `correct_choice_index` (existant, inchangé) pour les deux autres types.
-- Toutes les lignes existantes valent 'single_choice' avec
-- correct_choice_indexes = null, donc satisfont déjà cette contrainte.
alter table public.course_quiz_questions
  drop constraint if exists course_quiz_questions_type_consistency;
alter table public.course_quiz_questions
  add constraint course_quiz_questions_type_consistency
  check (
    (question_type = 'multiple_choice' and correct_choice_indexes is not null)
    or (question_type != 'multiple_choice' and correct_choice_indexes is null)
  );

create index if not exists course_quiz_questions_quiz_id_position_idx
  on public.course_quiz_questions (quiz_id, position);

-- ---------------------------------------------------------------------
-- 3. Backfill : un quiz final par formation existante, questions
--    existantes rattachées à ce quiz. Idempotent (comme le backfill de
--    0008) : si rejoué, `courses_to_migrate` ne sélectionne plus rien dès
--    que toutes les questions ont un quiz_id non nul.
--    Une formation sans aucune question de quiz n'obtient volontairement
--    aucune ligne `quizzes` (un quiz vide n'a pas de sens), même logique
--    que pour les formations sans chapitre en 0008.
-- ---------------------------------------------------------------------

with courses_to_migrate as (
  select distinct course_id
  from public.course_quiz_questions
  where quiz_id is null
),
inserted_quizzes as (
  insert into public.quizzes (course_id, module_id, kind, position)
  select course_id, null, 'final', 0
  from courses_to_migrate
  returning id, course_id
)
update public.course_quiz_questions cqq
set quiz_id = iq.id
from inserted_quizzes iq
where cqq.course_id = iq.course_id
  and cqq.quiz_id is null;

-- ---------------------------------------------------------------------
-- 4. Renforce la policy RLS de `course_quiz_questions` (définie à
--    l'origine dans 0002_quiz.sql, dont le fichier n'est pas modifié ici) :
--    même raisonnement que pour quizzes.module_id ci-dessus, appliqué à
--    quiz_id. Sans ce renfort, une question pourrait être rattachée (en
--    INSERT comme en UPDATE) au quiz d'une AUTRE formation.
-- ---------------------------------------------------------------------

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
    and (
      quiz_id is null
      or exists (
        select 1 from public.quizzes
        where quizzes.id = course_quiz_questions.quiz_id
          and quizzes.course_id = course_quiz_questions.course_id
      )
    )
  );

-- Même raisonnement que pour le trigger de `quizzes` ci-dessus : contrainte
-- SQL indépendante de la RLS, pour quiz_id.
create or replace function public.check_quiz_question_consistency()
returns trigger
language plpgsql
as $$
begin
  if new.quiz_id is not null and not exists (
    select 1 from public.quizzes
    where quizzes.id = new.quiz_id
      and quizzes.course_id = new.course_id
  ) then
    raise exception 'course_quiz_questions.quiz_id must belong to the same course_id';
  end if;
  return new;
end;
$$;

drop trigger if exists course_quiz_questions_check_quiz_consistency on public.course_quiz_questions;
create trigger course_quiz_questions_check_quiz_consistency
  before insert or update on public.course_quiz_questions
  for each row
  execute function public.check_quiz_question_consistency();
