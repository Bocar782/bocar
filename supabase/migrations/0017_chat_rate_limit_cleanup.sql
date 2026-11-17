-- Nettoyage des anciennes entrées de chat_rate_limit_log (Prompt 05.16.2,
-- suite du correctif E1 de l'audit de sécurité 05.16 — voir
-- 0016_chat_rate_limit.sql, dont le fichier n'est pas modifié ici).
-- À exécuter après 0016_chat_rate_limit.sql (déjà exécutée sur Supabase —
-- NE PAS la modifier ni la rejouer).
--
-- Constat : chaque appel accepté à check_chat_rate_limit() insère une ligne
-- dans chat_rate_limit_log, jamais supprimée. Les deux seules lectures de
-- cette table (used_hour/used_day dans la même fonction) ne portent que sur
-- les 24 dernières heures : toute ligne plus ancienne qu'une journée ne sert
-- plus jamais à rien, pour aucun utilisateur, mais reste indéfiniment en
-- base — croissance non bornée, proportionnelle au nombre total de messages
-- envoyés par tous les comptes depuis le début de l'application.
--
-- Correction : redéfinit `check_chat_rate_limit()` — MÊME nom, AUCUN
-- paramètre, donc `create or replace function` la met à jour en place sans
-- toucher à sa signature ni à son `revoke`/`grant` (déjà corrects depuis
-- 0016, répétés ci-dessous par idempotence). Un seul ajout au corps de la
-- fonction : juste après le verrou advisory et juste avant les deux
-- comptages (heure/jour), une suppression des lignes de CET utilisateur
-- (`user_id = v_user_id`, jamais une autre portée) vieilles de plus de 24
-- heures.
--
-- Pourquoi à cet endroit précis :
-- * Après le verrou (`pg_advisory_xact_lock`) : un deuxième appel concurrent
--   pour le même utilisateur attend déjà ce verrou avant de lire quoi que
--   ce soit (voir 0016) — la suppression profite donc de la même
--   sérialisation, sans verrou supplémentaire ni risque de double
--   suppression concurrente.
-- * Avant les comptages : les deux `select count(*) ... where created_at >=
--   now() - interval '1 hour' / '24 hours'` ne peuvent de toute façon
--   JAMAIS compter une ligne vieille de plus de 24 heures (elle est hors de
--   la fenêtre '24 hours', donc a fortiori hors de la fenêtre '1 hour') —
--   la supprimer avant ou juste après ces deux `select` donne exactement le
--   même résultat de comptage. La placer AVANT est uniquement ce qui évite
--   de la recompter "pour rien" dans la lecture, et garde le nettoyage
--   regroupé avec le verrou en tête de fonction, avant toute logique de
--   quota — mais ce choix de place ne change aucune limite ni aucun
--   comptage : le périmètre temporel ('1 hour' / '24 hours') et les limites
--   (Free 15/h, 40/j ; Pro 50/h, 150/j) restent identiques à 0016.
--
-- Portée volontairement limitée à l'utilisateur courant (jamais une purge
-- globale) : cette fonction s'exécute avec les droits de l'utilisateur
-- authentifié qui l'appelle (via auth.uid()), donc une suppression plus
-- large violerait le même principe que le reste de 0016 (impossible
-- d'agir sur les données d'un autre utilisateur). Une purge globale des
-- lignes orphelines (utilisateurs inactifs qui ne rappellent plus jamais
-- check_chat_rate_limit()) reste un sujet séparé, hors du périmètre
-- demandé ici (par exemple un job pg_cron périodique, déjà évoqué comme
-- option complémentaire lors de la vérification précédente) : NON
-- implémentée par cette migration, qui ne modifie que la fonction
-- existante, par utilisateur et à la demande.
--
-- Sécurité (reprise à l'identique de 0016, voir ce fichier pour le détail
-- complet) :
-- * `security definer` et `set search_path = ''` inchangés ; toutes les
--   références de table restent explicitement qualifiées
--   (`public.chat_rate_limit_log`, `public.subscriptions`).
-- * Le DELETE est scopé par `user_id = v_user_id`, où v_user_id provient
--   uniquement de `auth.uid()` — jamais d'un paramètre, jamais falsifiable
--   depuis le navigateur. Combiné à la policy RLS SELECT-only existante
--   (aucune policy DELETE : seule cette fonction SECURITY DEFINER peut
--   supprimer une ligne), impossible pour un utilisateur de faire
--   supprimer les lignes d'un autre, par ce chemin ou par un appel REST
--   direct.
-- * Si le DELETE échoue pour une raison quelconque (contrainte, erreur
--   serveur transitoire), l'exception non interceptée fait échouer
--   l'invocation ENTIÈRE de check_chat_rate_limit() — comme pour toute
--   instruction de cette fonction PL/pgSQL : AUCUNE ligne n'est alors ni
--   comptée ni insérée, le `insert into chat_rate_limit_log` et le
--   `return query ... true` qui suivent ne sont jamais atteints. Un échec
--   de nettoyage ne peut donc jamais se traduire par un contournement de la
--   limitation (ni par un "ok" renvoyé à tort) : au pire, l'appel échoue
--   complètement et route.ts renvoie 503 sans jamais appeler Anthropic
--   (voir chat/route.ts, vérifié lors de l'audit du Prompt 05.16.1).
-- * Verrouillage inchangé : `pg_advisory_xact_lock(hashtext(v_user_id::text),
--   hashtext('chat_rate_limit'))`, toujours avant toute lecture/écriture de
--   chat_rate_limit_log.
--
-- Ne modifie aucune migration antérieure, aucune policy RLS, aucune table.
-- Ne supprime que des lignes déjà sans aucun effet sur les comptages
-- (strictement hors des deux fenêtres '1 hour'/'24 hours' utilisées pour
-- calculer used_hour/used_day) : les limites Free/Pro restent exactement
-- celles de 0016.
create or replace function public.check_chat_rate_limit()
returns table (
  ok boolean,
  is_pro boolean,
  limit_hour int,
  used_hour int,
  limit_day int,
  used_day int
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_sub_status text;
  v_is_pro boolean := false;
  v_limit_hour int;
  v_limit_day int;
  v_used_hour int;
  v_used_day int;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  -- Sérialise les appels concurrents pour cet utilisateur : un deuxième
  -- appel simultané attend que le premier ait validé et commité sa ligne
  -- (ou renoncé) avant de recompter à son tour.
  perform pg_advisory_xact_lock(hashtext(v_user_id::text), hashtext('chat_rate_limit'));

  -- Nettoyage (ajout de cette migration) : supprime les entrées de CET
  -- utilisateur vieilles de plus de 24 heures, avant tout comptage. Ces
  -- lignes sont déjà hors des deux fenêtres utilisées ci-dessous
  -- ('1 hour'/'24 hours') : leur suppression ne change donc aucun des
  -- comptages qui suivent, seulement la taille de la table dans le temps.
  delete from public.chat_rate_limit_log
  where user_id = v_user_id
    and created_at < now() - interval '24 hours';

  select s.status into v_sub_status
  from public.subscriptions s
  where s.user_id = v_user_id;

  v_is_pro := found and v_sub_status in ('active', 'trialing');

  -- Limites fixées en dur (voir le commentaire en tête de fichier 0016) :
  -- jamais transmises par l'appelant. Inchangées par cette migration.
  if v_is_pro then
    v_limit_hour := 50;
    v_limit_day := 150;
  else
    v_limit_hour := 15;
    v_limit_day := 40;
  end if;

  select count(*) into v_used_hour
  from public.chat_rate_limit_log
  where user_id = v_user_id
    and created_at >= now() - interval '1 hour';

  select count(*) into v_used_day
  from public.chat_rate_limit_log
  where user_id = v_user_id
    and created_at >= now() - interval '24 hours';

  if v_used_hour >= v_limit_hour or v_used_day >= v_limit_day then
    return query select false, v_is_pro, v_limit_hour, v_used_hour, v_limit_day, v_used_day;
    return;
  end if;

  insert into public.chat_rate_limit_log (user_id) values (v_user_id);

  return query select true, v_is_pro, v_limit_hour, v_used_hour + 1, v_limit_day, v_used_day + 1;
end;
$$;

revoke all on function public.check_chat_rate_limit() from public;
grant execute on function public.check_chat_rate_limit() to authenticated;
