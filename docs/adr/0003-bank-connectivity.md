# ADR 0003 — Bank connectivity and statement ingestion

- **Status:** Proposed — awaiting decision by the project owner
- **Date:** 2026-07-27
- **Resolves:** CLAUDE.md §16 decision 3
- **Scope:** how bank transactions enter the system. Not the *lettrage* matching algorithm,
  which is a separate design.

---

## Context

PROJECT_BRIEF.md §6.1 asks to connect to Moroccan bank APIs, "ou, à défaut," import
standardised CSV/Excel statements, in order to automate *lettrage*.

The premise to test is whether "connect to Moroccan bank APIs" is a thing that exists for
a small SaaS vendor. Direct programmatic access to retail and business account data
generally requires either a PSD2-style regulatory regime with mandated bank APIs, or a
commercial per-bank agreement. Morocco is not in the EU PSD2 regime. Whether Bank Al-Maghrib
has mandated open-banking APIs, and on what terms a non-bank vendor may access them,
is an open question — `TODO(legal)`, row L-40 in `docs/legal-inputs.md`.

What is safe to assume: **every Moroccan bank lets a customer download a statement.**
That is the baseline that always works.

Note also that ingestion format is only half the problem. A `Bilan` and a bank
reconciliation both need the statement to carry a stable transaction identity so that
re-importing an overlapping date range does not double-post. CSV exports frequently do not
carry one. That constraint shapes the interface more than the file format does.

## Options

### Option A — Statement import only (CSV / Excel / MT940 / CAMT.053)

**For**
- Works with every bank, today, with no agreement, no licence, no partnership.
- Fully testable offline with fixture files — which matters for CLAUDE.md §12.
- The user is in the loop, which is the honest posture for a first version.

**Against**
- Manual step per period. The brief's ambition is automation, and this is not it.
- Per-bank CSV dialects: column order, date format, decimal separator, debit/credit as
  one signed column or two, encoding (Windows-1252 vs UTF-8), Arabic labels. This is a
  long tail that never fully ends.
- CSV rows often lack a stable unique identifier ⇒ import idempotency must be synthesised.

### Option B — Direct bank APIs, per bank

**For** — genuine automation; a real moat if achieved.

**Against**
- Requires a commercial and probably regulatory relationship per bank. Timeline measured
  in quarters, not sprints, and not controllable by the engineering team.
- Credential handling risk is the highest in the product (CLAUDE.md §8.5: envelope
  encryption, worker-only decryption, never returned to the client).
- Coverage will be partial for years. A feature that works for 2 of 8 banks is a support
  burden, not a feature.

### Option C — A third-party aggregator

**For** — one integration instead of N; the aggregator owns the bank relationships.

**Against**
- Requires an aggregator with real Moroccan bank coverage to exist and to be licensed to
  operate in Morocco. Unverified — `TODO(legal)` / commercial diligence, row L-41.
- Adds a sub-processor holding bank credentials and transaction data. That is a CNDP
  question (CLAUDE.md §8.6), not a procurement detail.
- Per-account monthly pricing typically competes directly with a 100–200 MAD/month total
  price (ADR 0005). An aggregator at even €1/account/month consumes a large fraction of
  the entire subscription.

### Option D — Screen scraping bank portals

Listed only to be rejected: violates bank terms of service, requires holding the user's
banking password in a reversible form, breaks on every UI change, and is an
indefensible security posture for a product whose credibility rests on handling money
carefully. **Rejected.**

## Recommendation

**Option A as the shipped baseline, behind an interface that makes Option B and C additive
rather than a rewrite.**

Define one port in `packages/accounting` (pure) with adapters outside it:

```
BankStatementSource
  → fetchStatements(account, dateRange) : RawStatement[]
RawStatement
  → normalise() : NormalisedTransaction[]
NormalisedTransaction
  { externalId, valueDate, operationDate, label, amount (Decimal),
    direction, counterpartyRef?, sourceHash }
```

- `FileImportSource` (CSV/Excel/MT940/CAMT.053) is the only adapter in v1.
- `ApiSource` and `AggregatorSource` implement the same port later, changing nothing
  downstream.
- Everything after `NormalisedTransaction` — matching, *lettrage*, posting — is written
  once against the normalised shape and never learns where the data came from.

Specific decisions inside Option A:

1. **Support MT940 and CAMT.053 from day one, not just CSV.** They are structured,
   carry transaction identity, and are what a business account can usually produce. CSV is
   the fallback, not the target.
2. **Per-bank CSV profiles are configuration, not code.** A `BankImportProfile` record
   (column mapping, date format, decimal separator, encoding, sign convention) per bank,
   seeded for the banks we have samples from, and user-editable with a preview. New bank =
   new row, not new deploy. This is the same principle as CLAUDE.md §2 rule 8.
3. **Idempotent import is mandatory.** Every imported transaction carries
   `(tenantId, bankAccountId, sourceHash)` unique, where `sourceHash` derives from the raw
   row content plus statement identity. Re-importing an overlapping range must be a no-op,
   not a duplicate. Given CLAUDE.md §2 rule 3 (append-only ledger), a duplicated bank
   import is not cleanly undoable — so prevention is the only control.
4. **Imported transactions are not ledger entries.** They land in a staging sub-ledger and
   only become journal entries through the same propose → review → post pipeline as
   invoices (CLAUDE.md §7.1). A bank CSV is untrusted input like any other upload
   (CLAUDE.md §8.4 — including the CSV-injection rules on export).

## What would have to be true for this recommendation to be wrong

1. **A licensed aggregator with real Moroccan coverage exists at a price that fits.** If
   one covers the major banks at a cost that is a small fraction of the subscription, start
   with Option C — the per-bank CSV long tail is a genuine ongoing tax and buying past it
   would be worth real money.
2. **Bank Al-Maghrib has mandated open-banking APIs** with a defined access route for
   non-bank vendors. Then Option B is a standards integration rather than eight commercial
   negotiations, and the calculus changes entirely.
3. **A single bank dominates the target segment.** If (say) most target TPEs bank with one
   institution and that institution offers a usable API, a single Option B integration
   covers most users and beats building the generic CSV machinery first.
4. **Users won't do a manual import.** If discovery shows merchants and artisans will
   simply not export and upload a statement monthly, then reconciliation-by-import is a
   feature nobody uses, and bank connectivity should be deferred entirely rather than
   built in a form that goes unused.

## Consequences if accepted

- No new third-party service and no new credential-handling surface in v1. This is a
  significant security and CNDP simplification, and it is worth stating explicitly as a
  benefit rather than a limitation.
- Real statement samples from the target banks are needed as test fixtures. This is a
  dependency on the user/customer, not on engineering — start collecting now.
- The *lettrage* matching algorithm is deliberately out of scope here and needs its own
  design note.
