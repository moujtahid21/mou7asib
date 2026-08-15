# mou7asib

Web-based accounting SaaS for Moroccan small businesses (TPE/PME) — photograph or
upload an invoice, get it extracted, classified, and eventually booked against the
CGNC, with statutory filings prepared for review, never posted automatically. Full
scope and the domain rules are in `PROJECT_BRIEF.md` (what to build) and `CLAUDE.md`
(the non-negotiable rules for how) — **read `CLAUDE.md` before writing code here.**

## Status

Full scope accepted and being built for real, phased by dependency — see
[ADR 0007](docs/adr/0007-full-scope-rebuild.md) and `docs/build-order.md`'s "Shipped so
far" section for what's actually done vs. still `<UnderConstruction>`. Every screen in
the sidebar is reachable; only some are live.

Shipped: the design system (`packages/ui`); tenancy/auth/RLS (S2 — real signup,
mandatory TOTP MFA, sessions, five-role policy, FR/AR with RTL); the ledger (S3 —
double-entry engine, DB-enforced balance/append-only/period-lock, manual entry/post/
reverse, reachable at `/tva`); historical journal import (S4 — CSV only, per-file column
mapping, dry-run preview, sha256-based idempotency key, same balance/append-only rules as
manual entry — also at `/tva`); Réception redesign (phase 4 — the document list and
review screen moved onto `packages/ui`'s tokens, a two-column preview/fields layout, and a
manual posting panel wired to the real ledger, traceable back to the source document);
posting suggestions (S6 — retrieval/ranking over the tenant's own posted history by
supplier, matched precedent shown and pre-filled but never auto-posted, acceptance-rate
metric recorded via `AuditLog` and shown on `/documents`); the dashboard (phase 6 — real
cash/receivables/payables/charges KPIs, a real 6-month cash trend with no forecast, gross
receivables aging, and a real "à traiter" list, all computed live from the ledger); bank
reconciliation (S13 — CSV statement import, per-row idempotent, into a staging sub-ledger;
*lettrage* suggestions by exact amount + closest date over the tenant's own posted lines,
confirmed by a human, never auto-matched — reachable at `/rapprochement`); the TVA engine
(S7 — effective-dated rate resolution, mixed-rate invoice posting split by rate into
control accounts, a tenant-level régime setting that is never defaulted, a cash-payment
threshold warning. Every rate/threshold row is a `TODO(legal)`-marked placeholder per
CLAUDE.md §14 — see `docs/legal-inputs.md` L-01/L-02/L-13 — never presented as official);
outgoing invoicing (S8 — real per-tenant per-series sequential numbering proven
gap-free/reuse-free under real Postgres concurrency, a mentions validator blocking
finalisation, database-enforced immutability once finalized, corrections via *avoirs* —
reachable at `/facturation`. No PDF rendering or ledger auto-posting yet); Bilan/CPC
(S9 — a simplified class-level rollup, not the official CGNC line structure (L-63 is
`TODO(legal)`), with every line drillable to its journal entries and a property test
proving the actif==passif identity holds for any balanced ledger — also on `/tva`); TVA
declaration (S10 — a real, drillable figures pipeline over posted `34552`/`4455`
movements, a persisted export + audit trail via a new `tva:declare` permission, but the
"SIMPL export" is a labelled non-official placeholder text summary — the real DGI file
format (`L-22`) is this project's single largest unresolved unknown, also on `/tva`);
retenue à la source (S11 — a real rule-resolution engine and attestation renderer, but
the rule table ships with **zero rows** on purpose: unlike TVA, CLAUDE.md gives no RAS
rate at all to seed even as a placeholder, so every real evaluation today correctly
flags for manual review instead of defaulting to "no retenue" — verified live, also on
`/tva`); IS passage table (S12 — same posture as S11: `IsBracket`/
`IsCotisationMinimaleConfig` ship empty since CLAUDE.md gives no numbers, but the
worksheet snapshots the real CPC résultat comptable, `résultat fiscal` computation is
real and tested, and `IS dû = max(calculated IS, cotisation minimale)` — a structural
mechanism, not a rate — is implemented and ready; a human-validation lock (lighter than
the ledger's DB-enforced immutability) closes each worksheet — also on `/tva`); the
accountant surface (S14 — ADR 0004's R1 only, no Sage/Cegid connector: a real, scoped,
expiring `AccountantAccess` grant, deliberately not RLS'd for the same bootstrap-layer
reason as `TenantMembership`/`Session`, re-checked on every request rather than only at
switch time, so a revoked or expired grant loses access immediately even on an
already-open session — reachable at `/comptables`, owner-only to grant/revoke).

## Architecture

```
apps/
  web/          Next.js 16 (App Router) — the UI + BFF. Server Actions do the writing;
                the browser never holds a DB credential or provider API key.
  ai/           Python — the D1 extraction harness + D2's background extraction worker.
                Talks to Postgres directly, not to apps/web over HTTP (see apps/ai/README.md).
packages/
  db/           Prisma schema, migrations, the generated client, and withTenant() — the
                RLS-enforcing query wrapper every business-data query must go through.
                Read packages/db/README.md before touching auth or tenant isolation.
  ui/           The design system: tokens, AppShell, shared primitives. No build step —
                ships .tsx source, transpiled by consumers. See packages/ui/README.md.
  contracts/    Field metadata shared across the apps/web <-> apps/ai boundary.
  accounting/   The pure double-entry engine — no I/O, no Prisma, no Date.now().
                Balance/reversal invariants are property-tested (fast-check); the
                database triggers that actually enforce them live in packages/db's
                migrations, not here.
docs/
  adr/          Architecture decision records — read these before assuming an
                architectural question is still open.
  build-order.md   The phase-by-phase plan and what's shipped.
  decision-log.md  Answers to questions the ADRs/build order were blocked on.
  legal-inputs.md  Moroccan tax/legal facts the product needs — still almost entirely
                   TODO(legal). Never invent a value from this file; see CLAUDE.md §14.
```

## Prerequisites

- Node.js 24.x (`.nvmrc` pins the exact version) — `nvm use`
- Docker (or Podman with the Docker CLI shim) for local Postgres
- For `apps/ai`: see `apps/ai/README.md` (Python 3.14, uv, Ollama, Tesseract, ClamAV)

## Setup

```
cp .env.example .env        # fill in DATABASE_URL and APP_DATABASE_URL — see below
npm install                 # installs all workspaces, generates the Prisma client
npm run db:up                # starts local Postgres (compose.yaml) — applies db-init/
                              # role setup automatically on a brand-new volume
npm run db:migrate           # applies migrations
npm run db:seed              # idempotent demo-tenant seed
npm run dev                   # apps/web on http://localhost:3000
```

First run redirects `/` → `/documents`, which the auth middleware (`apps/web/proxy.ts`)
redirects again to `/login`. Use **Créer une organisation** to sign up — you'll land on
a mandatory TOTP setup step (owner role requires MFA, CLAUDE.md §8.2) showing a manual-entry
secret and an `otpauth://` URI; add it to any authenticator app before confirming.

### Two database credentials, not one

`.env` needs **both** `DATABASE_URL` and `APP_DATABASE_URL`, pointing at two different
Postgres roles. This is not redundant — see `packages/db/README.md` for why (short
version: Postgres superusers unconditionally bypass Row Level Security, so the app must
run as a separate, restricted role for RLS to mean anything). `db-init/01-app-role.sql`
provisions both roles automatically for a fresh local Postgres volume.

## Common commands

```
npm run dev          # apps/web dev server
npm run build         # apps/web production build
npm run typecheck     # tsc --noEmit across every workspace
npm run test           # vitest across every workspace that has tests (currently packages/db)
npm run db:up / db:down / db:migrate / db:seed
```

## Testing

- **TypeScript workspaces**: `npm run test` —
  `packages/db`'s `withTenant.test.ts` (integration test against a real local Postgres,
  proving tenant isolation at both the application and RLS layer, CLAUDE.md §8.1/§12 —
  extend it, don't skip it, when a new tenant-owned table is added) and
  `invoiceSequence.test.ts` (20 concurrent invoice-number allocations against a real
  Postgres, proving CLAUDE.md §5.6's no-gap/no-reuse requirement under real concurrency,
  not just assumed from the upsert's shape); `packages/accounting`'s property tests
  (`fast-check` — arbitrary balanced line sets, proving the trial-balance and
  reversal-restores-prior-balance invariants CLAUDE.md §2 requires, plus the
  Bilan actif==passif identity for S9's statement derivation) alongside its TVA-engine,
  invoice-mentions-validator, SIMPL-placeholder-adapter, RAS-resolution-engine,
  RAS-attestation-placeholder, and IS-passage-table (`is.test.ts` — résultat fiscal
  computation and the max(calculated IS, cotisation minimale) mechanism, including the
  loss-case regression where cotisation minimale must still apply) unit tests (fictional
  rate/rule/bracket fixtures, not real Moroccan tax facts — see `docs/legal-inputs.md`); and
  `apps/web/lib`'s pure-helper unit tests — CSV parsing, journal-import grouping,
  dashboard aggregation math (month bucketing, aging, net-balance sign conventions),
  bank-statement parsing, *lettrage* matching, the extracted-rate-to-TVA-rate-code
  bridge, and the states/declaration drilldown helper (`drilldown.ts` — sums *every*
  matching line in an entry, not just the first; a real bug this test suite caught), and
  `accountantAccess.ts` (`resolveGrantedRole` — scope-to-role mapping, the exact-expiry
  boundary, and revocation-overrides-a-still-valid-expiry, CLAUDE.md §8.1's "scope and
  expiry both enforced" requirement for S14's accountant grant) — scoped by
  `apps/web/vitest.config.ts` — server actions and components don't have a Next.js test
  harness yet).
- **`apps/ai`**: `uv run pytest` — see `apps/ai/README.md`.

## i18n

FR (default) and AR with RTL, switchable from the sidebar. Currently a scaffold, not
full coverage — see `packages/ui/README.md`'s i18n section for exactly what's translated
today and what still reads French literals.
