-- Historical production migration restored verbatim for migration-history parity.
--
-- This exact version/name is already recorded in the production
-- supabase_migrations.schema_migrations table. Keeping the original statement
-- in source makes local/fresh migration history reproducible. A later
-- reconciliation migration restores the canonical unique index so fresh
-- databases and production converge to the same final state.

drop index if exists public.profiles_stripe_account_id_unique;
