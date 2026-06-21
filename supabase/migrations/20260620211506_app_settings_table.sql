-- DB hygiene (M-C-DB-HYGIENE): formalize public.app_settings.
-- It is RLS-enabled + policy-attached by 20260620211507 and read by credits_enabled() and
-- getPricingCatalog, but it was created out-of-band on the live DB and had NO create-table
-- migration, so a clean replay from migrations/ failed at 20260620211507 ("relation
-- app_settings does not exist"). This create-if-not-exists makes the migration history
-- self-contained. Timestamped one step before 20260620211507 so a fresh replay creates it
-- first; it is a no-op on the live DB (the table already exists). RLS + the admin policy
-- stay in 20260620211507 (unchanged).
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
