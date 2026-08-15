-- Local dev only, mirrors what a managed Postgres provider's role setup must do in every
-- other environment: split the migration/owner role from the runtime application role.
--
-- Why this exists (found by packages/db's tenant-isolation test, CLAUDE.md §8.1/§12):
-- POSTGRES_USER in the official postgres image is always created as the bootstrap
-- superuser, and Postgres roles with rolsuper OR rolbypassrls unconditionally bypass Row
-- Level Security — FORCE ROW LEVEL SECURITY does not override this, and the bootstrap
-- superuser cannot even have SUPERUSER stripped from it (Postgres refuses). The app was
-- silently getting zero RLS enforcement despite every policy from the phase 1 migration
-- being in place, because it connected as that same bootstrap role.
--
-- Fix: `mou7asib` (superuser) stays the migration/owner role — DATABASE_URL, used by
-- `prisma migrate`/`generate`/seed. A new `mou7asib_app` role, NOSUPERUSER/NOBYPASSRLS,
-- is what the application actually queries through at runtime (APP_DATABASE_URL,
-- packages/db/src/index.ts) — for that role, RLS is real.
--
-- Deployed/managed Postgres: create the equivalent split explicitly. Do not reuse
-- whatever admin/owner credential a provider hands you as the app's runtime credential.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mou7asib_app') THEN
    CREATE ROLE mou7asib_app WITH LOGIN PASSWORD 'devpassword_app' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

GRANT CONNECT ON DATABASE mou7asib TO mou7asib_app;
GRANT USAGE ON SCHEMA public TO mou7asib_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO mou7asib_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO mou7asib_app;

-- So a future migration's new tables/sequences (created by the `mou7asib` owner role)
-- grant mou7asib_app access automatically, without a second manual step per migration.
ALTER DEFAULT PRIVILEGES FOR ROLE mou7asib IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO mou7asib_app;
ALTER DEFAULT PRIVILEGES FOR ROLE mou7asib IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO mou7asib_app;
