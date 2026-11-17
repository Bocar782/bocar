-- Corrige la faille critique de l'audit 05.17 (Prompt 05.17.1) : les
-- policies RLS `for all` sur `courses`, `course_chapters`,
-- `course_examples`, `course_modules`, `quizzes`, `course_quiz_questions`
-- et `deep_analyses` autorisaient un utilisateur authentifié à écrire
-- DIRECTEMENT dans ces tables via l'API REST/PostgREST standard
-- (`supabase.from(...).insert(...)`, avec son propre JWT), en contournant
-- entièrement `reserve_generation_slot()`/`save_generated_course()` et
-- leur vérification de quota (0007/0012-0015). Contrairement à
-- `generation_reservations`, `quiz_attempts` et `chat_rate_limit_log`, qui
-- n'ont volontairement qu'une policy SELECT depuis leur création (0007,
-- 0011, 0016), ces 7 tables — plus anciennes, créées avant l'arrivée du
-- système de quota — n'avaient jamais été alignées sur ce même modèle.
-- À exécuter après 0019_harden_security_definer_search_path.sql et après
-- la migration 0018 déjà appliquée sur Supabase (son contenu n'est pas
-- présent dans ce dépôt — NE PAS la modifier ni la rejouer, et ne pas
-- rejouer non plus 0019).
--
-- Analyse préalable (audit 05.17, confirmée par relecture de 0001 à 0018
-- et par recherche exhaustive de tout appel `.from(...).insert/update/
-- delete/upsert(...)` sur ces 7 tables dans tout le code applicatif) :
-- aucune écriture légitime directe (hors RPC) n'existe pour
-- `course_chapters`, `course_examples`, `course_modules`, `quizzes` et
-- `course_quiz_questions` — seul `save_generated_course()` y écrit, et
-- cette fonction, SECURITY DEFINER, s'exécute avec les droits de son
-- PROPRIÉTAIRE (celui qui a créé la table via les migrations), qui
-- contourne nativement RLS sur les tables qu'il possède (comportement
-- standard de Postgres pour l'owner d'une table, tant que
-- `FORCE ROW LEVEL SECURITY` n'est pas activé — ce qui n'est le cas
-- d'aucune table ici) : retirer les policies d'écriture directe sur ces
-- 5 tables n'a donc AUCUN effet sur `save_generated_course()`, uniquement
-- sur un appel REST direct du navigateur.
--
-- En revanche, DEUX écritures légitimes directes existaient réellement et
-- auraient été cassées par un simple retrait de policy :
-- * `courses` : `src/lib/courses/progress-actions.ts`,
--   `updateChapterProgress()` (met à jour `current_chapter_index`,
--   `last_accessed_at`) et `recordQuizScore()` (met à jour `quiz_score`,
--   `quiz_total`, `quiz_completed_at` — code mort aujourd'hui, plus appelé
--   nulle part depuis que `submit_quiz_attempt()` fait cette mise à jour
--   pour le quiz final, mais toujours exporté). Aucune des deux ne crée de
--   ligne ni ne consomme de quota — seulement des colonnes de suivi sur
--   une formation déjà existante et déjà possédée par l'utilisateur.
-- * `deep_analyses` : `src/lib/analysis/persist.ts`, `saveDeepAnalysis()`
--   faisait un `insert()` direct (jamais de RPC pour cette table, à la
--   différence de `save_generated_course()` pour les formations) — c'est
--   exactement la même faille que celle corrigée sur `courses` par 0012,
--   jamais appliquée à `deep_analyses`.
--
-- Correction : les 7 policies `*_owner_all` deviennent des policies
-- `*_owner_select` (lecture seule par le propriétaire, identique au
-- modèle de `generation_reservations`/`quiz_attempts`/
-- `chat_rate_limit_log`). Les deux écritures légitimes identifiées
-- ci-dessus sont déplacées vers trois nouvelles fonctions SECURITY
-- DEFINER, qui vérifient la propriété via `auth.uid()` (jamais un
-- paramètre) exactement comme toutes les fonctions existantes du schéma :
-- * `update_chapter_progress(p_course_id, p_chapter_index)` — remplace
--   l'update direct de `updateChapterProgress()`, champ pour champ.
-- * `record_quiz_score(p_course_id, p_score, p_total)` — remplace
--   l'update direct de `recordQuizScore()`, champ pour champ.
-- * `save_generated_analysis(p_analysis, p_reservation_id)` — remplace
--   l'insert direct de `saveDeepAnalysis()`, en reprenant EXACTEMENT le
--   même schéma de vérification de réservation que
--   `save_generated_course()` (existence, propriété, type `analysis`,
--   statut `pending`, fraîcheur de 15 minutes — voir 0014/0015) : comme
--   pour les formations, la réservation est marquée `completed` dans la
--   MÊME transaction que l'insertion, ce qui corrige au passage
--   l'écriture/consommation non atomique relevée dans l'audit 05.17
--   (section « synchronisation ») pour les analyses.
--
-- Aucune fonctionnalité n'est supprimée : chaque écriture directe
-- identifiée ci-dessus continue de fonctionner, simplement via une
-- fonction dédiée plutôt qu'un appel REST direct — les trois fichiers
-- TypeScript concernés sont mis à jour dans le même commit que cette
-- migration pour appeler ces fonctions.

-- ---------------------------------------------------------------------
-- 1. courses : for all -> for select uniquement.
-- ---------------------------------------------------------------------
drop policy if exists "courses_owner_all" on public.courses;
drop policy if exists "courses_owner_select" on public.courses;
create policy "courses_owner_select"
  on public.courses
  for select
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 2. course_chapters : for all -> for select uniquement.
-- ---------------------------------------------------------------------
drop policy if exists "course_chapters_owner_all" on public.course_chapters;
drop policy if exists "course_chapters_owner_select" on public.course_chapters;
create policy "course_chapters_owner_select"
  on public.course_chapters
  for select
  using (
    exists (
      select 1 from public.courses
      where courses.id = course_chapters.course_id
        and courses.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- 3. course_examples : for all -> for select uniquement.
-- ---------------------------------------------------------------------
drop policy if exists "course_examples_owner_all" on public.course_examples;
drop policy if exists "course_examples_owner_select" on public.course_examples;
create policy "course_examples_owner_select"
  on public.course_examples
  for select
  using (
    exists (
      select 1 from public.course_chapters
      join public.courses on courses.id = course_chapters.course_id
      where course_chapters.id = course_examples.chapter_id
        and courses.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- 4. course_modules : for all -> for select uniquement.
-- ---------------------------------------------------------------------
drop policy if exists "course_modules_owner_all" on public.course_modules;
drop policy if exists "course_modules_owner_select" on public.course_modules;
create policy "course_modules_owner_select"
  on public.course_modules
  for select
  using (
    exists (
      select 1 from public.courses
      where courses.id = course_modules.course_id
        and courses.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- 5. quizzes : for all -> for select uniquement.
-- ---------------------------------------------------------------------
drop policy if exists "quizzes_owner_all" on public.quizzes;
drop policy if exists "quizzes_owner_select" on public.quizzes;
create policy "quizzes_owner_select"
  on public.quizzes
  for select
  using (
    exists (
      select 1 from public.courses
      where courses.id = quizzes.course_id
        and courses.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- 6. course_quiz_questions : for all -> for select uniquement.
-- ---------------------------------------------------------------------
drop policy if exists "course_quiz_questions_owner_all" on public.course_quiz_questions;
drop policy if exists "course_quiz_questions_owner_select" on public.course_quiz_questions;
create policy "course_quiz_questions_owner_select"
  on public.course_quiz_questions
  for select
  using (
    exists (
      select 1 from public.courses
      where courses.id = course_quiz_questions.course_id
        and courses.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- 7. deep_analyses : for all -> for select uniquement.
-- ---------------------------------------------------------------------
drop policy if exists "deep_analyses_owner_all" on public.deep_analyses;
drop policy if exists "deep_analyses_owner_select" on public.deep_analyses;
create policy "deep_analyses_owner_select"
  on public.deep_analyses
  for select
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 8. update_chapter_progress : remplace l'update direct de
--    updateChapterProgress() (src/lib/courses/progress-actions.ts).
--    Même colonnes, même comportement (y compris l'absence de validation
--    de bornes sur p_chapter_index, déjà absente côté TypeScript — aucun
--    changement de logique métier).
-- ---------------------------------------------------------------------
create or replace function public.update_chapter_progress(
  p_course_id uuid,
  p_chapter_index int
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

  update public.courses
  set current_chapter_index = p_chapter_index,
      last_accessed_at = now()
  where id = p_course_id
    and user_id = v_user_id;

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.update_chapter_progress(uuid, int) from public;
grant execute on function public.update_chapter_progress(uuid, int) to authenticated;

-- ---------------------------------------------------------------------
-- 9. record_quiz_score : remplace l'update direct de recordQuizScore()
--    (src/lib/courses/progress-actions.ts — actuellement du code mort,
--    conservé fonctionnel au cas où un futur appelant en dépendrait,
--    exactement comme son équivalent TypeScript).
-- ---------------------------------------------------------------------
create or replace function public.record_quiz_score(
  p_course_id uuid,
  p_score int,
  p_total int
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

  update public.courses
  set quiz_score = p_score,
      quiz_total = p_total,
      quiz_completed_at = now()
  where id = p_course_id
    and user_id = v_user_id;

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.record_quiz_score(uuid, int, int) from public;
grant execute on function public.record_quiz_score(uuid, int, int) to authenticated;

-- ---------------------------------------------------------------------
-- 10. save_generated_analysis : remplace l'insert direct de
--     saveDeepAnalysis() (src/lib/analysis/persist.ts). Reprend
--     exactement le schéma de vérification de réservation de
--     save_generated_course() (0012, durci par 0014/0015) : existence,
--     propriété (auth.uid()), type 'analysis', statut 'pending',
--     fraîcheur de 15 minutes. La réservation est marquée 'completed'
--     (resource_id = l'analyse créée) dans la MÊME transaction que
--     l'insertion — si quoi que ce soit échoue, tout est annulé ensemble,
--     exactement comme pour les formations.
-- ---------------------------------------------------------------------
create or replace function public.save_generated_analysis(
  p_analysis jsonb,
  p_reservation_id uuid
) returns uuid
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
  v_analysis_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if p_reservation_id is null then
    raise exception 'missing_reservation';
  end if;

  -- Verrouille la ligne de réservation dès sa lecture : même mécanisme
  -- que save_generated_course() (0012) — un second appel concurrent avec
  -- le même p_reservation_id attend que cette transaction committe (ou
  -- s'annule) avant de pouvoir la lire à son tour.
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

  if v_reservation_kind <> 'analysis' then
    raise exception 'reservation_wrong_kind';
  end if;

  if v_reservation_status <> 'pending' then
    raise exception 'reservation_not_pending';
  end if;

  -- Même garde-fou que 0014/0015 pour les formations : une réservation
  -- déjà traitée comme abandonnée ailleurs (reserve_generation_slot(),
  -- 0007) ne doit jamais pouvoir servir à enregistrer une analyse.
  if v_reservation_created_at < now() - interval '15 minutes' then
    raise exception 'reservation_expired';
  end if;

  if p_analysis->>'topic' is null or p_analysis->>'title' is null
     or p_analysis->>'domain' is null or p_analysis->>'introduction' is null
     or p_analysis->>'synthesis' is null
  then
    raise exception 'invalid_analysis_payload: champ obligatoire manquant';
  end if;

  insert into public.deep_analyses (
    user_id, topic, title, domain, introduction, sections, synthesis, key_lessons, sources
  ) values (
    v_user_id,
    p_analysis->>'topic',
    p_analysis->>'title',
    p_analysis->>'domain',
    p_analysis->>'introduction',
    coalesce(p_analysis->'sections', '[]'::jsonb),
    p_analysis->>'synthesis',
    coalesce(p_analysis->'keyLessons', '[]'::jsonb),
    coalesce(p_analysis->'sources', '[]'::jsonb)
  )
  returning id into v_analysis_id;

  -- Consomme la réservation, dans la MÊME invocation que l'insertion :
  -- corrige la race condition relevée dans l'audit 05.17 (sauvegarde et
  -- consommation de réservation non atomiques pour les analyses).
  update public.generation_reservations
  set status = 'completed',
      resolved_at = now(),
      resource_id = v_analysis_id
  where id = p_reservation_id
    and user_id = v_user_id
    and kind = 'analysis'
    and status = 'pending';

  return v_analysis_id;
end;
$$;

revoke all on function public.save_generated_analysis(jsonb, uuid) from public;
grant execute on function public.save_generated_analysis(jsonb, uuid) to authenticated;
