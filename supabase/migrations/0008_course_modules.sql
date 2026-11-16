-- Architecture pédagogique Modules → Leçons.
-- À exécuter après 0007_generation_reservations.sql.
--
-- Une formation (`courses`) contient désormais des modules
-- (`course_modules`), et chaque module contient des leçons. Les leçons
-- restent portées par la table `course_chapters` existante (déjà utilisée
-- par les chapitres générés), simplement reliée à son module via la
-- nouvelle colonne `module_id`, avec sa propre position au sein du module
-- (`position_in_module`).
--
-- Compatibilité : la colonne `course_chapters.position` (position globale
-- dans la formation, 0-based) N'EST PAS MODIFIÉE. Tout le code existant qui
-- en dépend — chat contextuel par chapitre, suivi de progression
-- (`current_chapter_index`), verrouillage du plan gratuit, scrollspy de
-- lecture (`data-chapter-index`), quiz (`chapter_index`) — continue de
-- fonctionner à l'identique, sans aucune modification. `module_id` et
-- `position_in_module` sont des colonnes strictement additives, pour la
-- nouvelle architecture pédagogique ; rien n'en dépend encore côté
-- affichage (prévu pour une prochaine étape, non commencée ici).
--
-- Préparation pour plus tard (non construit dans cette migration) : les
-- leçons devront pouvoir accueillir différents types de contenu (texte,
-- images, schémas, encadrés, exercices). `course_chapters` reste pour
-- l'instant une leçon "tout en un" (explanation + key_takeaway + exemple
-- lié) ; une table de blocs de contenu typés viendra dans une migration
-- ultérieure, une fois validée.

create table if not exists public.course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  position int not null,
  title text not null,
  created_at timestamptz not null default now()
);

create index if not exists course_modules_course_id_position_idx
  on public.course_modules (course_id, position);

alter table public.course_modules enable row level security;

drop policy if exists "course_modules_owner_all" on public.course_modules;
create policy "course_modules_owner_all"
  on public.course_modules
  for all
  using (
    exists (
      select 1 from public.courses
      where courses.id = course_modules.course_id
        and courses.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.courses
      where courses.id = course_modules.course_id
        and courses.user_id = auth.uid()
    )
  );

-- Lien vers le module (nullable : une leçon sans module reste valide et
-- continue d'apparaître dans la liste plate `course_chapters`, seul le
-- regroupement par module serait alors absent pour elle) et position au
-- sein du module.
alter table public.course_chapters
  add column if not exists module_id uuid references public.course_modules (id) on delete cascade,
  add column if not exists position_in_module int;

create index if not exists course_chapters_module_id_position_idx
  on public.course_chapters (module_id, position_in_module);

-- Migration des formations existantes : chaque formation qui a des leçons
-- sans module se voit attribuer un module unique ("Module 1"), et toutes
-- ses leçons y sont rattachées en conservant leur ordre actuel
-- (position_in_module = position). Aucune ligne n'est supprimée ni
-- recréée : on ne fait qu'ajouter la relation manquante.
--
-- Idempotent : si cette migration est rejouée après avoir déjà tourné une
-- fois, `course_chapters.module_id` est déjà non nul pour toutes les
-- lignes concernées, donc `courses_to_migrate` ne sélectionne plus rien et
-- les étapes suivantes n'ont aucun effet (pas de module dupliqué).
with courses_to_migrate as (
  select distinct course_id
  from public.course_chapters
  where module_id is null
),
inserted_modules as (
  insert into public.course_modules (course_id, position, title)
  select course_id, 0, 'Module 1'
  from courses_to_migrate
  returning id, course_id
)
update public.course_chapters cc
set module_id = im.id,
    position_in_module = cc.position
from inserted_modules im
where cc.course_id = im.course_id
  and cc.module_id is null;

-- Renforce la policy RLS de `course_chapters` (définie à l'origine dans
-- 0001_courses.sql, dont le fichier n'est pas modifié ici — cette migration
-- fait évoluer la policy en base, comme toute migration ultérieure le
-- ferait). Sans ce renfort, une leçon pouvait être rattachée (en INSERT
-- comme en UPDATE) au module d'une AUTRE formation — y compris celle d'un
-- autre utilisateur — car la clause `with check`/`using` d'origine ne
-- vérifiait que la propriété de `course_id`, jamais la cohérence de
-- `module_id` avec cette formation. La contrainte de clé étrangère sur
-- `module_id` ne suffit pas à elle seule : Postgres fait toujours passer
-- les vérifications de clé étrangère au-dessus de la RLS, donc un module_id
-- existant mais appartenant à une autre formation (ou un autre utilisateur)
-- était accepté tant que l'utilisateur restait propriétaire de la leçon.
-- Testé : une leçon sans module (module_id is null) reste valide ; une
-- leçon dont le module appartient à une AUTRE formation est désormais
-- rejetée, aussi bien à la création qu'à la modification.
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
    and (
      module_id is null
      or exists (
        select 1 from public.course_modules
        where course_modules.id = course_chapters.module_id
          and course_modules.course_id = course_chapters.course_id
      )
    )
  );

-- Empêche les doublons de position, au niveau base de données (et pas
-- seulement par convention côté application). Placés après le backfill
-- ci-dessus pour valider l'état final des données existantes : si, par un
-- bug antérieur à cette migration, une formation avait déjà deux chapitres
-- partageant la même `position`, la création de l'index échouerait ici
-- avec une erreur explicite nommant la ligne en conflit, plutôt que de
-- laisser l'incohérence passer silencieusement — la migration entière est
-- alors annulée (un seul bloc transactionnel), sans aucune donnée modifiée
-- ni perdue.
create unique index if not exists course_modules_course_id_position_uniq
  on public.course_modules (course_id, position);

create unique index if not exists course_chapters_module_id_position_in_module_uniq
  on public.course_chapters (module_id, position_in_module)
  where module_id is not null;
