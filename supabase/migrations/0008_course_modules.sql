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
