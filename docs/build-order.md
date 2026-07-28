# Build order — thin vertical slices, riskiest assumption first

- **Date:** 2026-07-27
- **Status:** **superseded in part** — see the banner below
- **Assumes:** ADR 0001 accepted (custom stack). If rejected, this document is void.

> ## ⚠️ Superseded for the first six months
>
> Written before decisions D-03, D-06, D-09 and D-11: a team of two, working **part-time
> alongside study** (~1.25 FTE), with no expert-comptable available until there is a demo to
> show. **The sixteen slices below are out of reach at that throughput** — see
> [ADR 0006](adr/0006-scope-for-the-first-six-months.md) and especially its Revision 2.
>
> **If ADR 0006 is accepted**, the plan is **D0 → D1 → D2 (demo, ~6 weeks) → show the
> accountant → W2 → W3 → W4**. S0 survives as D0 and S1a/S1b are narrowed into D1. Slices
> **S2–S15 become the post-wedge roadmap**, not the current plan. Read them for the
> sequencing logic and the definitions of done, which still hold — not as a schedule.
>
> **If ADR 0006 is rejected** and full scope is kept on a six-month clock, then ADR 0001
> (custom stack vs. Odoo) must be reopened first, because the ledger returns to the critical
> path and that was the one condition capable of flipping it.

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

### S2 — Tenant, identity and isolation

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

### S3 — The ledger

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

### S4 — Historical journal import

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

### S6 — Propose the posting

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

### S7 — TVA

**Assumption at risk:** that TVA can be modelled as effective-dated configuration rather
than logic — across both regimes, mixed-rate invoices and exempt lines.

**Scope:** effective-dated rate table resolved by `(rateCode, transactionDate)`,
encaissement vs débit as a tenant setting, mixed-rate and exempt lines, cash-payment
deductibility warning, TVA control accounts. Prorata is deliberately deferred.

**Definition of done:** a mixed-rate invoice books correct TVA per rate line under both
regimes, a back-dated invoice resolves the rate in force at its transaction date, and unit
tests cover real Moroccan fixtures including exempt and credit-note cases.

**Blocked on:** L-01 – L-05, L-08, L-13.

---

### S8 — Outgoing invoices

**Assumption at risk:** that unbroken sequential numbering survives concurrency, and that
the mentions validator is complete enough to be trustworthy.

**Scope:** canonical structured invoice model (PDF as a rendering of it, not the source of
truth), per-tenant per-series database sequence allocated in the insert transaction,
mentions validator blocking finalisation, immutability, *avoirs*.

**Definition of done:** a user issues a compliant invoice, cannot finalise one with a
missing mandatory mention, cannot alter it afterwards, corrects it via an *avoir* — and a
concurrency test issuing invoices in parallel produces no gap and no reuse.

**Blocked on:** L-48 – L-51, L-65 – L-67.

---

### S9 — États de synthèse

**Assumption at risk:** that the ledger model can actually produce the statutory statements
— i.e. that nothing needed for them was omitted from the entry model. If it cannot, this is
a schema problem, and finding it here is much cheaper than finding it later.

**Scope:** Bilan and CPC first, derived from journal lines only, every line drillable to
its entries. ESG, Tableau de financement and ETIC follow once the pattern holds.

**Definition of done:** a Bilan and a CPC generate from the ledger alone, every line drills
down to the entries composing it, and both match a golden file built from the official
structure.

**Blocked on:** L-62, L-63.

---

### S10 — TVA declaration and SIMPL export

**Assumption at risk:** that the DGI file format is obtainable and implementable. If L-22
cannot be answered, this slice cannot be built — and it is a headline feature, so find out
before promising it.

**Scope:** monthly/quarterly frequency derived from configuration and prior-year turnover
with explicit user override, the declaration figures shown before export, the versioned
SIMPL adapter, a human-readable PDF, and an audit record of what was exported.

**Definition of done:** a user reviews their TVA declaration figures on screen, each
traceable to journal lines, and exports a SIMPL-format file the DGI portal accepts.

**Blocked on:** L-17 – L-26. **Highest specification risk in the project.**

---

### S11 — Retenue à la source

**Assumption at risk:** that RAS genuinely fits a rule table. CLAUDE.md §5.4 asserts it
does; the rows in L-38 – L-47 will confirm or refute it.

**Scope:** the rule table keyed on `(paymentNature, payeeType, residentStatus, effective
dates)`, liability point per rule, flagging when payment nature is uncertain, the periodic
declaration and the *attestation* for the payee.

**Definition of done:** an *honoraires* payment computes and books the correct retenue,
generates an attestation, and a payment whose nature cannot be determined is flagged rather
than defaulted to no retenue.

**Blocked on:** L-38 – L-47.

---

### S12 — IS passage table

**Scope:** *tableau de passage du résultat comptable au résultat fiscal* with
réintégrations and déductions, cotisation minimale, acomptes, déficits reportables. Every
pre-filled line carries an explanation and links to its entries.

**Definition of done:** the passage table pre-fills from the ledger, each line explains
itself and drills down to its entries, and nothing is treated as final until the user or
their accountant validates it.

**Blocked on:** L-27 – L-37.

---

### S13 — Bank statement import and *lettrage*

**Scope:** per ADR 0003 — the `BankStatementSource` port with a file-import adapter only,
per-bank profiles as configuration, idempotent import into a staging sub-ledger, then
matching suggestions through the same propose → review → post pipeline.

**Definition of done:** a user imports a bank statement, sees suggested matches against
open items, confirms them, and a re-import of an overlapping date range creates no
duplicate.

---

### S14 — Accountant surface

**Scope:** per ADR 0004 — the `AccountantAccess` grant with scope and expiry, the external
accountant role, cross-tenant switching, full audit.

**Definition of done:** a tenant grants a scoped, expiring access to their expert-comptable,
who logs in, works across their client books, and every action is audit-logged — with a
test proving the grant's scope and expiry are both enforced.

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
