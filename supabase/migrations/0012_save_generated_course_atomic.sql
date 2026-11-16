-- Sauvegarde atomique d'une formation générée (correction du Prompt 05.6),
-- avec consommation vérifiée de la réservation de quota (deuxième
-- correction : faille de contournement de quota).
-- À exécuter après 0011_quiz_attempts.sql.
--
-- Constat corrigé une première fois : jusqu'à présent, `saveCourse()`
-- (persist.ts) enregistrait une formation via une SÉQUENCE d'appels REST
-- indépendants (courses -> course_modules -> course_chapters ->
-- course_examples -> quizzes/course_quiz_questions pour le quiz final ->
-- idem pour le(s) quiz de module). Aucune transaction n'englobait cette
-- séquence : une erreur en cours de route (ex. panne réseau transitoire,
-- contrainte violée sur une étape tardive) laissait les étapes déjà
-- réussies commitées en base — une formation partiellement enregistrée
-- (orpheline), que rien ne venait ensuite nettoyer.
--
-- Solution (inchangée) : une seule fonction SECURITY DEFINER qui reçoit
-- toute la formation déjà générée et validée côté application (Zod, voir
-- generate.ts) sous forme d'un unique paramètre JSONB, et effectue TOUTES
-- les insertions en une seule invocation. Comme toute fonction PL/pgSQL
-- invoquée comme une instruction unique, une exception non interceptée
-- ici annule automatiquement tout ce que la fonction a déjà écrit durant
-- cet appel (c'est l'atomicité native de PostgreSQL pour une instruction
-- unique — aucun BEGIN/COMMIT explicite n'est nécessaire, ni même
-- possible, dans le corps d'une fonction ordinaire) : soit la formation
-- entière (modules, leçons, exemples, quiz final, quiz de module,
-- questions) est enregistrée, soit rien ne l'est.
--
-- FAILLE CORRIGÉE ICI (identifiée avant toute exécution réelle sur
-- Supabase — cette fonction n'avait encore jamais tourné en production) :
-- la version précédente de `save_generated_course` était accordée au rôle
-- `authenticated` sans jamais vérifier l'existence d'une réservation de
-- quota (`generation_reservations`, voir 0007_generation_reservations.sql).
-- Un utilisateur pouvait donc appeler ce RPC directement depuis le
-- navigateur (avec son propre JWT, exactement comme reserve_generation_slot
-- l'est déjà) autant de fois qu'il le souhaitait, créant une formation à
-- chaque appel sans jamais passer par reserve_generation_slot() — donc sans
-- jamais être compté dans son quota Free/Pro. La route applicative
-- (/api/courses/generate) réservait bien une place avant génération, mais
-- rien côté base n'empêchait un appel DIRECT au RPC de sauvegarde de s'en
-- dispenser : la réservation n'était qu'une convention côté client, jamais
-- une condition vérifiée côté serveur par la fonction qui écrit réellement
-- les données.
--
-- Correction : `save_generated_course` exige désormais un second paramètre
-- `p_reservation_id`, et vérifie — dans la MÊME transaction que le reste —
-- que cette réservation :
--   1. existe,
--   2. appartient à auth.uid() (jamais à un autre utilisateur),
--   3. est de type 'course' (jamais 'analysis'),
--   4. est encore au statut 'pending' (jamais déjà 'completed' ni
--      'released').
-- La ligne est verrouillée dès sa lecture (`for update`), exactement comme
-- `submit_quiz_attempt` (0011) verrouille sa tentative : si deux appels
-- concurrents visent la même réservation, le second attend que le premier
-- ait committé (donc déjà fait passer le statut à 'completed') avant de la
-- lire à son tour — il la trouve alors déjà 'completed' et est rejeté.
-- Impossible que deux formations soient créées à partir d'une seule
-- réservation. La réservation est marquée 'completed' (avec
-- resource_id = id de la formation créée) tout à la fin, dans cette même
-- invocation : si quoi que ce soit échoue avant, y compris cette dernière
-- écriture, TOUT est annulé ensemble — formation et réservation incluses.
--
-- Sécurité :
-- * `auth.uid()` est l'unique source de l'identité du propriétaire — le
--   paramètre JSON ne contient et n'accepte aucun user_id, aucun id de
--   ressource existante (course_id/module_id/quiz_id) : tout est généré
--   ici même, dans la même invocation, donc structurellement impossible à
--   associer à la formation ou au module de quelqu'un d'autre (encore
--   plus strict que la protection RLS + trigger de 0010, qui restait
--   nécessaire pour un chemin d'écriture par id existant — chemin qui
--   n'existe plus du tout ici).
-- * SECURITY DEFINER, exactement comme reserve_generation_slot /
--   resolve_generation_slot (0007) et start_quiz_attempt/
--   submit_quiz_attempt (0011) : aucune policy RLS existante n'est
--   modifiée ni affaiblie (elles restent actives pour tout autre chemin
--   d'écriture direct, par exemple une future évolution qui insérerait
--   encore via l'API REST) ; cette fonction s'ajoute à côté, elle ne les
--   remplace pas. Les limites Free/Pro elles-mêmes (reserve_generation_slot)
--   ne sont pas modifiées par cette migration.
-- * `set search_path = pg_catalog, public` (et non simplement `public`) :
--   épingle explicitement pg_catalog en premier, pour ne dépendre d'aucun
--   schéma dont la position dans un search_path serait contrôlable par un
--   appelant non fiable, même si PostgreSQL recherche déjà pg_catalog en
--   priorité de façon implicite. Tous les objets de table sont en outre
--   explicitement qualifiés (`public.courses`, `public.quizzes`,
--   `public.generation_reservations`, etc.), jamais résolus par recherche
--   implicite dans le schéma courant.
-- * Validation de forme minimale ici (présence des champs obligatoires,
--   au moins un module) en défense en profondeur ; la validation complète
--   du contenu (Zod, types de question, bornes d'index...) reste faite
--   côté application avant l'appel, comme pour le reste du pipeline de
--   génération. Toute incohérence qui échapperait à cette validation et
--   violerait une contrainte SQL (NOT NULL, CHECK, contrainte d'unicité,
--   trigger de cohérence) fait simplement échouer l'appel entier, sans
--   aucune donnée partielle — même garantie que pour une incohérence
--   détectée explicitement ici.
--
-- Compatibilité : ne modifie aucune table, aucune policy RLS, aucun
-- trigger existant, aucune limite Free/Pro. Le quiz final (kind = 'final')
-- est enregistré exactement comme avant (question_type/
-- correct_choice_indexes non renseignés, donc valeurs par défaut
-- 'single_choice'/null comme aujourd'hui). Les anciennes formations (déjà
-- enregistrées avant cette migration, par l'ancien chemin séquentiel) ne
-- sont pas affectées : cette fonction ne fait qu'ajouter un nouveau chemin
-- d'écriture pour les formations futures.
--
-- Cette fonction n'ayant encore jamais été exécutée sur Supabase, cette
-- migration remplace directement le fichier 0012 (plutôt que d'ajouter une
-- migration 0013) : il n'existe aucune donnée réelle dépendant de
-- l'ancienne signature à un seul paramètre.
drop function if exists public.save_generated_course(jsonb);

create or replace function public.save_generated_course(
  p_course jsonb,
  p_reservation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_reservation_user_id uuid;
  v_reservation_kind text;
  v_reservation_status text;
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
  select user_id, kind, status
    into v_reservation_user_id, v_reservation_kind, v_reservation_status
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

  -- Quiz final : comportement inchangé, y compris le fait de ne pas
  -- renseigner question_type/correct_choice_indexes (les valeurs par
  -- défaut de colonne s'appliquent, comme avant cette migration).
  v_final_quiz := p_course->'quiz';
  if jsonb_typeof(v_final_quiz) = 'array' and jsonb_array_length(v_final_quiz) > 0 then
    insert into public.quizzes (course_id, module_id, kind, position)
    values (v_course_id, null, 'final', 0)
    returning id into v_quiz_id;

    for v_question in select jsonb_array_elements(v_final_quiz)
    loop
      insert into public.course_quiz_questions (
        course_id, quiz_id, position, chapter_index, question, choices,
        correct_choice_index, explanation
      ) values (
        v_course_id,
        v_quiz_id,
        (v_question->>'position')::int,
        (v_question->>'chapterIndex')::int,
        v_question->>'question',
        coalesce(v_question->'choices', '[]'::jsonb),
        (v_question->>'correctChoiceIndex')::int,
        v_question->>'explanation'
      );
    end loop;
  end if;

  -- Consomme la réservation, dans la MÊME invocation que tout le reste :
  -- si une erreur survient n'importe où au-dessus (y compris ici), cette
  -- écriture est annulée avec tout le reste — la réservation reste alors
  -- 'pending', et la route appelante peut la libérer normalement (voir
  -- route.ts). Ce `where` répète volontairement les mêmes conditions que
  -- le `select ... for update` ci-dessus (ceinture-bretelles) ; elles sont
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
