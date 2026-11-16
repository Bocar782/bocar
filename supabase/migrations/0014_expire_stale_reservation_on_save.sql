-- Empêche qu'une réservation de génération devenue "périmée" (pending
-- depuis plus de 15 minutes) puisse malgré tout être utilisée pour
-- enregistrer une formation (Prompt 05.9, dernières sécurisations).
-- À exécuter après 0013_update_save_generated_course_quiz_types.sql
-- (déjà exécutée sur Supabase — NE PAS la modifier ni la rejouer).
--
-- Constat (audit) : reserve_generation_slot() (0007) traite déjà toute
-- réservation "pending" vieille de plus de 15 minutes comme abandonnée et
-- la passe à "released" — mais UNIQUEMENT de façon paresseuse, au moment
-- où CE MÊME utilisateur tente une NOUVELLE réservation du même type. Tant
-- qu'il ne retente rien, la ligne reste "pending" indéfiniment. Or
-- save_generated_course() (0012, mise à jour par 0013) ne vérifie que
-- `status = 'pending'`, jamais son ancienneté : si, par un scénario
-- pathologique (fonction serverless anormalement longue, requête
-- survivant au-delà de la fenêtre de 15 minutes que le système lui-même
-- considère comme abandon), un appel tardif à save_generated_course()
-- survient malgré tout avec cet identifiant de réservation, il
-- réussirait à enregistrer la formation en utilisant une réservation que
-- le reste du système traite déjà comme abandonnée — incohérence entre
-- "abandon déclaré à 15 minutes" et "utilisation encore acceptée après".
--
-- Correction : cette migration redéfinit `save_generated_course(jsonb,
-- uuid)` — MÊME nom, MÊMES paramètres, donc `create or replace function`
-- la met à jour en place sans toucher à sa signature ni à son
-- `revoke`/`grant`. Le SEUL changement fonctionnel par rapport à 0013 est
-- l'ajout d'une vérification de fraîcheur de la réservation : si
-- `created_at` a plus de 15 minutes (même littéral que 0007, à garder
-- manuellement synchronisé avec lui), la fonction lève
-- `reservation_expired` au lieu de poursuivre — AVANT toute écriture dans
-- `courses`/`course_modules`/`course_chapters`/etc., donc rien n'est
-- enregistré. Aucune ligne du corps de la fonction n'est modifiée au-delà
-- de cet ajout.
--
-- Cette migration ne LIBÈRE PAS elle-même la réservation expirée (elle ne
-- touche à aucune ligne de generation_reservations, uniquement à une
-- lecture) : elle se contente de refuser de l'utiliser. La libération
-- effective reste le rôle existant de route.ts, qui appelle déjà
-- releaseReservation()/resolve_generation_slot() dans son `catch` dès que
-- saveCourse() échoue — ce qui couvre maintenant aussi ce nouveau cas
-- d'erreur, sans aucun changement côté TypeScript. Une réservation encore
-- dans sa fenêtre de 15 minutes, utilisée par une génération légitime en
-- cours, n'est jamais affectée par ce changement : seule une réservation
-- déjà plus vieille que la fenêtre que le système lui-même définit comme
-- abandon peut déclencher ce refus.
--
-- Conservé à l'identique (aucune régression visée, voir 0012/0013) :
-- * Toutes les autres vérifications de sécurité sur la réservation :
--   existence, propriété (`auth.uid()`), type `course`, statut `pending`,
--   verrouillage `select ... for update` dès la lecture.
-- * `security definer` et `set search_path = ''`.
-- * L'atomicité : toujours une seule invocation PL/pgSQL, donc toujours
--   annulée entièrement (formation ET réservation) si quoi que ce soit
--   échoue à n'importe quelle étape.
-- * Le comportement des modules, leçons, exemples, quiz de module et quiz
--   final : bit pour bit identique à 0013.
-- * Les permissions : `revoke all ... from public` puis
--   `grant execute ... to authenticated`, répétées ci-dessous (idempotent,
--   sans effet si déjà en l'état).
--
-- Ne supprime ni ne modifie aucune donnée existante : cette migration ne
-- touche qu'à la DÉFINITION de la fonction, jamais aux lignes déjà
-- enregistrées par des appels précédents.
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

  -- Ajout de cette migration (Prompt 05.9, dernières sécurisations) : une
  -- réservation "pending" vieille de plus de 15 minutes est déjà traitée
  -- comme abandonnée ailleurs dans le système (reserve_generation_slot(),
  -- 0007) — elle ne doit jamais pouvoir servir à enregistrer une
  -- formation, même si personne n'a encore déclenché son passage effectif
  -- à "released". Même seuil littéral que 0007, à garder synchronisé
  -- manuellement avec lui.
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
    -- tableau JSON de ce module), jamais transmise par l'appelant : pour
    -- l'unique module d'aujourd'hui, ça reproduit exactement le
    -- comportement actuel (position_in_module = position globale, les
    -- deux tableaux étant dans le même ordre) ; pour plusieurs modules,
    -- ça garantit par construction une numérotation 0..n-1 sans trou ni
    -- doublon au sein de chaque module, cohérente avec l'index unique
    -- (module_id, position_in_module) de 0008.
    v_chapter_ord := 0;
    for v_chapter in select jsonb_array_elements(v_module->'chapters')
    loop
      insert into public.course_chapters (
        course_id, position, title, explanation, key_takeaway, module_id, position_in_module
      ) values (
        v_course_id,
        (v_chapter->>'position')::int,
        v_chapter->>'title',
        v_chapter->>'explanation',
        v_chapter->>'keyTakeaway',
        v_module_id,
        v_chapter_ord
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
          -- `null` en JSON (sans quoi la contrainte CHECK de cohérence de
          -- 0010, qui teste `IS NULL`, serait violée par une valeur jsonb
          -- "null" non vide au sens SQL).
          nullif(v_question->'correctChoiceIndexes', 'null'::jsonb),
          coalesce(v_question->>'questionType', 'single_choice'),
          v_question->>'explanation'
        );
      end loop;
    end if;
  end loop;

  -- Quiz final (Prompt 05.8, puis 0013) : enregistre question_type et
  -- correct_choice_indexes, exactement comme le bloc d'insertion du quiz
  -- de module ci-dessus — inchangé par cette migration.
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

  -- Consomme la réservation, dans la MÊME invocation que tout le reste :
  -- si une erreur survient n'importe où au-dessus (y compris le nouveau
  -- contrôle de fraîcheur ajouté par cette migration), cette écriture est
  -- annulée avec tout le reste — la réservation reste alors 'pending', et
  -- la route appelante peut la libérer normalement (voir route.ts). Ce
  -- `where` répète volontairement les mêmes conditions que le
  -- `select ... for update` ci-dessus (ceinture-bretelles) ; elles sont
  -- déjà garanties vraies à ce stade puisque la ligne est verrouillée
  -- depuis le début de cette transaction et qu'aucune autre transaction
  -- n'a pu la modifier entre-temps.
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
