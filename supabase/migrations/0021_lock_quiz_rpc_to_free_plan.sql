-- Corrige la faille E3 de l'audit 05.17 (Prompt 05.17.2) : les RPC
-- `start_quiz_attempt`/`submit_quiz_attempt` (0011, durcies par 0019 pour
-- `search_path`) vérifiaient déjà la PROPRIÉTÉ du quiz (le quiz appartient
-- à une formation de l'utilisateur courant), mais jamais si ce quiz était
-- verrouillé pour son plan — un utilisateur Free authentifié pouvait
-- appeler ces RPC DIRECTEMENT (ex. `supabase.rpc("start_quiz_attempt", ...)`
-- depuis la console du navigateur), avec l'id de n'importe quel quiz de SA
-- PROPRE formation, y compris un quiz de module situé après les
-- `FREE_PLAN_UNLOCKED_CHAPTERS` premiers chapitres ou le quiz final —
-- jamais accessibles au plan gratuit côté interface (course-view.tsx),
-- mais jusqu'ici jamais vérifiés côté RPC.
-- À exécuter après 0020_restrict_content_tables_to_owner_select.sql. Ne
-- modifie ni 0019 ni 0020 : seules les DÉFINITIONS de
-- `start_quiz_attempt`/`submit_quiz_attempt` sont remplacées ici (même
-- signature, même type de retour), avec l'ajout d'une nouvelle fonction
-- privée `is_quiz_locked_for_free_plan`.
--
-- Règle métier reprise à l'identique de `src/lib/courses/plan.ts` et de
-- `src/components/course-view.tsx` (jamais modifiée ici, seulement
-- reproduite côté serveur) :
-- * Un utilisateur Pro (`subscriptions.status` 'active'/'trialing', même
--   requête que `reserve_generation_slot`/`getActiveSubscription`) a accès
--   à tous les quiz, sans restriction.
-- * Un utilisateur Free n'a JAMAIS accès au quiz final (`quizzes.kind =
--   'final'`) : c'est une fonctionnalité listée exclusivement dans
--   `PRO_PLAN_FEATURES`, jamais dans `FREE_PLAN_FEATURES`.
-- * Un utilisateur Free a accès à un quiz de module (`quizzes.kind =
--   'module'`) uniquement si AUCUN chapitre de ce module n'a une position
--   >= `FREE_PLAN_UNLOCKED_CHAPTERS` (= 2, voir plan.ts — valeur dupliquée
--   ici à l'identique du modèle déjà suivi par `reserve_generation_slot`
--   pour les limites de quota, qui ne les reçoit jamais en paramètre pour
--   ne pas pouvoir être falsifiées par l'appelant) : un module à cheval sur
--   la frontière de déverrouillage, ou entièrement après elle, reste
--   verrouillé — exactement le même calcul séquentiel que
--   `computeCourseAccess()` (src/lib/courses/access.ts).
--
-- `is_quiz_locked_for_free_plan` n'est JAMAIS accordée à `authenticated` :
-- elle n'est appelable qu'en interne par les deux RPC ci-dessous, qui
-- s'exécutent déjà avec les droits de son PROPRIÉTAIRE (SECURITY DEFINER) —
-- le propriétaire a toujours implicitement le droit d'exécuter les
-- fonctions qu'il possède, quels que soient les GRANT accordés à d'autres
-- rôles. Elle reste donc impossible à appeler directement depuis le
-- navigateur, qu'importe ce qu'expose PostgREST, exactement comme
-- `reserve_generation_slot`/`save_generated_course` restent impossibles à
-- appeler avec des paramètres de quota falsifiés.

-- ---------------------------------------------------------------------
-- 1. is_quiz_locked_for_free_plan(p_quiz_id uuid) — fonction interne.
-- ---------------------------------------------------------------------
create or replace function public.is_quiz_locked_for_free_plan(p_quiz_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text;
  v_module_id uuid;
  v_has_locked_chapter boolean;
begin
  select kind, module_id into v_kind, v_module_id
  from public.quizzes
  where id = p_quiz_id;

  if v_kind is null then
    -- Quiz introuvable : jamais considéré comme "débloqué" par défaut —
    -- l'appelant (start_quiz_attempt/submit_quiz_attempt) a de toute façon
    -- déjà vérifié son existence et sa propriété avant d'arriver ici.
    return true;
  end if;

  if v_kind = 'final' then
    return true;
  end if;

  select exists (
    select 1 from public.course_chapters
    where module_id = v_module_id
      and position >= 2 -- FREE_PLAN_UNLOCKED_CHAPTERS (src/lib/courses/plan.ts) : garder synchronisé.
  ) into v_has_locked_chapter;

  return coalesce(v_has_locked_chapter, false);
end;
$$;

revoke all on function public.is_quiz_locked_for_free_plan(uuid) from public;

-- ---------------------------------------------------------------------
-- 2. start_quiz_attempt(p_quiz_id uuid) — même signature que 0011/0019,
--    ajoute la vérification de plan avant de créer la tentative.
-- ---------------------------------------------------------------------
create or replace function public.start_quiz_attempt(p_quiz_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_owns boolean;
  v_attempt_id uuid;
  v_is_pro boolean;
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

  select exists (
    select 1 from public.subscriptions
    where user_id = v_user_id
      and status in ('active', 'trialing')
  ) into v_is_pro;

  if not v_is_pro and public.is_quiz_locked_for_free_plan(p_quiz_id) then
    raise exception 'quiz_locked_free_plan';
  end if;

  insert into public.quiz_attempts (quiz_id, user_id, started_at)
  values (p_quiz_id, v_user_id, now())
  returning id into v_attempt_id;

  return v_attempt_id;
end;
$$;

revoke all on function public.start_quiz_attempt(uuid) from public;
grant execute on function public.start_quiz_attempt(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3. submit_quiz_attempt(p_attempt_id uuid, p_answers jsonb) — même
--    signature que 0011/0019. La vérification de plan n'est appliquée
--    qu'à une tentative PAS ENCORE notée (`v_already_completed = false`) :
--    une tentative déjà notée reste consultable telle quelle (son score a
--    été calculé alors que l'accès était légitime — la renvoyer à nouveau
--    ne révèle rien de nouveau), exactement comme aujourd'hui pour toute
--    relecture d'une tentative terminée. `attempt_not_found` protège déjà
--    la "soumission directe sans démarrage" : sans ligne `quiz_attempts`
--    créée par `start_quiz_attempt` (désormais verrouillé ci-dessus), il
--    n'existe aucune tentative valide à soumettre pour ce quiz.
-- ---------------------------------------------------------------------
create or replace function public.submit_quiz_attempt(
  p_attempt_id uuid,
  p_answers jsonb
) returns table (score int, total int)
language plpgsql
security definer
set search_path = ''
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
  v_is_pro boolean;
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

  select exists (
    select 1 from public.subscriptions
    where user_id = v_user_id
      and status in ('active', 'trialing')
  ) into v_is_pro;

  if not v_is_pro and public.is_quiz_locked_for_free_plan(v_quiz_id) then
    raise exception 'quiz_locked_free_plan';
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
