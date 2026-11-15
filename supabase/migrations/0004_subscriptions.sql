-- Statut d'abonnement Stripe (plan Pro), pour remplacer la vérification
-- "tout le monde est sur le plan gratuit" par un vrai statut payant.
-- À exécuter dans le SQL Editor du dashboard Supabase (ou via `supabase db push`),
-- après 0001_courses.sql, 0002_quiz.sql et 0003_progress.sql.

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text,
  status text not null default 'incomplete',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_stripe_customer_id_idx
  on public.subscriptions (stripe_customer_id);

create unique index if not exists subscriptions_stripe_subscription_id_idx
  on public.subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

alter table public.subscriptions enable row level security;

-- L'utilisateur peut lire son propre statut d'abonnement, mais seule la
-- route webhook (clé de service, qui contourne la RLS) peut écrire dessus.
drop policy if exists "subscriptions_owner_select" on public.subscriptions;
create policy "subscriptions_owner_select"
  on public.subscriptions
  for select
  using (auth.uid() = user_id);
