-- Durcissement de search_path sur les 4 dernières fonctions SECURITY
-- DEFINER encore en `set search_path = public` (Prompt 05.16.5/05.16.6,
-- suite de l'audit de sécurité 05.16). À exécuter après
-- 0017_chat_rate_limit_cleanup.sql et après la migration 0018 déjà
-- appliquée sur Supabase (son contenu n'est pas présent dans ce dépôt —
-- NE PAS la modifier ni la rejouer, et ne pas rejouer non plus 0017).
--
-- Constat (audit 05.16.5, lecture seule) : `reserve_generation_slot` et
-- `resolve_generation_slot` (0007), ainsi que `start_quiz_attempt` et
-- `submit_quiz_attempt` (0011), utilisaient toutes `set search_path =
-- public` — le réglage qui précédait le durcissement introduit à partir
-- de `save_generated_course` (0012) et maintenu depuis
-- (`check_chat_rate_limit`, 0016/0017) : `set search_path = ''` (chaîne
-- vide). `search_path = public` reste la configuration historiquement
-- associée à la classe de vulnérabilité "search_path trojan-horse"
-- (CVE-2018-1058) : si un rôle disposant du droit CREATE sur le schéma
-- `public` y plantait un objet portant le même nom qu'une référence NON
-- qualifiée du corps de la fonction, cet objet pourrait être résolu à la
-- place de celui attendu. L'audit 05.16.5 a confirmé que les 4 fonctions
-- qualifient déjà explicitement toutes leurs références de table
-- (`public.subscriptions`, `public.generation_reservations`,
-- `public.quizzes`, `public.courses`, `public.quiz_attempts`,
-- `public.course_quiz_questions`) et n'utilisent que des fonctions
-- réellement intégrées à Postgres (`now()`, `count()`,
-- `pg_advisory_xact_lock()`, `hashtext()`, `coalesce()`,
-- `jsonb_array_elements()`, `jsonb_agg()`, `jsonb_build_object()`,
-- `get diagnostics`...), qui résolvent via `pg_catalog` — toujours
-- recherché en priorité par Postgres, indépendamment de la valeur de
-- `search_path`. Aucune chaîne d'exploitation n'a donc été identifiée dans
-- le code actuel ; ce correctif ferme malgré tout l'écart par rapport à la
-- pratique recommandée par Supabase, en alignant ces 4 fonctions sur le
-- même réglage que toutes les autres fonctions SECURITY DEFINER du
-- schéma.
--
-- Chaque fonction est redéfinie ici avec EXACTEMENT la même signature, le
-- même type de retour, le même corps et les mêmes permissions que dans
-- 0007/0011 — seul `set search_path = public` devient `set search_path =
-- ''`. `create or replace function` la met donc à jour en place, sans
-- jamais créer de doublon ni casser un appel existant côté application
-- (src/lib/courses/reservation.ts, src/lib/supabase/*, les routes
-- /api/courses/generate, /api/analysis/generate, et les futures routes de
-- quiz) : aucun de ces appelants ne dépend du contenu de `search_path`,
-- seulement du nom de la fonction, de sa signature et de son comportement
-- — tous deux inchangés.
--
-- Comme pour 0012-0017, 0007 et 0011 eux-mêmes ne sont pas modifiés : ce
-- fichier ne touche qu'à la DÉFINITION des 4 fonctions, jamais aux tables,
-- index, policies RLS ou données déjà en place.

-- ---------------------------------------------------------------------
-- 1. reserve_generation_slot(p_kind text) — inchangée depuis 0007 à
--    l'exception de `set search_path`.
-- ---------------------------------------------------------------------
create or replace function public.reserve_generation_slot(
  p_kind text
) returns table (
  ok boolean,
  reservation_id uuid,
  is_pro boolean,
  limit_count int,
  used_count int
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_sub_status text;
  v_sub_period_start timestamptz;
  v_is_pro boolean := false;
  v_window_start timestamptz := '-infinity';
  v_limit int;
  v_used int;
  v_reservation_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if p_kind not in ('course', 'analysis') then
    raise exception 'invalid_kind';
  end if;

  -- Sérialise les appels concurrents pour ce (utilisateur, type) : un
  -- deuxième appel simultané attend que le premier ait validé et commité sa
  -- réservation avant de recompter — élimine la course condition "lire 0,
  -- lire 0, insérer, insérer" entre deux requêtes parallèles.
  perform pg_advisory_xact_lock(hashtext(v_user_id::text), hashtext(p_kind));

  select s.status, s.current_period_start
    into v_sub_status, v_sub_period_start
  from public.subscriptions s
  where s.user_id = v_user_id;

  if found and v_sub_status in ('active', 'trialing') then
    v_is_pro := true;
    v_window_start := coalesce(v_sub_period_start, '-infinity'::timestamptz);
  else
    v_is_pro := false;
    v_window_start := '-infinity'::timestamptz;
  end if;

  -- Limites fixées en dur (voir le commentaire au-dessus de la fonction) :
  -- jamais transmises par l'appelant.
  v_limit := case
    when p_kind = 'course' and v_is_pro then 3
    when p_kind = 'course' and not v_is_pro then 1
    when p_kind = 'analysis' and v_is_pro then 2
    else 0
  end;

  -- Réservations abandonnées (requête interrompue, redémarrage serveur...) :
  -- au-delà d'un délai très supérieur à la durée max d'une génération, elles
  -- ne doivent plus jamais bloquer le quota.
  update public.generation_reservations
  set status = 'released', resolved_at = now()
  where user_id = v_user_id
    and kind = p_kind
    and status = 'pending'
    and created_at < now() - interval '15 minutes';

  select count(*) into v_used
  from public.generation_reservations
  where user_id = v_user_id
    and kind = p_kind
    and status in ('pending', 'completed')
    and created_at >= v_window_start;

  if v_used >= v_limit then
    return query select false, null::uuid, v_is_pro, v_limit, v_used;
    return;
  end if;

  insert into public.generation_reservations (user_id, kind, status)
  values (v_user_id, p_kind, 'pending')
  returning id into v_reservation_id;

  return query select true, v_reservation_id, v_is_pro, v_limit, v_used + 1;
end;
$$;

revoke all on function public.reserve_generation_slot(text) from public;
grant execute on function public.reserve_generation_slot(text) to authenticated;

-- ---------------------------------------------------------------------
-- 2. resolve_generation_slot(p_reservation_id uuid, p_status text,
--    p_resource_id uuid default null) — inchangée depuis 0007 à
--    l'exception de `set search_path`.
-- ---------------------------------------------------------------------
create or replace function public.resolve_generation_slot(
  p_reservation_id uuid,
  p_status text,
  p_resource_id uuid default null
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_updated int;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if p_status not in ('completed', 'released') then
    raise exception 'invalid_status';
  end if;

  update public.generation_reservations
  set status = p_status,
      resolved_at = now(),
      resource_id = coalesce(p_resource_id, resource_id)
  where id = p_reservation_id
    and user_id = v_user_id
    and status = 'pending';

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.resolve_generation_slot(uuid, text, uuid) from public;
grant execute on function public.resolve_generation_slot(uuid, text, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3. start_quiz_attempt(p_quiz_id uuid) — inchangée depuis 0011 à
--    l'exception de `set search_path`.
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

-- ---------------------------------------------------------------------
-- 4. submit_quiz_attempt(p_attempt_id uuid, p_answers jsonb) — inchangée
--    depuis 0011 à l'exception de `set search_path`.
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
