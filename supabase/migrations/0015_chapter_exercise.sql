-- Ajoute un exercice pratique FACULTATIF à chaque leçon (Prompt 05.11,
-- suite à l'audit pédagogique 05.10) : une consigne claire posée à partir
-- d'une situation concrète, et sa correction détaillée, uniquement quand
-- le sujet s'y prête (jamais systématique, voir generate.ts).
-- À exécuter après 0014_expire_stale_reservation_on_save.sql — y compris
-- si 0014 n'a pas encore été appliquée au moment où cette migration est
-- écrite : NE PAS inverser l'ordre, 0014 doit être appliquée avant 0015
-- (le corps de save_generated_course ci-dessous part de celui de 0014,
-- contrôle de fraîcheur de réservation inclus).
--
-- Deux colonnes nullable ajoutées à `course_chapters` : `exercise_prompt`
-- et `exercise_solution`. Nullable par construction, sans valeur par
-- défaut autre que NULL : une leçon sans exercice (sujet qui ne s'y prête
-- pas, OU formation générée avant cette évolution) a simplement ces deux
-- colonnes à NULL — AUCUNE migration de données nécessaire, AUCUN impact
-- sur les formations existantes, qui continuent de fonctionner à
-- l'identique (voir generate.ts/persist.ts : `exercise` devient `null`
-- côté application dans les deux cas, sans distinction).
--
-- `save_generated_course(jsonb, uuid)` est redéfinie (même nom, mêmes
-- paramètres, `create or replace function`, donc aucun changement de
-- signature ni de `revoke`/`grant`) pour écrire ces deux colonnes quand le
-- payload les fournit (`v_chapter->'exercise'->>'prompt'`/`->>'solution'` —
-- `NULL` si la clé `exercise` est absente ou vaut JSON `null`, exactement
-- le cas d'une leçon sans exercice ; ce sont alors des colonnes SQL NULL,
-- pas une chaîne vide). Le corps complet est repris tel quel de 0014 (donc
-- avec, sans aucun changement, le contrôle de fraîcheur de réservation que
-- 0014 a ajouté) : SEUL le bloc d'insertion de `course_chapters` change,
-- avec l'ajout des deux nouvelles colonnes à la liste des colonnes
-- insérées. Aucune autre ligne du corps de la fonction n'est modifiée.
--
-- Conservé à l'identique (aucune régression visée, voir 0012/0013/0014) :
-- * Toutes les vérifications de sécurité sur la réservation, y compris le
--   contrôle de fraîcheur de 15 minutes ajouté par 0014.
-- * `security definer` et `set search_path = ''`.
-- * L'atomicité : toujours une seule invocation PL/pgSQL, donc toujours
--   annulée entièrement si quoi que ce soit échoue à n'importe quelle étape.
-- * Le comportement des modules, exemples, quiz de module et quiz final :
--   bit pour bit identique à 0014.
-- * Les permissions : `revoke all ... from public` puis
--   `grant execute ... to authenticated`, répétées ci-dessous (idempotent,
--   sans effet si déjà en l'état).
--
-- Ne supprime ni ne modifie aucune donnée existante : les lignes
-- `course_chapters` déjà enregistrées reçoivent simplement NULL pour ces
-- deux nouvelles colonnes (comportement par défaut de `add column` sans
-- valeur par défaut explicite).
alter table public.course_chapters
  add column if not exists exercise_prompt text,
  add column if not exists exercise_solution text;

create or replace function public.save_generated_course(
  p_course jsonb,
  p_reservation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_reservation_user_id uuid;
  v_reservation_kind text;
  v_reservation_status text;
  v_reservation_created_at timestamptz;
  v_course_id uuid;
  v_module jsonb;
  v_module_id uuid;
  v_chapter jsonb;
  v_chapter_id uuid;
  v_chapter_ord int;
  v_question jsonb;
  v_quiz_id uuid;
  v_final_quiz jsonb;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if p_reservation_id is null then
    raise exception 'missing_reservation';
  end if;

  -- Verrouille la ligne de réservation dès sa lecture : un second appel
  -- concurrent avec le même p_reservation_id attend ici que cette
  -- transaction committe (ou s'annule) avant de pouvoir la lire à son
  -- tour — jamais deux formations créées pour la même réservation.
  select user_id, kind, status, created_at
    into v_reservation_user_id, v_reservation_kind, v_reservation_status, v_reservation_created_at
  from public.generation_reservations
  where id = p_reservation_id
  for update;

  if v_reservation_user_id is null then
    raise exception 'reservation_not_found';
  end if;

  if v_reservation_user_id <> v_user_id then
    raise exception 'reservation_not_owned';
  end if;

  if v_reservation_kind <> 'course' then
    raise exception 'reservation_wrong_kind';
  end if;

  if v_reservation_status <> 'pending' then
    raise exception 'reservation_not_pending';
  end if;

  -- Ajouté par 0014, repris tel quel : une réservation "pending" vieille
  -- de plus de 15 minutes est déjà traitée comme abandonnée ailleurs dans
  -- le système (reserve_generation_slot(), 0007) — elle ne doit jamais
  -- pouvoir servir à enregistrer une formation.
  if v_reservation_created_at < now() - interval '15 minutes' then
    raise exception 'reservation_expired';
  end if;

  if p_course->>'topic' is null or p_course->>'title' is null
     or p_course->>'domain' is null or p_course->>'level' is null
     or p_course->>'introduction' is null or p_course->>'summary' is null
  then
    raise exception 'invalid_course_payload: champ obligatoire manquant';
  end if;

  if jsonb_typeof(p_course->'modules') is distinct from 'array'
     or jsonb_array_length(p_course->'modules') = 0
  then
    raise exception 'invalid_course_payload: au moins un module est requis';
  end if;

  insert into public.courses (
    user_id, topic, title, domain, level, introduction, objectives, summary, key_points
  ) values (
    v_user_id,
    p_course->>'topic',
    p_course->>'title',
    p_course->>'domain',
    p_course->>'level',
    p_course->>'introduction',
    coalesce(p_course->'objectives', '[]'::jsonb),
    p_course->>'summary',
    coalesce(p_course->'keyPoints', '[]'::jsonb)
  )
  returning id into v_course_id;

  for v_module in select jsonb_array_elements(p_course->'modules')
  loop
    insert into public.course_modules (course_id, position, title)
    values (v_course_id, (v_module->>'position')::int, v_module->>'title')
    returning id into v_module_id;

    -- `position_in_module` est dérivée ici (rang d'apparition dans le
    -- tableau JSON de ce module), jamais transmise par l'appelant — voir
    -- 0012 pour le détail de cette garantie, inchangée.
    v_chapter_ord := 0;
    for v_chapter in select jsonb_array_elements(v_module->'chapters')
    loop
      -- `exercise_prompt`/`exercise_solution` (ajout de cette migration) :
      -- `v_chapter->'exercise'` est NULL si la clé est absente ou vaut
      -- JSON null (cas normal d'une leçon sans exercice) — `->>'prompt'`/
      -- `->>'solution'` sur un jsonb NULL renvoie alors NULL, jamais une
      -- erreur, donc ces deux colonnes restent simplement NULL.
      insert into public.course_chapters (
        course_id, position, title, explanation, key_takeaway, module_id, position_in_module,
        exercise_prompt, exercise_solution
      ) values (
        v_course_id,
        (v_chapter->>'position')::int,
        v_chapter->>'title',
        v_chapter->>'explanation',
        v_chapter->>'keyTakeaway',
        v_module_id,
        v_chapter_ord,
        v_chapter->'exercise'->>'prompt',
        v_chapter->'exercise'->>'solution'
      )
      returning id into v_chapter_id;

      insert into public.course_examples (
        chapter_id, description, is_real, source_url, source_title
      ) values (
        v_chapter_id,
        v_chapter->'example'->>'description',
        coalesce((v_chapter->'example'->>'isReal')::boolean, false),
        v_chapter->'example'->>'sourceUrl',
        v_chapter->'example'->>'sourceTitle'
      );

      v_chapter_ord := v_chapter_ord + 1;
    end loop;

    if jsonb_typeof(v_module->'quiz') = 'array' and jsonb_array_length(v_module->'quiz') > 0 then
      insert into public.quizzes (course_id, module_id, kind, position)
      values (v_course_id, v_module_id, 'module', (v_module->>'position')::int)
      returning id into v_quiz_id;

      for v_question in select jsonb_array_elements(v_module->'quiz')
      loop
        insert into public.course_quiz_questions (
          course_id, quiz_id, position, chapter_index, question, choices,
          correct_choice_index, correct_choice_indexes, question_type, explanation
        ) values (
          v_course_id,
          v_quiz_id,
          (v_question->>'position')::int,
          (v_question->>'chapterIndex')::int,
          v_question->>'question',
          coalesce(v_question->'choices', '[]'::jsonb),
          (v_question->>'correctChoiceIndex')::int,
          -- `->` (et non `->>`) pour rester en jsonb ; `nullif` normalise
          -- en vraie valeur SQL NULL le cas où la clé vaut explicitement
          -- `null` en JSON.
          nullif(v_question->'correctChoiceIndexes', 'null'::jsonb),
          coalesce(v_question->>'questionType', 'single_choice'),
          v_question->>'explanation'
        );
      end loop;
    end if;
  end loop;

  -- Quiz final (Prompt 05.8, puis 0013) : inchangé par cette migration.
  v_final_quiz := p_course->'quiz';
  if jsonb_typeof(v_final_quiz) = 'array' and jsonb_array_length(v_final_quiz) > 0 then
    insert into public.quizzes (course_id, module_id, kind, position)
    values (v_course_id, null, 'final', 0)
    returning id into v_quiz_id;

    for v_question in select jsonb_array_elements(v_final_quiz)
    loop
      insert into public.course_quiz_questions (
        course_id, quiz_id, position, chapter_index, question, choices,
        correct_choice_index, correct_choice_indexes, question_type, explanation
      ) values (
        v_course_id,
        v_quiz_id,
        (v_question->>'position')::int,
        (v_question->>'chapterIndex')::int,
        v_question->>'question',
        coalesce(v_question->'choices', '[]'::jsonb),
        (v_question->>'correctChoiceIndex')::int,
        nullif(v_question->'correctChoiceIndexes', 'null'::jsonb),
        coalesce(v_question->>'questionType', 'single_choice'),
        v_question->>'explanation'
      );
    end loop;
  end if;

  -- Consomme la réservation, dans la MÊME invocation que tout le reste —
  -- voir 0012 pour le détail, inchangé.
  update public.generation_reservations
  set status = 'completed',
      resolved_at = now(),
      resource_id = v_course_id
  where id = p_reservation_id
    and user_id = v_user_id
    and kind = 'course'
    and status = 'pending';

  return v_course_id;
end;
$$;

revoke all on function public.save_generated_course(jsonb, uuid) from public;
grant execute on function public.save_generated_course(jsonb, uuid) to authenticated;
