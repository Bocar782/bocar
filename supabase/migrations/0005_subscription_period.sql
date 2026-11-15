-- Ajoute le début de la période de facturation en cours, nécessaire pour
-- réinitialiser le quota mensuel du plan Pro (3 formations / période).
-- À exécuter après 0004_subscriptions.sql.

alter table public.subscriptions
  add column if not exists current_period_start timestamptz;
