# ADR 0006 — Scope for the first six months

- **Status:** Proposed — awaiting decision by the project owner
- **Date:** 2026-07-27
- **Created by:** decision log D-06 (runway under six months), D-03 (team of two),
  D-07 (price point is a placeholder), D-08 (corpus limited to the founders' own documents)
- **Supersedes:** the slice sequencing in `docs/build-order.md` for slices S7 onward
- **Does not supersede:** ADR 0001. See "Why this is not an argument for Odoo" below.

---

## Context

Four answers arrived together on 2026-07-27, and their combination is more significant than
any one of them:

| Input | Value |
|---|---|
| Team | 2 people |
| Runway | **under 6 months** |
| First customer | TPE (merchants, artisans, self-employed) |
| Price point | a placeholder — no analysis behind it |
| Invoice corpus | the founders' own business documents only |
| Legal inputs (`docs/legal-inputs.md`) | 77 rows, all unanswered, weeks of lead time |

`docs/build-order.md` describes sixteen slices ending in a Moroccan-compliant accounting
product with TVA declarations, SIMPL export, RAS, IS and five états de synthèse.

**That plan does not fit in under six months with two people, and it is better to say so
now than to discover it in month five.**

A rough reckoning of the original plan, two people working well:

| Slices | Work | Realistic |
|---|---|---|
| S0–S1a | stack spike, extraction harness | ~1.5 weeks |
| S2 | tenancy, auth, RLS, roles, audit, i18n + RTL | 3–4 weeks |
| S3 | ledger engine, CGNC seed, period lock, property tests | 4–6 weeks |
| S4 | historical journal import | 2–3 weeks |
| S5 | upload pipeline, worker, storage, scanning, review queue | 4–6 weeks |
| S6 | posting suggestions from history | 3–4 weeks |
| **Subtotal to S6** | | **~4.5 months, best case** |
| S7 onward | TVA, invoicing, états, SIMPL, RAS, IS | *blocked on legal inputs anyway* |

At the end of that best case, you have spent the entire runway and hold a product that
cannot yet produce a single statutory filing — which is the thing customers would pay for.
And the two riskiest assumptions in the business (does extraction work on real merchant
documents; will a merchant actually photograph their invoices) would have gone untested
until month four.

Meanwhile S7 onward is gated on legal answers nobody has yet requested, and S1b is gated on
a corpus that does not exist.

**The binding constraint is not engineering speed. It is that the plan spends all the
runway before testing the premise.**

## The reframe

At under six months, the goal is not "ship an accounting SaaS". It is: **reach evidence and
revenue before the money runs out** — evidence strong enough either to earn income, raise
money, or conclude the premise is wrong cheaply.

So the question becomes: what is the smallest thing that a Moroccan TPE would pay for, that
tests the riskiest assumption, and that does not require the ledger or the legal table?

## Options

### Option A — Original plan, compressed

Cut corners across all sixteen slices and hope to reach a compliance product in time.

**For** — preserves the full vision; no strategic rethink.

**Against** — the corners you cut are in `packages/accounting`, tenant isolation and the
ledger, which are precisely the places CLAUDE.md §2 says a shortcut is a build failure
rather than a style nit. It also front-loads four months of foundation before the premise is
tested. **This is the option that runs out of money holding an untested half-product.**

### Option B — Pivot to Odoo/Dolibarr to buy the ledger

Reopen ADR 0001 on the grounds that under six months we cannot afford to build a ledger.

**For** — genuinely saves S3, and some of S2, S8 and S13.

**Against** — see the dedicated section below. Briefly: it buys the wrong thing.

### Option C — The extraction wedge *(recommended)*

**Ship the ingestion half of the product, with no ledger at all.**

A TPE photographs their invoices as they receive them. The system extracts, validates,
deduplicates and organises them. At period end, the business gets a clean, structured,
reviewed dataset — and their existing expert-comptable gets a file they can import instead
of a shoebox of paper.

What that requires: tenancy and auth (thin), mobile capture, the upload pipeline, extraction,
the review queue, and a structured export. What it does **not** require: the double-entry
engine, CGNC posting, TVA computation, états de synthèse, SIMPL, RAS, IS — **and therefore
almost none of `docs/legal-inputs.md`**.

**For**
- Testable in weeks, not months. The premise gets tested while there is still runway to act
  on the answer.
- **Solves the corpus problem by construction.** D-08 leaves us with the founders' own
  documents — a small, biased sample that does not represent a hardware shop's thermal
  receipts. The wedge's first ten customers *are* the corpus. Every user makes the
  extraction better and the regression fixture set larger.
- **Not blocked on the legal table.** The 77 rows have weeks of lead time and no owner yet.
  The wedge needs a handful of them (retention L-57/L-58, CNDP L-69/L-70/L-74) rather than
  all of them.
- Real revenue from real users tests the price question (D-07) with evidence instead of a
  placeholder.
- It is genuine value, not a demo: "no more shoebox, and your accountant stops charging you
  for data entry" is a complete proposition to a merchant.
- **Nothing is thrown away.** Every piece is slice S5 and S6 of the original plan. The
  ledger is added on top later, with validated demand and a real corpus.

**Against**
- It is not the product in PROJECT_BRIEF.md. It is the first third of it.
- The expert-comptable still does the posting, so "pas de double saisie" is only partly
  delivered.
- Competitors could occupy the compliance ground while we are proving the wedge — though
  with under six months of runway, that risk is theoretical and running out of money is not.

### Option D — Stop and raise money against the plan

Treat the current documents as a fundraising artefact rather than a build plan.

**For** — honest about the mismatch; the ADRs and legal table are credible diligence material.

**Against** — raising against an untested premise with no corpus and no users is far harder
than raising against a wedge with paying customers. This option gets much stronger *after*
Option C, and is arguably its natural sequel.

## Why this is not an argument for Odoo (ADR 0001 stands)

The obvious reading of "under six months, can't build a ledger" is "so use one that
exists". The reason that fails:

**Option C does not need a ledger at all.** Odoo's central advantage — a mature double-entry
core — is worth nothing in a scope that does no double-entry bookkeeping. What we would
still build on Odoo is the mobile capture, the AI pipeline, the review queue and the export,
which is exactly what we would build without it, plus the cost of learning a framework and
inheriting a desktop-era UI for a mobile-first product.

Odoo would buy us the part we have just decided to defer, at the price of the part we are
actually shipping. **ADR 0001's recommendation is unchanged — conditional on adopting this
ADR.** If Option A or B is chosen instead, ADR 0001 genuinely does need reopening, because
then the ledger is back on the six-month critical path and the calculus changes.

## Recommendation

**Option C — the extraction wedge.** Concretely, replace slices S2–S15 with a five-slice
plan for the first sixteen weeks:

| # | Slice | Definition of done | Est. |
|---|---|---|---|
| W0 | Stack spike (unchanged S0) | `next build` + `tsc --noEmit` pass under CLAUDE.md §10 flags, deployed page reads from Postgres via Prisma | 1 day |
| W1 | Extraction harness + founders' own documents (S1a, narrowed S1b) | Per-field accuracy and cost-per-document reported over every invoice the two of you can find | 1.5 weeks |
| W2 | Thin tenancy + auth + mobile capture | A user signs up on a phone, photographs an invoice, and sees it stored with an honest status; tenant isolation test passes | 3 weeks |
| W3 | Pipeline + review queue | Extracted fields appear for review with source highlighting, arithmetic cross-check, duplicate detection and per-document cost recorded | 4 weeks |
| W4 | Structured export + first ten users | A user exports a period's reviewed documents as a structured file their accountant accepts, and ten real TPEs are using it | 4 weeks |

That is roughly 13 weeks, leaving buffer inside a six-month runway — and it reaches paying
users at W4 rather than never.

**Carry forward from the original plan, non-negotiably**, because these are cheap now and
expensive to retrofit:

- `tenantId` on every table with RLS from the first migration (CLAUDE.md §8.1).
- `Decimal(19,4)` for money from the first migration (CLAUDE.md §2 rule 1). Even without a
  ledger, extracted amounts are money.
- Untrusted-upload handling in full (CLAUDE.md §8.4) and prompt-injection isolation
  (CLAUDE.md §7.3). Neither is a "later" item; both are one-way doors.
- Cost accounting per document from W3 (ADR 0005).
- i18n with FR/AR and RTL (CLAUDE.md §10).
- The canonical structured document representation, so the ledger can be added on top.

**Defer explicitly, and say so out loud to any customer:** the ledger, CGNC posting, TVA
computation, états de synthèse, SIMPL, RAS, IS. Do not imply these exist. CLAUDE.md §13's
"never fake a result" applies to the sales conversation too.

~~**Start regardless of this ADR's outcome, this week:** find an expert-comptable.~~
**Superseded by Revision 2 (D-09).** The accountant relationship cannot be secured before
there is something to show, so it sits *downstream* of the demo rather than ahead of it. The
one thing that can start immediately is Q-8: asking the existing contact what they would
need to see. That needs no demo and it aims the whole milestone.

---

## Revision 2 — 2026-07-27 (decision log D-09, D-10, D-11)

Three answers arrived after this ADR was written. **The recommendation is unchanged — the
wedge still stands — but the framing, the timeline and the ordering all change.**

### The runway framing above is wrong; withdraw it

D-11: the work is part-time alongside study, and "under six months" was savings runway, not
a deadline after which work stops. **There is no cliff.** Flip condition 2 below is
triggered, so the urgency language in the Context section ("before the money runs out",
"spends all the runway") should be read as withdrawn.

But it does not restore the sixteen-slice plan. Two part-time students is roughly **1.25 FTE
against the 2 FTE assumed above**, so every calendar estimate in this document roughly
doubles. The full plan moves from *impossible in six months* to *out of reach in any
reasonable planning window*.

**So the wedge survives for a better reason than deadline pressure: at low throughput,
finishing one narrow thing beats half-finishing a broad thing.** That reason does not expire.

### The accountant dependency was backwards

D-09: there is a contact, but they want to see an MVP first. Every previous version of this
plan — including the "start this week regardless" note below — assumed the accountant came
first and supplied documents, legal answers and customers. They don't. The real graph is:

```
demo  →  accountant  →  { documents, legal answers, first customers }
```

**A showable demo is therefore the highest-priority artefact in the project.** It is not a
by-product of W4; it is the gate that unlocks three dependencies at once. And it must be
built from only what exists today — the founders' own documents, no legal answers, no
customers.

This is also good news, because D-10 means the demo conversation *is* the test of flip
conditions 1 and 5. No separate discovery exercise is needed.

### Revised plan: a demo milestone in front of the wedge

Replaces the W0–W4 table above. Calendar weeks at part-time pace, ~1.25 FTE.

| # | Slice | Definition of done | Calendar |
|---|---|---|---|
| **D0** | Stack spike (was W0) | `next build` + `tsc --noEmit` pass under CLAUDE.md §10 flags; deployed page reads from Postgres via Prisma | ~3 days |
| **D1** | Extraction harness on own documents (was W1) | Per-field accuracy and cost per document reported over every invoice the two of you can find | ~3 weeks |
| **D2** | **The demo** | On a phone, photograph a real Moroccan invoice and see the correct fields extracted, each highlighted where it came from on the document, with low-confidence fields visibly flagged rather than guessed | ~2–3 weeks |
| — | **→ show the accountant ←** | Unlocks documents, legal answers, customers, and answers Q-5/Q-6 | — |
| W2 | Thin tenancy + auth + mobile capture, properly | User signs up on a phone, photographs an invoice, sees it stored with an honest status; tenant isolation test passes | ~6 weeks |
| W3 | Pipeline + review queue | Extracted fields reviewable with source highlighting, arithmetic cross-check, duplicate detection, per-document cost recorded | ~8 weeks |
| W4 | Structured export + first users | A period's reviewed documents export as a structured file the accountant accepts | ~8 weeks |

**Demo in roughly six weeks. That is the number that matters**, because everything else is
downstream of it.

### What the demo is, and what it must not become

**Scope it to what earns an accountant's yes**, which is narrower than instinct suggests:
a real Moroccan invoice, correct fields, visible provenance, and honest uncertainty. Not a
dashboard, not a chart of accounts, not a ledger, not multi-tenancy, not a settings page.

Two constraints on how it is built:

1. **Build D2 on D0's real foundation, not as a throwaway.** The classic failure here is a
   quick demo that quietly becomes the product with no tenancy and no upload controls. D0
   exists precisely so the demo starts on the real stack. It may skip features; it may not
   skip `tenantId`, `Decimal(19,4)`, or the upload allowlist.
2. **Do not let the accountant upload real client documents into the demo** until
   CLAUDE.md §8.4 and §8.6 are genuinely satisfied. Founders' own documents carry no
   third-party exposure; a client's invoices are someone else's personal and financial data,
   and the demo is not yet a system that may hold them. Show it with your own documents, or
   with documents they have anonymised and consented to share.

### Before building D2, ask the contact one question

Q-8 in the decision log: *"What would you need to see to say you'd actually use this?"*

Five minutes, needs no demo, and it aims the entire six-week milestone. Asking it now is
strictly better than guessing and finding out in week six.

---

## What would have to be true for this recommendation to be wrong

1. **A TPE will not pay for extraction without bookkeeping.** If willingness to pay lives
   entirely in "produces my TVA declaration", the wedge has no revenue and Option D (raise
   against the full plan) is the honest route. **Still open, but the test has moved (D-09,
   D-10):** the demo → accountant conversation at the end of D2 answers this, so it no
   longer needs a separate discovery exercise before W2.
2. ~~**The runway figure is soft.**~~ **TRIGGERED — but does not flip the recommendation
   (D-11).** It is indeed pacing rather than a cliff: part-time alongside study, no deadline
   after which work stops. However, ~1.25 FTE roughly doubles every calendar estimate, so
   the original sixteen-slice build order does *not* become viable on a longer clock — it
   recedes further. The wedge survives on throughput grounds instead of deadline grounds.
   See Revision 2.
3. **W1 shows extraction does not work well enough.** If accuracy on real documents is poor,
   the wedge has no product and the whole premise needs rethinking — which is exactly why
   W1 comes second and costs a week and a half.
4. **An expert-comptable partner changes the economics.** If a fiduciaire will bring their
   client book, the buyer shifts (reopening D-01, ADR 0001 and ADR 0004 together) and a
   different, larger first version may be fundable.
5. **The accountants' import path is closed.** The wedge assumes a structured export is
   useful to an expert-comptable. If they will only accept data through Sage/Cegid in a
   format we cannot produce (ADR 0004's unanswered discovery questions), W4 has no
   deliverable. *Check this during the same conversation as condition 1.*

## Consequences if accepted

- `docs/build-order.md` slices S2–S15 are superseded by W0–W4 and become the post-wedge
  roadmap.
- PROJECT_BRIEF.md's scope is explicitly staged rather than reduced — worth recording so
  that "we didn't build TVA" reads as a decision rather than a failure.
- Most of `docs/legal-inputs.md` moves off the critical path, except L-57, L-58, L-69, L-70
  and L-74, which the wedge still needs.
- ADR 0005's metering stays (burn matters at this runway) but its pricing machinery can be
  minimal, since D-07 makes the price a hypothesis to test rather than a constraint to
  design against.
