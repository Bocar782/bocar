-- Analyses approfondies : études de cas réels (entrepreneurs, entreprises,
-- stratégies, réussites/échecs) avec sources, distinctes des formations
-- classiques. Contenu en lecture seule une fois généré, donc stocké en
-- jsonb plutôt que normalisé en tables chapitres/exemples séparées.
-- À exécuter après 0005_subscription_period.sql.

create table if not exists public.deep_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  topic text not null,
  title text not null,
  domain text not null,
  introduction text not null,
  sections jsonb not null default '[]'::jsonb,
  synthesis text not null,
  key_lessons jsonb not null default '[]'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists deep_analyses_user_id_created_at_idx
  on public.deep_analyses (user_id, created_at desc);

alter table public.deep_analyses enable row level security;

drop policy if exists "deep_analyses_owner_all" on public.deep_analyses;
create policy "deep_analyses_owner_all"
  on public.deep_analyses
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
