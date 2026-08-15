# Build order — thin vertical slices, riskiest assumption first

- **Date:** 2026-07-27
- **Status:** **superseded in part** — see the banner below
- **Assumes:** ADR 0001 accepted (custom stack). If rejected, this document is void.

> ## ✅ Back in effect — see ADR 0007 (2026-08-14)
>
> ADR 0006 (the extraction-wedge scope below this banner was written against) is now
> superseded by [ADR 0007](adr/0007-full-scope-rebuild.md): the project owner accepted the
> full scope for real, phased by dependency. **The sixteen slices below are the plan again**,
> read as a schedule, not just sequencing logic — extended with the new UI-layer phases the
> `Mou7asib Workspace.dc.html` design mockup adds (dashboard, copilot, command palette, org
> switching), which have no S-numbers here. See the implementation roadmap for how the two
> are interleaved and for S7+'s legal-data gap being resolved via `TODO(legal)`-seeded
> placeholders rather than a blocker (ADR 0007's "How the legal-data gap is resolved").
>
> D0/D1/D2 already shipped (the current app) and are not redone — S2 (tenancy/auth) is the
> next slice, building on D2's real upload/extraction/review pipeline rather than replacing
> it.

## Shipped so far (ADR 0007 roadmap)

Kept up to date as each phase lands — see the ADR 0007 implementation roadmap for the
full phase table (dashboard, rapprochement, etc. — not yet reflected here since they
don't have S-numbers).

### ✅ Phase 0 — Design system (2026-08-14)

The `Mou7asib Workspace.dc.html` mockup's tokens, app shell (sidebar/header/copilot
panel/command palette), and primitives ported into `packages/ui`, wired into `apps/web`
as the real layout. Full navigation ships from this phase — see `packages/ui/README.md`
and `apps/web/lib/nav.ts`.

### ✅ S2 — Tenant, identity and isolation (2026-08-14)

`User`/`Role`/`TenantMembership`/`Session`/`AuditLog` models, Postgres RLS on every
tenant-owned table enforced through a non-superuser runtime role (see
`packages/db/README.md` — this is not optional plumbing, RLS silently does nothing
without it), argon2 password auth with mandatory TOTP for owner/accountant roles, the
five-role policy module, FR/AR with RTL. Every existing document route moved off the D2
demo tenant constant onto the real session tenant.

**Definition of done, as actually met:** a user signs up, sets up MFA, logs in, and
reaches Réception (the one live nav destination) fully tenant-scoped in FR and AR:
`packages/db/src/withTenant.test.ts` proves tenant A's session cannot read tenant B's
rows at both the application and RLS layer. The "empty dashboard" part of the original
DoD is satisfied by the honest `<UnderConstruction>` placeholder, not a real dashboard —
that's phase 6.

### ✅ S3 — The ledger (2026-08-14)

`packages/accounting` (pure double-entry engine: balance validation, reversing-entry
builder, Decimal money via `decimal.js`, property-tested with `fast-check`),
`Account`/`Period`/`JournalEntry`/`JournalLine` models, the CGNC reference plan seeded
as a structural skeleton plus a small uncontroversial subset (explicitly non-exhaustive,
`TODO(legal)` pending L-61 — see `packages/db/src/referenceAccounts.ts`), copied into
each new tenant's own customisable `Account` layer at signup. Balance, append-only, and
period-lock are enforced by database triggers, not just application code (CLAUDE.md §2
rules 2-4) — verified directly against Postgres before building anything on top. Manual
entry, posting, reversal, and period lock/unlock are real, reachable at `/tva` (hosted
there, not a dedicated nav item — the mockup never designed a ledger screen; TVA/IS/états
still arrive in phases 8/10/11 on the same page).

**Definition of done, as actually met:** a user posts a balanced manual entry, sees it in
a trial balance that sums to zero, cannot edit or delete it once posted (DB trigger,
confirmed by direct SQL and by the UI), corrects it via a reversing entry that nets every
touched account back to zero, and cannot post into a locked period (confirmed live: an
entry aimed at a locked period stays a draft with an honest error message, not a raw
exception). `packages/accounting`'s property tests generate arbitrary balanced line sets
and confirm both the balance and reversal-restores-prior-balance invariants.

### ✅ S4 — Historical journal import (2026-08-15, CSV only)

A hand-written CSV parser (`apps/web/lib/csv.ts` — RFC4180 quoting/escaping, no dependency
added for it) and a mapping/grouping module (`apps/web/lib/journalImport.ts`) that groups
CSV rows into entries by a mapped "pièce" column and runs each group through the same
`assertValidEntry()` the manual-entry and reversal paths use. A two-step client wizard
(`apps/web/app/tva/ImportWizard.tsx`) previews the parsed entries and lets the user adjust
the column mapping (pre-filled by a keyword guess, never trusted un-reviewed) before
confirming. The `journal_imports` table (new migration, tenant-RLS'd like every other
ledger table) stores a sha256 content hash per `(tenantId, contentHash)` as the idempotency
key — a re-upload of the identical file is detected before anything is parsed for real and
returns "already imported, nothing changed" rather than creating duplicates.

**Scope note:** Excel (`.xlsx`) is deliberately not built — CLAUDE.md §4 asks for new
dependencies to be added and justified explicitly, not slipped in, and a binary
spreadsheet format needs one. CSV covers the "prior-year journal export" case the S4 DoD
names; Excel is a follow-up, not silently dropped scope.

**Definition of done, as actually met:** uploading a CSV with an unbalanced entry or an
unknown account code blocks the *entire* import (all-or-nothing — nothing is written
until the whole file previews clean, verified live with a deliberately unbalanced
fixture). A clean 3-entry/6-line fixture imports and posts directly (skipping the
draft step used by manual entry — this required creating each entry as `draft`, adding
its lines, then flipping to `posted`, because the `journal_lines` immutability trigger
fires on INSERT too, not just UPDATE/DELETE; the first implementation attempt tried to
insert an already-`posted` entry's lines directly and was caught immediately by the
trigger, live, before being fixed). Re-uploading the identical file afterward correctly
no-ops ("déjà été importé ... rien n'a changé", confirmed live) and the trial balance
still sums to zero (4600.50 / 4600.50 across the three imported entries).

### ✅ Phase 4 — Réception redesign (2026-08-15)

Not an S-numbered slice (like Phase 0, this one is UI-only, interleaved by the ADR 0007
roadmap rather than the original S2–S15 order). The document list (`documents/page.tsx`)
and the review screen (`documents/[id]/ReviewScreen.tsx`) moved off raw D2-era slate
Tailwind onto `packages/ui`'s design tokens, and the review screen became the two-column
document-preview / extracted-fields layout from the mockup. A new `PostingPanel`
(`documents/[id]/PostingPanel.tsx`) wires the review screen to the real ledger (phase 2):
a human picks the accounts and confirms the amounts (the extracted TTC is only a
pre-filled default in the first debit field, never posted un-reviewed — CLAUDE.md §5 rule
5), then posts through the same create-draft → add-lines → flip-to-posted path phase 2/3
established. A new `JournalEntry.sourceDocumentId` (unique, nullable, new migration) links
the posted entry back to its document for traceability and blocks posting the same
document twice.

**Scope note:** the mockup's panel is captioned "Écriture proposée" with a fabricated
matched-precedent line ("14 factures ONEE comptabilisées en 61251 depuis janvier 2025").
That's retrieval-ranked suggestion — phase 5, not built yet — so this phase's panel is
honestly captioned "Saisie manuelle — non comptabilisé" instead of borrowing the AI
styling for a suggestion that doesn't exist yet (ADR 0007: an honest in-progress state is
not a faked result).

**Definition of done, as actually met:** confirmed live — a document seeded as `extracted`
renders the restyled two-column review screen; entering real account codes and confirming
posts a balanced entry linked to the document (visible in the grand livre with the
document's supplier/invoice-number label, trial balance still sums to zero at
5740.50/5740.50 after posting on top of phase 3's fixtures); the panel then shows
"Comptabilisé" instead of the form, and the action rejects a second post attempt for the
same document (unique `sourceDocumentId` + an application-level check).

### ✅ S6 — Posting suggestions (2026-08-15)

**Scope, as built:** `apps/web/lib/postingSuggestion.ts` — for a document's supplier_name
(current display value, override if corrected), a tenant-scoped query over the tenant's
own *posted* history (`JournalEntry.sourceDocumentId` from phase 4) finds prior documents
from the same supplier (exact, case-insensitive match — no fuzzy matching, no cross-tenant
data per CLAUDE.md §7.2) and ranks which account was used on the debit side and which on
the credit side by frequency. `PostingPanel.tsx` shows the match as a "Précédent utilisé"
callout and pre-fills the two account-code inputs — never posts anything itself, same
"AI never writes to the ledger" rule as phase 4's TTC prefill (CLAUDE.md §5 rule 5).
`postDocumentEntry.ts` compares what was actually submitted to what was suggested and
writes the outcome (`accepted` / `edited`) to `AuditLog` (existing table from S2, not
previously wired up anywhere — this is its first real writer); `documents/page.tsx` reads
that back as the required acceptance-rate readout.

**Scope note:** matching is exact-string on `supplier_name` only — no normalization beyond
case-folding, no matching on ICE/IF, no amount-based similarity. A supplier whose name was
OCR'd slightly differently across two invoices won't match; that's a real limitation, not
hidden — a fuzzier matcher is a plausible follow-up once there's enough real posting
history to tell whether it's worth the false-positive risk.

**Definition of done, as actually met:** confirmed live with two ONEE invoices for the
same seeded tenant — the first posted manually (phase 4, no suggestion existed yet); on
the second, the panel showed "1 facture de ONEE — Branche Électricité comptabilisée en
6111 depuis 31 juil. 2026" with 6111/4411 pre-filled and the amount split correctly;
posting it unmodified recorded an `accepted` outcome, and `/documents` then showed
"Propositions acceptées telles quelles : 1/1 (100%)"; the trial balance still summed to
zero after both postings (6766.50/6766.50).

### ✅ Phase 6 — Dashboard (2026-08-15)

Not an S-numbered slice (UI-only, like phases 0 and 4). `app/dashboard/page.tsx` — every
number is a live query over the tenant's own posted ledger, nothing hardcoded or
projected. `apps/web/lib/dashboardMetrics.ts` holds the pure aggregation math
(month-bucketing, aging, net-balance sign conventions), unit-tested without a database,
same split as `packages/accounting`.

- **KPIs:** trésorerie (5141+5161 net debit balance), créances clients (3421 net debit,
  gross), fournisseurs (4411 net credit), charges du mois (class 6 debits dated this
  calendar month).
- **Cash trend:** a real 6-month month-end balance reconstruction from posted cash-account
  movements — **no forecast segment**. The mockup's dashed "Prévision IA" line to a
  fabricated 512k MAD is deliberately not built: there is no forecasting model behind it,
  and CLAUDE.md §14 bars shipping a result that looks authoritative but isn't.
- **Receivables aging:** buckets gross 3421 debits by age (0–30/31–60/61–90/90+), labeled
  explicitly as gross/un-netted — matching debits to later payments needs bank
  reconciliation (phase 7) or per-invoice tracking (phase 9), neither exists yet.
- **"À traiter":** real signals only — failed extractions, `contentHash` duplicates
  (`Document.groupBy` with a `having` count filter), documents whose current attempt has
  `arithmeticOk: false`, and extracted-but-unposted documents. Each links straight to the
  document. No dismiss/snooze state (the mockup's "Ignorer" button) — would need
  persistence this phase doesn't add.
- Minis row also surfaces phase 5's acceptance-rate metric for at-a-glance visibility, not
  just on `/documents`.

**Definition of done, as actually met:** verified against the exact ledger state phases
2–5's testing left behind (curl-based session login + page fetch, browser extension was
unavailable this session) — trésorerie 1 501 MAD (1500.50 rounded half-up), fournisseurs
3 666 MAD, charges du mois 1 026 MAD (only the August-dated entry, the July one correctly
excluded), écritures ce mois = 1, suggestions acceptées 1/1, cash-trend month labels
correctly ending on août, aging buckets correctly all zero (no 3421 postings exist yet).

### ✅ S13 — Bank statement import and *lettrage* (2026-08-15, CSV only)

Implements ADR 0003's Option A: `BankStatementImport`/`BankTransaction` (new migration,
RLS'd) as the staging sub-ledger — imported rows never become `JournalEntry` rows
directly (ADR 0003 point 4). A "bank account" is just the tenant's own 514x/516x `Account`
code, not a separate entity — CGNC sub-accounting already gives each real account its own
code. `apps/web/lib/bankStatement.ts` parses the CSV (reuses `lib/csv.ts`, same per-file
column mapping UX as S4) and handles both a single signed-amount column and a two-column
debit/credit layout — the two-column case caught a real bug during testing: a bank
statement's "Crédit" means money *in*, the opposite of ledger debit/credit convention, and
the first implementation flipped it; a unit test written against a real two-column
fixture caught it before it ever reached a browser.

**Idempotency is per-row, not whole-file** (unlike S4): `BankTransaction.sourceHash` is a
sha256 of the row's own normalized fields, unique per `(tenantId, bankAccountCode,
sourceHash)`, so a statement whose date range legitimately overlaps a prior import (the
normal way to avoid gaps) only inserts the rows that are genuinely new.

**Matching ("lettrage"):** `apps/web/lib/bankMatching.ts` — same principle as S6's posting
suggestions (retrieval + ranking over the tenant's own data, shown, never auto-confirmed),
but a different similarity function: exact amount match (transaction amount against a
line's debit or credit, by sign) plus closest date within a 15-day tolerance, with a
greedy assignment so the same open ledger line is never proposed to two transactions at
once. Confirming a match only sets `BankTransaction.matchedJournalLineId` — it never
creates, edits, or reverses a `JournalLine`.

**Scope note:** MT940/CAMT.053 (ADR 0003's actual recommended target — structured,
carries real transaction identity) are deferred: they need real sample files from
Moroccan banks as test fixtures, which CLAUDE.md §12 requires and which don't exist yet.
CSV is the documented fallback, not silently substituted scope. Also out of scope this
pass: posting a *new* entry directly for a transaction with no ledger counterpart (e.g. a
bank fee never manually entered) — today that still goes through `/tva`'s manual entry
form; a one-click "post as new entry" from this screen is a natural, small follow-up.

**Definition of done, as actually met:** confirmed live — imported a 3-row statement
against the seeded tenant's known ledger state (an 2300.50 receipt and an 800.00 payment
already posted, 1 day apart from their bank dates), the two real transactions matched
correctly with the right entry and date gap shown, a genuinely unmatched bank-fee row
correctly showed "Aucune correspondance", confirming a match removed it from the unmatched
list; re-importing a 5-row statement that overlapped the first showed exactly "2
nouvelle(s) transaction(s) importée(s) sur 5 ligne(s) (3 déjà connue(s), ignorée(s))" —
per-row idempotency confirmed, not whole-file rejection.

### ✅ S7 — TVA engine (2026-08-15)

The real engine lives in `packages/accounting/src/tva.ts` — pure, date-injected, no I/O:
`resolveTvaRate((rateCode, date))` per CLAUDE.md §5.3's exact rule, `computeTvaLines()`
(rounds each line half-up, never the aggregate), `groupByRate()` (one control-account
posting per rate, not per invoice line), `resolveCashThreshold()`. `apps/web/lib/
tvaResolution.ts` bridges a document's extracted `tva_lines` (a raw percentage per line)
to the engine's rate-code shape — that mapping is extraction-contract-specific, not core
double-entry logic, so it stays out of `packages/accounting`.

**Legal-placeholder strategy applied literally (CLAUDE.md §14):** `TvaRate` and
`TvaCashThreshold` are new *global* reference tables (same status as
`reference_accounts` — set by law, identical for every tenant, never per-tenant
config). Every `TvaRate` row is seeded `isPlaceholder: true` with a `legalSourceNote`
explaining exactly what's unverified; the four percentages (20/14/10/7) are not invented —
CLAUDE.md §5.3 itself lists them as "rates in use" — but their effective-dating (L-02's
reform schedule) is not sourced from an authoritative CGI/Loi de Finances document. The
cash threshold went further: **no row is seeded at all**. A round placeholder number
(20 000 MAD was the instinct) would itself have been an invented legal fact — CLAUDE.md
§15 bans that outright — so `resolveCashThreshold()` legitimately returns null today, and
the UI shows "seuil non configuré — TODO(legal) L-13" instead of a fabricated figure with
a caveat attached.

**TVA regime** (`Tenant.tvaRegime`, nullable, `/tva`'s new panel): never defaulted — shown
as "Non défini" until the owner explicitly picks encaissement or débit. What the regime
actually changes (when TVA becomes due for a declaration) is deferred to phase 11's
declaration engine, pending L-08; this phase stores and surfaces the choice honestly
rather than inventing the encaissement-vs-débit posting mechanic without a source for it.

**Posting integration:** `documents/[id]/PostingPanel.tsx` shows the resolved TVA
breakdown (extracted rate → matched rate code, or "non reconnu" if none matches —
never guessed past) and, when every rate resolves, pre-fills a full multi-line entry:
one HT line, one 34552 (TVA récupérable) line per distinct rate, one Fournisseur line for
TTC — still just a starting point a human must confirm, same as S6's account suggestions.
A "Réglé en espèces" checkbox surfaces the (currently unconfigured) cash-threshold
warning.

**Definition of done, as actually met:** confirmed live — a two-rate (20%/14%) seeded
document resolved both rates correctly (NORMAL_20/REDUIT_14), computed HT 1500.00 / TVA
270.00 / TTC 1770.00 exactly, pre-filled a correct 4-line entry (6111 debit 1500, 34552
debit 200, 34552 debit 70, 4411 credit 1770), and posted it with the trial balance still
exact (8536.50/8536.50, 34552 showing 270.00 recoverable). Setting the TVA regime via the
new panel persisted correctly across a reload. Unit tests (`packages/accounting/src/
tva.test.ts`, `apps/web/lib/tvaResolution.test.ts`) use entirely fictional rate
codes/values — not real Moroccan tax facts — to test the resolution engine itself.

### ✅ S8 — Outgoing invoices (2026-08-15)

**Sequential numbering, for real:** `InvoiceSeriesCounter` (one row per `(tenantId,
seriesCode)`) incremented via a Prisma `upsert` that Postgres compiles to a single atomic
`INSERT ... ON CONFLICT DO UPDATE ... RETURNING` — two concurrent finalisations serialise
on that row's lock rather than racing. `packages/db/src/invoiceSequence.test.ts` fires 20
concurrent allocations against a real Postgres and asserts the result is exactly
`{1..20}` — no gap, no reuse, no client-side generation, exactly CLAUDE.md §5.6's
requirement, proven under real concurrency rather than assumed from the code shape.

**Mentions validator:** `packages/accounting/src/invoiceMentions.ts` implements
CLAUDE.md §5.6's own mandatory-mentions list as the interim ruleset (that list is this
project's own instructions, not an invented fact) — issuer/customer identity, ICE/IF,
date, lines, payment terms block finalisation; RC/patente/CNSS only warn, because "where
applicable" (CLAUDE.md's own wording) is exactly what L-49 hasn't resolved, and blocking
on them with false confidence would be worse than not checking. New `Tenant.ice`/
`ifNumber`/`rc`/`patente`/`cnss` fields (free text, no format validation — L-65/L-66
check-digit algorithms are TODO(legal)) feed the issuer side, editable from a new panel on
`/facturation`.

**Immutability and avoirs:** `invoices`/`invoice_lines` get the same
trigger shape as `journal_entries`/`journal_lines` (phase 2) — finalized is append-only,
`invoice_lines`' trigger fires on INSERT too. A correction creates a new Invoice
(`isAvoir: true`, `avoirOfInvoiceId` set, its own "AV" series — L-51 doesn't say whether
avoirs share the invoice sequence, so a separate series sidesteps asserting either answer)
with every line's quantity negated. **Real bug caught live, not in a test:** the first
avoir attempt failed validation — the mentions validator's "quantity must be positive"
rule doesn't know an avoir's negated quantity is intentional. Fixed with an explicit
`allowNegativeQuantity` flag (still rejects zero), and a regression test added before
moving on, mirroring how the two-column bank-statement sign bug (S13) and the
already-posted-entry INSERT bug (S4/phase 4) were each caught and fixed in this project.

**Scope note:** finalizing an invoice does **not** yet post it to the ledger — that's a
natural follow-up analogous to phase 4's manual "Comptabiliser" step for purchase
documents, deliberately not built here since S8's own definition of done doesn't require
it and doing it well needs picking real revenue/TVA-facturée accounts per invoice line.
Draft invoices also aren't editable in place this pass (delete and recreate instead) — a
smaller, explicitly-flagged narrowing.

**Definition of done, as actually met:** confirmed live (curl-driven session — browser
extension unavailable this session) — a two-rate (20%/14%) invoice (2×500.00 HT @20% +
1×300.00 HT @14%) finalized as `FA-2026-000001` with TTC computed exactly as 1542.00
(1300 HT + 242 TVA); a direct `UPDATE` against the finalized row through the app-role
connection was rejected by the database trigger itself, not just the application; an
avoir finalized as `AV-2026-000001` showing exactly -1542.00, correctly labelled "Avoir de
FA-2026-000001", and the original no longer offered a second avoir. The concurrency test
above stands in for a live concurrent-request demonstration (harder to stage through
curl) and proves the same property at the database level.

### ✅ S9 — États de synthèse (2026-08-15, Bilan + CPC only)

`packages/accounting/src/statements.ts` — pure, no I/O — derives a Bilan (actif/passif)
and a CPC (produits/charges) from account balances the caller already aggregated. A
property test (`fast-check`, restricted to classes 1-7's account codes — see the test's
comment for why classes 0/8/9 would break the identity for a reason unrelated to the
derivation logic) proves `totalActif == totalPassif` holds for *any* balanced ledger,
because the computed résultat-net line is what closes that identity — not asserted, proven
across generated fixtures.

**Not the official CGNC structure:** docs/legal-inputs.md L-63 (the official line-by-line
Bilan/CPC layout with account-to-line mapping) is still TODO(legal), so this derives a
simplified class-level rollup instead of inventing *rubrique*/*poste* codes nobody has
verified — labelled "non officiel" everywhere it's shown, per CLAUDE.md §14. `/tva` gained
a new "États de synthèse" section: a date picker for the Bilan (cumulative, "as of"),
a date-range picker for the CPC (a flow statement, not cumulative), and every account line
is drillable via a native `<details>` element down to the individual journal entries
composing it (CLAUDE.md §5.2's requirement) — no client JS needed for that part.

**Scope note:** only Bilan and CPC, as S9 itself specifies ("ESG, Tableau de financement
and ETIC follow once the pattern holds") — not built here. The régime setting (*normal*
vs *simplifié*, which determines which of the five states a tenant must produce) isn't
wired in either: L-62 (the criteria) is TODO(legal), and with only 2 of 5 statements
built, the branching wouldn't mean much yet.

**Definition of done, as actually met:** confirmed live against the tenant's existing
ledger fixtures (2025-11 through 2026-09 postings spanning several phases' testing) — the
Bilan correctly excluded future-dated entries relative to the "as of" date, correctly
included the cumulative 2025 postings, and `totalActif` matched `totalPassif` exactly
(1500.50 = 1500.50) by hand-verified arithmetic, not just the property test; the CPC
correctly scoped to its date range (excluding entries from outside it) and showed the
right résultat net (-1140.00); expanding an actif line's `<details>` correctly listed
both contributing entries with the right signed amounts. Golden-file testing against the
"official structure" is not possible yet — there is no official structure to test
against (L-63) — so this DoD line is met by the identity-holds-for-any-ledger property
test instead, which is the strongest verification available without L-63.

### ✅ S10 — TVA declaration and SIMPL export (2026-08-15, no real DGI format)

**The single largest unknown in the project (per this very section's original "highest
specification risk" note) resolved the only way it honestly could without L-22:** the
figures pipeline is completely real — a period-scoped query over posted `34552`/`4455`
ledger movements, shown before export, every figure drillable to its entries (reusing
S9's `<details>` pattern) — but the "SIMPL export" is `packages/accounting/src/filings/
simpl/`'s `placeholder-v0` adapter, which renders a plainly-labeled non-official text
summary, not a DGI-format file. CLAUDE.md §5.3's instruction to "treat the DGI format as
a versioned adapter... never scatter format details through the codebase" is followed
literally: the adapter boundary exists and is real, there is just exactly one version of
it, and that version's only claim is "this is not the real thing."

**Filing frequency** (`Tenant.tvaFilingFrequency`, nullable): same non-default posture as
`tvaRegime` — L-17 (the turnover threshold) is TODO(legal), so never auto-derived, the
owner picks monthly or quarterly explicitly. Not yet enforced against the declaration
period picker (which accepts any date range) — a smaller follow-up once it matters.

**Audit trail:** `TvaDeclarationExport` (new table, RLS'd) persists every export
(period, regime snapshot, three totals, adapter version) and a matching `AuditLog` row —
CLAUDE.md §5.3's "log what was exported" and §8.2's "sensitive actions... always
audit-logged" (filing export is named explicitly), both satisfied by one write. Gated by
a new `tva:declare` permission, deliberately narrower than `ledger:write` — a filing
export is higher-trust than a routine posting, so a plain employee can book entries but
not file.

**Real bug caught live, not in a test:** the first version of S9's drilldown helper only
looked at an entry's *first* line matching a given account, so an entry posting to the
same account on two lines (exactly what phase 8's mixed-rate TVA postings do — two
`34552` lines, one per rate) under-reported in the drilldown while the aggregate total
was correct. Caught by hand-checking the declaration panel against a real two-rate
posting, fixed by extracting the summing logic into a small pure helper
(`apps/web/lib/drilldown.ts`) with its own unit tests, and reused by S9's Bilan/CPC
drilldown too — the same class of bug this project has now caught three times (S4's
already-posted INSERT, S13's bank-statement sign convention, this one), always by testing
before declaring a phase done, never left for a user to find.

**Definition of done, as actually met:** confirmed live — a real mixed-rate posting
(270.00 MAD in `34552`) correctly appeared in the declaration figures for the period
containing it and correctly excluded from a period that didn't; exporting wrote a
`TvaDeclarationExport` row and a matching `AuditLog` entry (verified directly in
Postgres) with the exact figures (270.00 deductible, -270.00 due — a crédit de TVA
reporté); the rendered placeholder text stated its own non-official status and cited
L-22 explicitly. No DGI portal accepted anything, because nothing claiming to be a real
SIMPL file was produced — that half of the DoD line stays honestly unmet pending L-22.

### ✅ S11 — Retenue à la source (2026-08-15, rule table ships empty by design)

**No placeholder rate this time.** TVA had CLAUDE.md §5.3 itself state real percentages
(20/14/10/7%) to seed as labelled placeholders; CLAUDE.md §5.4 gives RAS *no* rate at
all — only category names — and docs/legal-inputs.md L-38 (the complete payment-nature
list) is TODO(legal). Seeding a round "placeholder" rate here (the way a first instinct
did for the TVA cash threshold in phase 8, caught and reverted before shipping) would
itself have been inventing a legal fact, which CLAUDE.md §15 bans outright. So `RasRule`
(new global reference table, `packages/db`) ships with **zero rows**, on purpose, and
`packages/db/src/seed.ts` seeds nothing into it.

**That emptiness is the feature being tested, not a gap hiding behind one.** CLAUDE.md
§5.4: "if the payment nature cannot be determined with confidence, flag it — never
default to 'no retenue'." `packages/accounting/src/ras.ts`'s `resolveRasRule`/
`evaluateRasWithholding` are real, pure, unit-tested against *fictional* rule fixtures
(proving the engine correctly matches on the full `(paymentNature, payeeType,
residentStatus)` key and resolves effective-dating against whichever date the matched
rule's own `liabilityTrigger` names — CLAUDE.md §5.4's "do not assume invoice date or
payment date" — before it's ever pointed at real data. Confirmed live: evaluating a real
honoraires payment against the actually-empty table correctly persisted a `flagged`
`RasWithholding` row with `ras_amount`/`net_payable` both `NULL` — never a computed zero,
never silently dropped, exactly CLAUDE.md's required fallback, checked directly in
Postgres, not just asserted from the code.

**Attestation, same posture as SIMPL:** `packages/accounting/src/rasAttestation.ts`
renders a plainly-labelled non-official placeholder, real and tested, only callable once
a rule *has* matched (L-45's real required content is TODO(legal)) — currently
unreachable through the live app since nothing can match, by design, until real rules
exist.

**Definition of done, as actually met:** the DoD's "an honoraires payment computes and
books the correct retenue, generates an attestation" cannot be demonstrated with real
Moroccan figures this session — there is no rate to compute with. What *is* met, and is
arguably the more important half of the DoD: "a payment whose nature cannot be
determined is flagged rather than defaulted to no retenue" — proven live against real
(empty) configuration, not a mocked one. "Books" (a ledger posting for the withheld
amount) also isn't wired — same honest scope narrowing as phase 9's invoices not
auto-posting.

**Blocked on:** L-38 – L-47 — the engine, the persistence, and the attestation renderer
are all ready the moment even one real rule exists.

### ✅ S12 — IS passage table (2026-08-15, brackets and cotisation minimale ship empty)

Same posture as S11 (RAS), for the same reason: CLAUDE.md §5.5 names the *concepts*
(réintégrations, déductions extra-comptables, cotisation minimale, brackets) but gives no
numbers, and L-27 – L-37 are all TODO(legal). `IsBracket`/`IsCotisationMinimaleConfig`
(new global reference tables) ship with zero rows.

**What's real regardless:** the worksheet's starting point — `résultat comptable` — is a
frozen snapshot of phase 10's actual CPC output, not a placeholder. `packages/accounting/
src/is.ts`'s `computeResultatFiscal`/`computeIs` are pure, tested against fictional
bracket/cotisation fixtures, and encode the one piece of this that *isn't* a numeric
unknown: `IS dû = max(calculated IS, cotisation minimale)` is a structural mechanism of
the Moroccan system (CLAUDE.md §5.5: "computed even at a loss"), not a rate — implementing
that mechanism isn't inventing a legal fact the way a placeholder rate would be.

**Real bug caught by the test suite, not shipped:** the first version conflated "no
bracket resolved because résultat fiscal ≤ 0" (a known zero — no bracket-tax applies to a
loss) with "no bracket resolved because résultat fiscal is positive but nothing
matched" (genuinely unknown) — both produced `null`, which silently broke "cotisation
minimale applies even at a loss": a null `calculatedIs` made `isDue` null too, hiding the
floor exactly when CLAUDE.md says it must still apply. Caught by a test asserting the
floor applies on a loss, fixed by returning `ZERO` (not `null`) for the loss case before
ever wiring it into the UI — same "catch it by testing before shipping" pattern as this
project's other five bugs (S4, phase 4, S10's drilldown ×2, this one).

**Worksheet lifecycle:** `IsPassageWorksheet`/`IsPassageLine` (tenant-owned, RLS'd) —
every line requires a non-blank `explanation` (CLAUDE.md §5.5's literal requirement,
enforced at the schema and action level, not just the form). "Validated" is a deliberately
lighter guarantee than the ledger's DB-enforced immutability (an app-level check on the
add-line action, not a Postgres trigger) — a working paper toward a filing, not the ledger
itself; documented as such in the schema rather than silently reusing the heavier pattern
without the same stakes.

**Definition of done, as actually met:** confirmed live — creating a worksheet correctly
snapshotted the real CPC résultat comptable (-1140.00 MAD); adding a 2000.00 MAD
réintégration with its required explanation correctly produced résultat fiscal 860.00
(exact arithmetic); "IS dû" correctly showed "non calculable" throughout, since no
bracket is configured — never a guessed figure; validating correctly locked the
worksheet (add-line and validate forms disappeared) and persisted `validatedAt` and
`validatedById`, checked directly in Postgres. "Computes... the correct" IS itself
couldn't be demonstrated with a real number, for the same structural reason as S11.

**Blocked on:** L-27 – L-37 — the passage engine, the worksheet persistence, and the
max(IS, cotisation minimale) mechanism are all ready for real brackets the moment they
resolve.

---

### ✅ S14 — Accountant surface (2026-08-15, R1 only per ADR 0004; no Sage/Cegid connector)

ADR 0004 splits "the accountant interface" in two: **R1**, a logged-in accountant working
inside mou7asib, entirely within our control; and **R2**, a connector to the accountant's
existing Sage/Cegid installation, blocked on discovery (which products, which deployment
model — nobody has interviewed a real fiduciaire yet). This slice ships R1 only, exactly as
the ADR recommends, and does not touch R2.

**The `AccountantAccess` grant is real, not a placeholder.** `packages/db`'s new
`AccountantAccess` model (scope `read_only`/`read_write`, `expiresAt`, `revokedAt`) is the
literal shape CLAUDE.md §8.1 asks for: "cross-tenant access exists only for accountants
explicitly granted access by the tenant, through an explicit, audited grant with a scope
and an expiry." It's deliberately distinct from `TenantMembership` — a membership is
permanent internal staff; a grant is how an *external* accountant, who has their own
separate mou7asib account, reaches into a client's books, time-boxed and revocable without
touching their account at all.

**Deliberately not RLS'd**, same reasoning as `TenantMembership`/`Session` (see the phase 1
migration's own comment): an accountant resolving "which tenants can I reach" cannot do
that from inside any single tenant's RLS context, so this is bootstrap/identity data, not a
tenant-owned sub-ledger — `apps/web/lib/accountantAccess.ts`'s `resolveGrantedRole` is the
one place a grant row turns into an effective `Role`, and every query against the table
filters `tenantId`/`accountantId` explicitly rather than relying on a DB backstop.

**Scope maps onto the existing five-role matrix rather than inventing a sixth:**
`read_write` resolves to `accountant_external` (same permissions an internal accountant
has — ledger write, TVA declare, RAS, IS), `read_only` resolves to the existing `readonly`
role. Nothing in `policy.ts` had to special-case a grant-derived session; `getSession` just
falls back to `grantedRole()` when there's no `TenantMembership` row, and `switchTenant`
accepts either path.

**Enforcement is per-request, not just at switch time.** `getSession` re-resolves the grant
(scope, expiry, revocation) on every request — a session created while a grant was active
stops working the instant the grant expires or is revoked, without needing to be
re-switched. This is the literal DoD requirement ("a test proving the grant's scope and
expiry are both enforced"): `apps/web/lib/accountantAccess.test.ts` unit-tests
`resolveGrantedRole` against active/expired (including the exact-expiry-instant boundary)/
revoked grants, and the live verification below exercised the same real code path against
Postgres, not a stand-in.

**New `accountant:manage` policy action, owner-only** — deliberately narrower even than
`settings:manage`'s holders: an accountant who is themselves granted access into a tenant
must never be able to grant a third party further access into it. New `/comptables` page
(nav-linked, live) lets an owner grant by email (never creates an account on the
accountant's behalf — CLAUDE.md's prohibited-actions list bars that even server-side; the
accountant must already have their own login), pick a scope and an expiry date, and revoke
an active grant — every grant and revocation audit-logged (`accountant_access_granted` /
`accountant_access_revoked`).

**Definition of done, as actually met — live-verified** against the real running app and
real Postgres with two throwaway tenants/users (deleted after): an owner granted
`read_write` access, scoped to a 3-day expiry, to a second user's own account; the grant
row and its audit log entry were confirmed directly in Postgres. A session created for the
grantee scoped to the granting tenant (mirroring exactly what `switchTenant` does)
correctly resolved to `accountant_external` — confirmed by `/comptables` correctly showing
"Réservé au propriétaire" (accountant:manage is owner-only) and `/tva` correctly showing
the *granting tenant's* real ledger-derived data (Bilan/CPC/IS panel), not the accountant's
own. The owner then revoked the grant through the real UI action; the same still-valid
session cookie immediately lost access on the very next request (`getSession` failed
closed, `requireSession` threw its documented "unreachable past proxy.ts" error) — the
same pre-existing fail-closed behavior a revoked `TenantMembership` already produces, now
proven to also cover a revoked grant, not a new failure mode this phase introduced.

**Note on "as actually met":** no PDF-adjacent gaps here — the whole slice is internal to
mou7asib. What's explicitly *not* built: R2 (any Sage/Cegid connector — correctly blocked
on the ADR's discovery step, not attempted), and the "full audit" DoD language covers grant
lifecycle events only, not yet every read/write an accountant performs while switched in
(those already flow through each feature's own existing audit points, e.g.
`tva_declaration_exported`, not a new accountant-specific audit trail).

---

## Principle

Order is by **assumption risk**, not by architectural layer. Each slice exists to kill one
assumption that, if false, changes what we build. A slice is "thin" when it goes from user
input to user-visible output through every layer it touches — even if it handles one case.

Two slices at the top are deliberately **throwaway spikes**. They produce knowledge, not
product. Their code is expected to be deleted. Say so up front so nobody defends it later.

**Gate before slice 0:** legal rows L-60 (software certification requirement) and L-70
(cross-border data transfer) in `docs/legal-inputs.md`. Both are go/no-go. Answer them
before writing code, not before shipping.

---

## The slices

### S0 — Stack smoke test *(spike, throwaway)*

**Assumption at risk:** that Next 16.2.12 + React 19.2.8 + TypeScript 7.0.2 + Prisma 7.9.0
actually compose. TypeScript 7 is the native port and Prisma 7 is a rewritten TypeScript
runtime; both are recent, and the combination is the one thing in the version table that
registry metadata cannot confirm (see the version report).

**Scope:** one Next.js app, one Prisma model, one Server Component reading one row through
the generated client, `tsc --noEmit` under the full CLAUDE.md §10 flag set, `next build`,
and a deploy to Vercel.

**Definition of done:** `next build` and `tsc --noEmit` both pass with
`strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes + noImplicitOverride`, and
the deployed page renders a value read from Postgres via Prisma.

**Timebox:** 1 day. If it fails, we have a version decision to take before anything else.

---

### S1 — Extraction accuracy and cost probe *(spike, throwaway)*

**Assumption at risk:** the core product premise — that a model can extract Moroccan
invoices, including phone photos of thermal-printer tickets, accurately enough to be
useful, at a per-document cost compatible with 100–200 MAD/month (ADR 0005).

This is the single riskiest assumption in the project and it needs **no ledger, no auth,
no database**. Running it second is the highest-value sequencing decision in this document.

> **Revised 2026-07-27 (decision log D-05).** There is no corpus of real Moroccan documents
> yet. The slice therefore splits. Do not collapse the two halves back together: the whole
> value of S1 is that its numbers are trustworthy, and numbers from synthetic documents are
> not. Per decision D-01 the target segment is TPEs — merchants and artisans — so the
> documents that matter most are exactly the ones hardest to synthesise: creased,
> badly-lit phone photos of faded thermal *tickets de caisse*.

#### S1a — Build the measurement harness *(can start now)*

**Scope:** the harness, not the finding. Ground-truth labelling format, per-field accuracy
scoring, cheap-path/OCR routing, retry counting, and the cost-accounting record from
ADR 0005 (provider, model, prompt version, tokens, cost, latency, attempt, path). Exercise
it on whatever is obtainable without customers: self-generated invoices matching Moroccan
layouts, publicly published sample invoices, and deliberately degraded versions of both
(rotate, blur, crumple, underexpose, photograph a printout on a phone).

**Definition of done:** running one command over a document folder emits a per-field
accuracy table and a cost-per-document breakdown by path — with the harness proven by
scoring a deliberately wrong extraction correctly.

**Explicitly not done:** any claim about real-world extraction accuracy. S1a measures the
harness. Reporting its numbers as a product finding would be self-deception.

#### S1b — Run it on real documents *(blocked on corpus)*

**Scope:** 50–100 real anonymised documents spanning supplier PDFs, scans, phone photos,
mixed-rate invoices and *tickets de caisse*. Hand-label, run the S1a harness, report.

**Definition of done:** a one-page report giving per-field extraction accuracy and cost per
document broken down by document type and path, against a corpus that becomes the permanent
regression fixture set (CLAUDE.md §12).

**Blocked on:** corpus acquisition (decision log Q-3). **This is now a critical-path
dependency with no engineering workaround.** Routes worth pursuing in parallel with S0/S1a,
cheapest first:

1. Your own and your co-founder's business documents — supplier invoices, utility bills,
   telecom bills, till receipts. Available today, and enough to sanity-check S1a.
2. Friendly businesses — a café, a hardware shop, a small fiduciaire's client files.
   Ten cooperative merchants gets most of the way to a corpus.
3. Any expert-comptable engaged for `docs/legal-inputs.md` sees hundreds of these documents
   daily. **Ask for anonymised samples in the same conversation** — one relationship, two
   dependencies resolved.
4. Design-partner arrangement: free service in exchange for documents and feedback.

Anonymisation is a real task, not a checkbox: ICE, IF, CIN, IBAN and named individuals must
be removed before these files land in the repo (CLAUDE.md §2 rule 9). Budget for it.

**Timebox:** S1a 3–4 days. S1b 3 days once the corpus exists. The corpus outlives both.

---

### S2 — Tenant, identity and isolation ✅ *shipped 2026-08-14 — see "Shipped so far" above*

**Assumption at risk:** none, really — this is foundation. It is third because everything
after it writes tenant-scoped data, and retrofitting `tenantId` and RLS onto existing
tables is exactly the migration CLAUDE.md §9 warns about.

**Scope:** tenant, user, session, the five roles, the policy module, Postgres RLS with
per-transaction tenant context, audit log table. Sign up, log in, see an empty dashboard.
French and Arabic with RTL from this slice — retrofitting i18n is worse than starting with it.

**Definition of done:** a user signs up, logs in, and sees their own empty dashboard in FR
and AR; a test proves tenant A's session cannot read tenant B's rows at both the
application and the RLS layer.

---

### S3 — The ledger ✅ *shipped 2026-08-14 — see "Shipped so far" above*

**Assumption at risk:** that we can build a double-entry engine that upholds CLAUDE.md §2
rules 2, 3 and 4 under concurrency. This is the part that must be provably correct.

**Scope:** `packages/accounting` double-entry engine (pure, dates injected), CGNC chart
seeded as reference data plus the tenant sub-account layer, manual journal entry UI,
trial balance, period lock. Balance enforced at the database level, not only in
application code. Append-only with reversing entries.

**Definition of done:** a user posts a balanced manual entry, sees it in a trial balance
that sums to zero, cannot edit or delete it, corrects it via a reversing entry, and cannot
post into a locked period — with property tests generating arbitrary operation sets and
asserting both invariants.

**Blocked on:** L-59, L-61, L-57.

---

### S4 — Historical journal import ✅ *shipped 2026-08-15 (CSV only) — see "Shipped so far" above*

**Assumption at risk:** that a tenant's existing history can be loaded at all. Per ADR 0004
this is a prerequisite for intelligent posting — without history there is nothing to learn
from, and the headline feature is cold on day one. It is also how every real tenant
onboards.

**Scope:** normalised CSV/Excel journal import with a per-source mapping profile, dry-run
preview, idempotency key, and the same posting path as manual entry.

**Definition of done:** an accountant uploads a prior-year journal export, previews the
mapping, imports it idempotently, and the trial balance still sums to zero — with a
re-import of the same file changing nothing.

---

### S5 — Upload to review queue

**Assumption at risk:** that the ingestion pipeline works end to end on a mid-range Android
over 3G, and that untrusted-file handling holds. Deliberately stops **before** the ledger.

**Scope:** mobile photo capture, magic-byte validation, malware scan, object storage with
signed URLs, the queue and worker (ADR 0002), cheap-path-first extraction, schema
validation, arithmetic cross-check, duplicate detection, cost accounting per ADR 0005, and
a review queue showing each extracted field next to its location on the document.

**Definition of done:** a user photographs an invoice on a phone, and within a bounded time
sees the extracted fields in a review queue with source highlighting and an honest status —
with prompt-injection fixtures producing normal extraction and no behavioural change.

---

### S6 — Propose the posting ✅ *shipped 2026-08-15 — see "Shipped so far" above*

**Note:** shipped without a distinct per-field confidence score — the ranking signal
exposed is match frequency ("N factures ... depuis ..."), not a probability. Revisit if
that turns out to matter once there's more real posting history to rank over.

**Assumption at risk:** the second core premise — that retrieval and ranking over *this
tenant's own* history produces posting suggestions good enough that a user accepts them.
Note this is testable only because S4 loaded the history.

**Scope:** retrieval + ranking over the tenant's own entries, the matched precedent shown
to the user, per-field confidence, human accepts or edits, then posts through the S3 engine.
**Still no auto-posting.**

**Definition of done:** a document from the review queue is posted to the ledger with an
account suggestion the user accepted, the matched historical precedent visible next to it,
and an acceptance rate recorded as a metric.

---

### S7 — TVA ✅ *shipped 2026-08-15 (placeholder rates, no cash threshold configured) — see "Shipped so far" above*

**Assumption at risk:** that TVA can be modelled as effective-dated configuration rather
than logic — across both regimes, mixed-rate invoices and exempt lines.

**Scope:** effective-dated rate table resolved by `(rateCode, transactionDate)`,
encaissement vs débit as a tenant setting, mixed-rate and exempt lines, cash-payment
deductibility warning, TVA control accounts. Prorata is deliberately deferred.

**Definition of done:** a mixed-rate invoice books correct TVA per rate line under both
regimes, a back-dated invoice resolves the rate in force at its transaction date, and unit
tests cover real Moroccan fixtures including exempt and credit-note cases.

**Note on "as actually met":** unit tests use *fictional* fixtures, not real Moroccan
ones — CLAUDE.md §15 bars asserting real tax facts without an authoritative source, and
none was available this session. Credit-note handling isn't built yet either (no
*avoir* concept exists before phase 8's invoicing sibling, S8) — a real gap against this
line, not silently claimed done.

**Blocked on:** L-01 – L-05, L-08, L-13 — still blocked on the *legal data*, not the
engine; the engine is real and ready for real rows the moment L-01/L-02/L-13 resolve.

---

### S8 — Outgoing invoices ✅ *shipped 2026-08-15 (no PDF rendering, no ledger auto-posting) — see "Shipped so far" above*

**Assumption at risk:** that unbroken sequential numbering survives concurrency, and that
the mentions validator is complete enough to be trustworthy.

**Scope:** canonical structured invoice model (PDF as a rendering of it, not the source of
truth), per-tenant per-series database sequence allocated in the insert transaction,
mentions validator blocking finalisation, immutability, *avoirs*.

**Definition of done:** a user issues a compliant invoice, cannot finalise one with a
missing mandatory mention, cannot alter it afterwards, corrects it via an *avoir* — and a
concurrency test issuing invoices in parallel produces no gap and no reuse.

**Note on "as actually met":** the canonical structured model exists and is real, but no
PDF rendering was built this pass (the "PDF as a rendering of it, not the source of
truth" half of the scope line) — a real gap, not silently claimed. The mentions list uses
CLAUDE.md §5.3's own wording as an interim source, not a verified L-48 list.

**Blocked on:** L-48 – L-51, L-65 – L-67 — the engine is ready for real mention rules and
ICE/IF validation the moment they resolve.

---

### S9 — États de synthèse ✅ *shipped 2026-08-15 (Bilan + CPC, simplified class-level rollup) — see "Shipped so far" above*

**Assumption at risk:** that the ledger model can actually produce the statutory statements
— i.e. that nothing needed for them was omitted from the entry model. If it cannot, this is
a schema problem, and finding it here is much cheaper than finding it later.

**Scope:** Bilan and CPC first, derived from journal lines only, every line drillable to
its entries. ESG, Tableau de financement and ETIC follow once the pattern holds.

**Definition of done:** a Bilan and a CPC generate from the ledger alone, every line drills
down to the entries composing it, and both match a golden file built from the official
structure.

**Note on "as actually met":** no golden-file match — there is no official structure to
build one from yet (L-63). Verified instead with a property test proving the
actif==passif identity holds for any balanced ledger, plus live verification against real
fixtures. Re-open once L-63 lands to add the real golden-file test this line asks for.

**Blocked on:** L-62, L-63 — the derivation engine is ready for the real structure the
moment it resolves.

---

### S10 — TVA declaration and SIMPL export ✅ *shipped 2026-08-15 (figures pipeline real, export is a labelled placeholder — L-22 unresolved) — see "Shipped so far" above*

**Assumption at risk:** that the DGI file format is obtainable and implementable. If L-22
cannot be answered, this slice cannot be built — and it is a headline feature, so find out
before promising it.

**Scope:** monthly/quarterly frequency derived from configuration and prior-year turnover
with explicit user override, the declaration figures shown before export, the versioned
SIMPL adapter, a human-readable PDF, and an audit record of what was exported.

**Note on "as actually met":** L-22 could not be answered this session (no authoritative
source available), confirming the "assumption at risk" line above exactly as written —
this is the outcome that section warned about, handled per CLAUDE.md §14 rather than
blocking the whole slice: the adapter exists, versioned, real for everything except the
DGI-specific format itself. "Human-readable PDF" was scoped down to a browser-printable
text summary — no PDF-generation dependency added without justification (CLAUDE.md §4).
"Monthly/quarterly... derived from configuration and prior-year turnover" is not
implemented — L-17's threshold is unknown, so frequency is a manual tenant choice only,
not derived from anything.

**Blocked on:** L-17 – L-26. **Highest specification risk in the project** — confirmed,
not just flagged: this is the phase where that risk was actually hit.

---

### S11 — Retenue à la source ✅ *shipped 2026-08-15 (rule table ships empty, engine + attestation renderer ready) — see "Shipped so far" above*

**Assumption at risk:** that RAS genuinely fits a rule table. CLAUDE.md §5.4 asserts it
does; the rows in L-38 – L-47 will confirm or refute it.

**Scope:** the rule table keyed on `(paymentNature, payeeType, residentStatus, effective
dates)`, liability point per rule, flagging when payment nature is uncertain, the periodic
declaration and the *attestation* for the payee.

**Definition of done:** an *honoraires* payment computes and books the correct retenue,
generates an attestation, and a payment whose nature cannot be determined is flagged rather
than defaulted to no retenue.

**Note on "as actually met":** the "computes and books" half needs a real rate, which
doesn't exist yet; the "flagged rather than defaulted" half is fully proven, live, against
real (empty) configuration — arguably the higher-value half of this DoD line to get
right first, since it's the safety property. The periodic declaration (as opposed to
individual payment evaluation + attestation) isn't built.

**Blocked on:** L-38 – L-47 — confirmed genuinely blocking, not just flagged: this session
found no rate to seed even as a placeholder, unlike TVA.

---

### S12 — IS passage table ✅ *shipped 2026-08-15 (brackets/cotisation minimale ship empty, worksheet mechanics real) — see "Shipped so far" above*

**Scope:** *tableau de passage du résultat comptable au résultat fiscal* with
réintégrations and déductions, cotisation minimale, acomptes, déficits reportables. Every
pre-filled line carries an explanation and links to its entries.

**Definition of done:** the passage table pre-fills from the ledger, each line explains
itself and drills down to its entries, and nothing is treated as final until the user or
their accountant validates it.

**Note on "as actually met":** *acomptes provisionnels* and *déficits reportables* are
not built — both need real rules (L-30, L-31) beyond what a résultat-comptable snapshot
and a manual adjustment worksheet can honestly represent. "Pre-fills from the ledger"
is met for the one line that's genuinely derivable today (résultat comptable); the
réintégration/déduction lines are user-entered, each with a mandatory explanation, since
no automatic réintégrations list (L-32/L-33) exists to pre-fill them from.

**Blocked on:** L-27 – L-37 — confirmed genuinely blocking for the numeric side, same as
S11; the worksheet mechanism itself needed none of them.

---

### S13 — Bank statement import and *lettrage* ✅ *shipped 2026-08-15 (CSV only) — see "Shipped so far" above*

**Scope:** per ADR 0003 — the `BankStatementSource` port with a file-import adapter only,
per-bank profiles as configuration, idempotent import into a staging sub-ledger, then
matching suggestions through the same propose → review → post pipeline.

**Definition of done:** a user imports a bank statement, sees suggested matches against
open items, confirms them, and a re-import of an overlapping date range creates no
duplicate.

---

### S14 — Accountant surface ✅ *shipped 2026-08-15 (R1 only per ADR 0004; no Sage/Cegid connector) — see "Shipped so far" above*

**Scope:** per ADR 0004 — the `AccountantAccess` grant with scope and expiry, the external
accountant role, cross-tenant switching, full audit.

**Definition of done:** a tenant grants a scoped, expiring access to their expert-comptable,
who logs in, works across their client books, and every action is audit-logged — with a
test proving the grant's scope and expiry are both enforced.

**Note on "as actually met":** "works across their client books" is met for read/write on
the ledger, TVA, RAS and IS surfaces already shipped through the existing role matrix —
there is no accountant-specific view beyond switching tenant and getting the mapped role.
"Full audit" covers the grant lifecycle (grant/revoke) directly; day-to-day actions taken
while switched in are audited exactly as they already are for any other role (e.g. TVA
export), not by a new accountant-specific trail. R2 (Sage/Cegid connector) is correctly not
attempted — the ADR blocks it on a discovery step (interviewing real fiduciaires) that
hasn't happened.

---

### S15 — Auto-posting

**Deliberately last.** Everything before it keeps a human in the loop. Auto-posting is the
only slice that lets a model's output reach the ledger without a person, so it should ship
only once S6's acceptance-rate metric shows it is earned.

**Scope:** per-field confidence thresholds as per-tenant configuration, auto-post only when
every gate passes, with the same validation and duplicate checks as the manual path.

**Definition of done:** documents above threshold post automatically, everything else routes
to review, and the measured auto-post error rate on the S1 regression corpus is below an
agreed bound.

---

## Sequencing notes

- **S0 and S1a can run in parallel** and neither depends on the other.
- **S1's corpus is the deliverable, not S1's code.** It becomes the permanent regression
  fixture set and the basis for the accuracy metric that gates merges (CLAUDE.md §12).
- **S1b is the only slice with no engineering workaround.** Every other blocked slice can be
  worked around, deferred, or scoped down. This one cannot: without real documents there is
  no honest answer to "does the product work". If the corpus is still absent by the time S2
  and S3 are done, that is the signal to stop building and go get documents — not to press
  on and find out during S5.
- **With a team of two (D-03), do not run S0, S1a and S2 concurrently.** S0 is a one-day
  gate; clear it first, then split S1a and S2.
- **S4 before S6** is the non-obvious dependency, and getting it backwards would make the
  intelligent-posting slice untestable.
- **S9 before S10** — do not build a declaration on a ledger model that has not yet been
  proven able to produce a Bilan.
- **S15 last** is a deliberate product decision, not a scheduling accident.
- Slices S7 onward are each gated on legal rows. Those answers have a lead time measured in
  weeks. **Start the accountant conversation during S0/S1**, or the gates, not the
  engineering, become the critical path.
