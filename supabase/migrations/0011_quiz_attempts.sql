-- Historique des tentatives de quiz (Prompt 05.3).
-- À exécuter après 0010_quizzes.sql.
--
-- Chaque tentative est une ligne indépendante : refaire un quiz n'écrase
-- plus jamais les tentatives précédentes. `courses.quiz_score`/
-- `quiz_total`/`quiz_completed_at` (inchangés) continuent de refléter
-- uniquement la DERNIÈRE tentative du quiz FINAL, pour ne rien casser côté
-- affichage existant (liste des formations, etc.) — cette table devient la
-- source de vérité pour tout le reste (historique, futurs quiz de module).
--
-- Sécurité : toute écriture passe exclusivement par les deux fonctions
-- SECURITY DEFINER ci-dessous, exactement comme reserve_generation_slot /
-- resolve_generation_slot en 0007. Il n'existe VOLONTAIREMENT aucune
-- policy insert/update/delete sur cette table : le score ne peut donc
-- jamais être transmis ni modifié directement par le client (ni même via
-- un appel REST direct qui contournerait l'application) — il est
-- systématiquement recalculé dans submit_quiz_attempt(), à partir des
-- vraies bonnes réponses stockées dans course_quiz_questions, jamais à
-- partir d'une valeur reçue du navigateur. C'est plus strict qu'une simple
-- combinaison RLS + trigger : il n'existe ici aucun chemin d'écriture à
-- contourner.

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  score int,
  total int,
  answers jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

-- score/total restent NULL tant que la tentative n'est pas terminée (ligne
-- créée par start_quiz_attempt, complétée par submit_quiz_attempt) : les
-- contraintes ci-dessous tolèrent explicitement cet état transitoire, tout
-- en imposant les règles demandées dès qu'une valeur est posée.
alter table public.quiz_attempts
  drop constraint if exists quiz_attempts_score_nonnegative;
alter table public.quiz_attempts
  add constraint quiz_attempts_score_nonnegative check (score is null or score >= 0);

alter table public.quiz_attempts
  drop constraint if exists quiz_attempts_total_positive;
alter table public.quiz_attempts
  add constraint quiz_attempts_total_positive check (total is null or total > 0);

alter table public.quiz_attempts
  drop constraint if exists quiz_attempts_score_le_total;
alter table public.quiz_attempts
  add constraint quiz_attempts_score_le_total
  check (score is null or total is null or score <= total);

create index if not exists quiz_attempts_quiz_id_idx
  on public.quiz_attempts (quiz_id, started_at desc);

create index if not exists quiz_attempts_user_id_idx
  on public.quiz_attempts (user_id, started_at desc);

alter table public.quiz_attempts enable row level security;

-- Lecture seule pour l'utilisateur, limitée à ses propres tentatives.
-- Aucune policy insert/update/delete (voir le commentaire en tête de
-- fichier) : impossible de créer, modifier ou supprimer une ligne
-- directement, pour soi-même ou pour quelqu'un d'autre.
drop policy if exists "quiz_attempts_owner_select" on public.quiz_attempts;
create policy "quiz_attempts_owner_select"
  on public.quiz_attempts
  for select
  using (user_id = auth.uid());

-- Démarre une tentative pour le quiz indiqué, pour l'utilisateur courant
-- (déterminé par auth.uid(), jamais par un paramètre — impossible de
-- démarrer une tentative au nom de quelqu'un d'autre). Vérifie que ce quiz
-- appartient bien à une formation de cet utilisateur avant de créer la
-- ligne. `started_at` est fixé ici, côté serveur (now()), jamais transmis
-- par le navigateur.
create or replace function public.start_quiz_attempt(p_quiz_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_owns boolean;
  v_attempt_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select exists (
    select 1 from public.quizzes
    join public.courses on courses.id = quizzes.course_id
    where quizzes.id = p_quiz_id
      and courses.user_id = v_user_id
  ) into v_owns;

  if not v_owns then
    raise exception 'quiz_not_found';
  end if;

  insert into public.quiz_attempts (quiz_id, user_id, started_at)
  values (p_quiz_id, v_user_id, now())
  returning id into v_attempt_id;

  return v_attempt_id;
end;
$$;

revoke all on function public.start_quiz_attempt(uuid) from public;
grant execute on function public.start_quiz_attempt(uuid) to authenticated;

-- Termine une tentative. p_answers ne contient QUE ce que l'utilisateur a
-- sélectionné (questionId + choix) — jamais de score ni de total : ces
-- valeurs sont entièrement recalculées ici à partir des vraies bonnes
-- réponses de course_quiz_questions, donc impossible à falsifier.
--
-- Protections :
-- - La tentative doit exister ET appartenir à l'utilisateur courant
--   (`qa.user_id = v_user_id`), sinon exception — impossible de terminer
--   la tentative de quelqu'un d'autre.
-- - `select ... for update` verrouille la ligne dès sa lecture : si deux
--   soumissions simultanées visent la même tentative, la seconde attend
--   que la première ait committé (donc posé completed_at) avant de lire
--   quoi que ce soit — élimine la course condition "lire pending, lire
--   pending, écrire, écrire" entre deux appels parallèles. Sous cette
--   protection, une tentative terminée est définitivement immuable et
--   deux soumissions concurrentes ne peuvent jamais produire deux
--   résultats différents pour la même tentative.
-- - Toute entrée de p_answers dont le questionId n'appartient pas
--   réellement à ce quiz est ignorée de fait : le calcul part de
--   `course_quiz_questions` (filtré sur ce quiz) en jointure gauche vers
--   les réponses soumises, jamais l'inverse — une réponse pour une
--   question d'un autre quiz n'est donc jamais prise en compte, ni comptée
--   ni stockée.
-- - `answer_map` est dédupliquée par questionId (`distinct on`, la
--   première réponse soumise dans le tableau l'emporte de façon
--   déterministe) : plusieurs entrées pour le même questionId — doublons
--   involontaires ou réponses contradictoires volontairement envoyées —
--   ne peuvent jamais compter plus d'une fois ni fausser le total, qui
--   reste toujours exactement le nombre réel de questions du quiz.
-- - Rejouer cette fonction sur une tentative déjà terminée est un no-op
--   qui renvoie le résultat déjà enregistré (idempotent face à une double
--   soumission), sans jamais recalculer ni écraser un score déjà posé.
-- - Si le quiz est le quiz final de la formation, met aussi à jour
--   courses.quiz_score/quiz_total/quiz_completed_at (compatibilité avec
--   l'existant), dans la même transaction.
create or replace function public.submit_quiz_attempt(
  p_attempt_id uuid,
  p_answers jsonb
) returns table (score int, total int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_quiz_id uuid;
  v_course_id uuid;
  v_quiz_kind text;
  v_already_completed boolean;
  v_existing_score int;
  v_existing_total int;
  v_score int;
  v_total int;
  v_answers jsonb;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select qa.quiz_id, (qa.completed_at is not null), qa.score, qa.total
    into v_quiz_id, v_already_completed, v_existing_score, v_existing_total
  from public.quiz_attempts qa
  where qa.id = p_attempt_id
    and qa.user_id = v_user_id
  for update;

  if v_quiz_id is null then
    raise exception 'attempt_not_found';
  end if;

  if v_already_completed then
    return query select v_existing_score, v_existing_total;
    return;
  end if;

  select quizzes.course_id, quizzes.kind
    into v_course_id, v_quiz_kind
  from public.quizzes
  where quizzes.id = v_quiz_id;

  with raw_answers as (
    -- `with ordinality` donne un rang stable (ordre d'apparition dans le
    -- tableau JSON reçu) pour pouvoir départager de façon déterministe
    -- plusieurs entrées pour le même questionId.
    select
      elem ->> 'questionId' as question_id,
      (elem ->> 'selectedChoiceIndex')::int as selected_choice_index,
      (elem -> 'selectedChoiceIndexes') as selected_choice_indexes,
      ord
    from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) with ordinality as t(elem, ord)
    where elem ->> 'questionId' is not null
  ),
  answer_map as (
    -- Une seule réponse retenue par question : la première soumise dans
    -- le tableau (plus petit `ord`). Tout doublon suivant pour le même
    -- questionId — même avec un choix différent — est ignoré, jamais
    -- compté en double.
    select distinct on (question_id)
      question_id, selected_choice_index, selected_choice_indexes
    from raw_answers
    order by question_id, ord
  ),
  graded as (
    select
      q.id as question_id,
      a.selected_choice_index,
      a.selected_choice_indexes,
      case
        when q.question_type = 'multiple_choice' then coalesce(
          (
            select jsonb_agg(v order by v)
            from jsonb_array_elements(coalesce(a.selected_choice_indexes, '[]'::jsonb)) as v
          ) = (
            select jsonb_agg(v order by v)
            from jsonb_array_elements(coalesce(q.correct_choice_indexes, '[]'::jsonb)) as v
          ),
          false
        )
        else a.selected_choice_index = q.correct_choice_index
      end as is_correct
    -- Point clé : on part des VRAIES questions de ce quiz (filtrées sur
    -- quiz_id), puis on y rattache les réponses soumises — jamais
    -- l'inverse. Une réponse soumise pour un questionId étranger à ce
    -- quiz n'a donc littéralement aucune ligne à rejoindre ici.
    from public.course_quiz_questions q
    left join answer_map a on a.question_id = q.id::text
    where q.quiz_id = v_quiz_id
  )
  select
    count(*) filter (where is_correct),
    count(*),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'questionId', question_id,
          'selectedChoiceIndex', selected_choice_index,
          'selectedChoiceIndexes', selected_choice_indexes,
          'isCorrect', coalesce(is_correct, false)
        )
      ),
      '[]'::jsonb
    )
  into v_score, v_total, v_answers
  from graded;

  if v_total = 0 then
    raise exception 'quiz_has_no_questions';
  end if;

  update public.quiz_attempts
  set score = v_score,
      total = v_total,
      answers = v_answers,
      completed_at = now()
  where id = p_attempt_id;

  if v_quiz_kind = 'final' then
    update public.courses
    set quiz_score = v_score,
        quiz_total = v_total,
        quiz_completed_at = now()
    where id = v_course_id;
  end if;

  return query select v_score, v_total;
end;
$$;

revoke all on function public.submit_quiz_attempt(uuid, jsonb) from public;
grant execute on function public.submit_quiz_attempt(uuid, jsonb) to authenticated;
