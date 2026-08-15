# @mou7asib/db

Prisma schema, migrations, and the generated client — the single source of truth for the
database shape. Prisma 7 on the query-compiler/driver-adapter architecture (`@prisma/adapter-pg`),
no Rust query engine.

## Two roles, on purpose — read this before touching auth or RLS

Local dev (and every other environment) uses **two different Postgres credentials**:

| Env var | Role | Used by | Why |
|---|---|---|---|
| `DATABASE_URL` | `mou7asib` (owner) | `prisma migrate`/`generate`, `npm run db:seed`, the Prisma CLI | Needs DDL rights (CREATE TABLE, CREATE POLICY, ...) |
| `APP_DATABASE_URL` | `mou7asib_app` (restricted) | Everything the running application queries through — `packages/db/src/index.ts`'s exported `prisma` client, and therefore `withTenant()` too | This is the role Row Level Security actually applies to |

**Do not collapse these into one.** Postgres superusers, and any role with the
`BYPASSRLS` attribute, unconditionally bypass Row Level Security — `FORCE ROW LEVEL
SECURITY` does not override this, and there is no query-time flag that does either. The
official `postgres` Docker image's `POSTGRES_USER` is always created as a superuser, so
if the app queried through that same role, every RLS policy in the phase 1 migration
would silently do nothing. This is exactly the bug the tenant-isolation test caught —
see `db-init/01-app-role.sql` (repo root) for the full writeup and the fix, and
`src/withTenant.test.ts` for the test that would catch a regression.

**Deploying somewhere else:** create the equivalent split explicitly. Do not reuse
whatever admin/owner credential a managed Postgres provider hands you as the
application's runtime credential — provision a second, non-superuser, non-`BYPASSRLS`
role with only `SELECT/INSERT/UPDATE/DELETE` on the app's tables, same as
`db-init/01-app-role.sql` does for local dev.

## Row Level Security

Enabled + **forced** (`ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`) on
every tenant-owned business-data table: `documents`, `extraction_jobs`,
`extraction_attempts`, `extracted_fields`, `audit_logs`. Each has one policy:

```sql
USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
WITH CHECK (...)
```

`NULLIF(..., '')` matters: once a custom GUC like `app.tenant_id` has been touched by
`SET LOCAL`/`set_config` in a session, Postgres can report it back as `''` rather than
`NULL` on a later, unrelated transaction over a reused/pooled connection — casting `''`
straight to `::uuid` throws instead of just failing the row match. See the
`fix_rls_empty_string_guc` migration for the full story.

**`tenant_memberships` and `sessions` are deliberately not RLS'd.** They're
identity-plane tables, not business data — a membership/session row is looked up *to
determine* which tenant a request should even be scoped to, which is a bootstrapping
cycle no `app.tenant_id` policy can resolve cleanly (you'd need the tenant ID before
you've looked up which tenant to use). They're protected by explicit application-level
scoping instead (`userId = the authenticated session's own user`, see
`apps/web/lib/auth.ts`), which is both correct and simpler for tables that are
inherently cross-tenant by nature.

## `withTenant()`

```ts
import { withTenant } from "@mou7asib/db";

const documents = await withTenant(session.tenantId, (tx) =>
  tx.document.findMany({ where: { tenantId: session.tenantId, deletedAt: null } }),
);
```

Every query against a business-data table must go through this, not the bare `prisma`
export — it opens a transaction and sets `app.tenant_id` for it via `set_config(...,
true)` (Postgres's parameterized equivalent of `SET LOCAL`, scoped to that transaction
only). CLAUDE.md §8.1: RLS is the backstop, the explicit `tenantId` filter in the query
itself is still the primary control — pass both, don't rely on RLS alone to save you
from forgetting the `WHERE`.

`prisma` (the bare export) is still correct for identity-plane tables (`users`,
`tenant_memberships`, `sessions`) and for `tenants` itself, none of which are RLS'd.

## Setup

```
npm run db:up          # starts local Postgres (compose.yaml), applies db-init/ on first boot
npm run db:migrate     # applies pending migrations (uses DATABASE_URL)
npm run db:seed        # idempotent demo-tenant seed
```

If you're on an **already-initialized** local volume from before the role split existed,
`db-init/`'s init script won't have run (Postgres only runs `docker-entrypoint-initdb.d/`
on a brand-new volume) — apply it by hand once:

```
docker exec -i mou7asib-pg psql -U mou7asib -d mou7asib < ../../db-init/01-app-role.sql
```

## Tests

```
npm run test --workspace @mou7asib/db
```

Integration tests against the real local Postgres (CLAUDE.md §12 — not mocked), run
sequentially (`vitest.config.ts`'s `fileParallelism: false`) since they share one
connection pool. `withTenant.test.ts` is the tenant-isolation proof CLAUDE.md §8.1
requires for every new tenant-owned model — extend it, don't replace it, when adding the
next one (the ledger's `JournalEntry`/`Account` tables in phase 2, for instance).
