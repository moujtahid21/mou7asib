# ADR 0001 — Custom stack vs. building on an open-source ERP

- **Status:** Proposed — awaiting decision by the project owner
- **Date:** 2026-07-27
- **Resolves:** CLAUDE.md §16 decision 1; PROJECT_BRIEF.md §5 note ³
- **Blocks:** everything. No code should be written before this is accepted or rejected.

---

## Context

PROJECT_BRIEF.md asks for two incompatible things:

- §7 specifies a custom stack: Next.js 16 + React 19 + Prisma 7 + a Python AI service.
- §5 asks to "envisager des frameworks comptables open source (Odoo Community,
  Dolibarr) déjà adaptés ou adaptables au contexte marocain, en ne développant que les
  modules spécifiques de conformité fiscale marocaine par-dessus."

These are not two ways of building the same product. They differ in language, hosting
model, per-tenant cost structure, multi-tenancy model, and — critically — in *who owns
the ledger*. CLAUDE.md currently assumes the custom stack throughout §3, §9 and §10; if
the ERP route is chosen, roughly half of CLAUDE.md becomes inapplicable and must be
rewritten before any code lands.

The decision is not "which is better software." It is: **is the Moroccan compliance
layer the product, or is it a plugin on someone else's product?**

## What the product actually is

Strip out what an ERP gives you for free and what is left is:

| Capability | Generic ERP gives you | mou7asib must build regardless |
|---|---|---|
| Double-entry ledger | ✅ | — |
| Chart of accounts machinery | ✅ | CGNC plan + tenant sub-account layer |
| Invoicing | ✅ | Moroccan *mentions obligatoires*, unbroken sequence |
| Bank reconciliation | ✅ (generic) | Moroccan statement formats |
| TVA | ✅ (generic tax engine) | encaissement/débit regimes, prorata, cash-payment deductibility |
| RAS (retenue à la source) | ❌ | full rule table + declarations + attestations |
| États de synthèse (Bilan, CPC, ESG, TF, ETIC) | ❌ | all five |
| SIMPL export | ❌ | versioned DGI adapter |
| IS passage table | ❌ | full |
| AI ingestion + intelligent posting | ❌ | full |

The bottom five rows are the product. They are also the rows where an ERP gives the
least leverage, because they are Morocco-specific and touch the ERP's internals.

## Options

### Option A — Custom stack (Next.js + Prisma + Python), as CLAUDE.md §3 assumes

**For**
- The compliance core lives in `packages/accounting` as pure, injected-date functions.
  This is the part that must be provably correct, and it becomes trivially unit-testable
  with Moroccan fixtures (CLAUDE.md §12).
- Single-database multi-tenancy with `tenantId` + Postgres RLS. Marginal cost of tenant
  N+1 is close to zero — which is what a 100–200 MAD/month price point requires.
- Mobile-first photo capture over 3G is a first-class design target, not a fight with a
  desktop-era ERP's rendering layer.
- Full control of the AI pipeline: cost caps, prompt-injection isolation, per-field
  confidence, extraction provenance (CLAUDE.md §7). All of this is bespoke anyway.
- No upstream that can break the ledger on a major version bump.

**Against**
- We build the boring, solved parts ourselves: double-entry engine, chart of accounts,
  bank reconciliation UI, invoicing, partner management, user management. Realistically
  several months before the first *interesting* feature exists.
- Every bug in the double-entry engine is our bug. An ERP's ledger has been beaten on by
  thousands of installs.
- No pre-existing accountant familiarity. A fiduciaire who already knows Odoo has to
  learn a new UI.

### Option B — Odoo Community + Moroccan localisation modules

**For**
- Mature accounting core, existing `l10n_ma` community localisation, existing accountant
  familiarity in the Moroccan market, existing partner/invoice/bank-statement models.
- Faster to a demo that looks like accounting software.

**Against — and these are the ones that decide it**
- **Licensing / feature line.** Odoo splits Invoicing (Community) from full Accounting
  (`account_accountant`, Enterprise). *Verify against the exact target Odoo version
  before relying on this* — but if the statutory reporting and reconciliation surface we
  need sits behind Enterprise, the "open source, no expensive licence" argument in
  PROJECT_BRIEF.md §5 inverts into a per-user Enterprise licence at a 100–200 MAD/month
  price point.
- **Multi-tenancy model.** Odoo's SaaS pattern is one Postgres database per tenant. At
  thousands of TPE tenants that is thousands of databases, each with its own connection
  pool, migration run and backup. That is a fundamentally different — and much higher —
  per-tenant cost curve than one RLS-scoped database. This is the single strongest
  argument against Option B given the target price.
- **Vercel is off the table.** Odoo is a long-running Python/PostgreSQL server. The
  brief's "déployé sur Vercel" requirement dies here (see ADR 0002).
- **Mobile.** Odoo's web client is not built for a mid-range Android over 3G. We would
  end up building a separate mobile front end against Odoo's API — i.e. building Option A's
  front end anyway, on top of Option B's back end.
- **Upgrades.** Deep customisation of `account` moves is exactly what makes Odoo major
  upgrades painful. Our customisations are in the ledger path, the worst place for it.
- **Localisation quality is unverified.** "Déjà adapté au contexte marocain" is an
  assumption in the brief, not a finding. `l10n_ma` community coverage of the five états
  de synthèse, RAS, prorata and SIMPL must be *audited*, not assumed. Our expectation is
  that it covers the CGNC chart of accounts and little of the rest — which leaves us
  building the entire product anyway, inside a framework we did not choose.

### Option C — Dolibarr + Moroccan modules

**For**
- Genuinely GPL end-to-end, no Community/Enterprise split. Lighter than Odoo. Has a
  double-entry accounting module.

**Against**
- PHP. Adds a third language to a stack that already has TypeScript and Python, for a
  team that (per the brief) is small.
- Weaker accounting depth than Odoo; the statutory reporting gap is at least as large.
- Same long-running-server hosting consequence as Option B.
- Moroccan localisation ecosystem is thinner than Odoo's.

### Option D — Hybrid: custom front end + AI pipeline, ERP as ledger back end

Build Option A's ingestion, extraction and mobile UI; post the resulting entries into
Odoo/Dolibarr via API as the system of record.

**For** — reuses the battle-tested ledger; keeps the good front end.

**Against** — you now own two systems, two data models, and a synchronisation problem in
the ledger path. Period close, sequence allocation and "posted entries are immutable"
(CLAUDE.md §2 rules 3 and 4) become distributed-transaction problems across a boundary
you don't control. This is the option that looks like a compromise and is actually the
most expensive.

## Trade-off summary

| | A: Custom | B: Odoo | C: Dolibarr | D: Hybrid |
|---|---|---|---|---|
| Time to first credible demo | slow | fast | medium | medium |
| Time to *Moroccan compliance* | medium | medium | medium | medium |
| Per-tenant cost at scale | lowest | highest (DB/tenant) | medium | high |
| Vercel deployment possible | yes | no | no | partial |
| Mobile-first over 3G | native | poor | poor | good |
| Ledger correctness risk | ours | upstream's | upstream's | **split — worst** |
| CLAUDE.md applies as written | fully | ~half | ~half | partially |
| Upgrade / lock-in risk | none | high | medium | high |

Note the second row: **no option is meaningfully faster to Moroccan compliance**,
because none of the ERPs supply RAS, the états de synthèse, SIMPL, or the IS passage
table. The ERP saves you the ledger, not the product.

## Recommendation

**Option A — the custom stack**, as CLAUDE.md §3 already assumes.

The reasoning in one sentence: the ERP route saves us the part of the system that is
cheap to build correctly and well-specified (double-entry bookkeeping), while charging us
a per-tenant cost curve and a hosting model that are incompatible with the stated price
point — and it saves us none of the Moroccan compliance work, which is the actual product.

Concretely: keep `packages/accounting` pure and TypeScript, single Postgres with RLS,
Next.js on Vercel for the web tier, Python for AI only. Revisit nothing about §3.

## What would have to be true for this recommendation to be wrong

> **Update 2026-07-27 (decision log D-01, D-02, D-03).** Conditions 2 and 4 are now closed
> and condition 3 is half-closed. Net effect: **the recommendation is stronger than when
> written.** The first customer is the TPE, which is precisely the shape that makes Odoo's
> database-per-tenant cost curve decisive. Only conditions 1 and 5 remain live, and both are
> cheap to check.

Any **one** of these flips it. They are stated as checks, not as assumptions:

1. **`l10n_ma` is far better than expected.** If an audit of the Odoo Moroccan
   localisation shows working, maintained implementations of the five états de synthèse,
   the RAS rule table, prorata de déduction, and a SIMPL-compatible export — then Option B
   removes 60–70% of the build, not 15%, and it wins outright.
   *Check: install Odoo Community + `l10n_ma`, attempt to produce an ESG and a TVA
   declaration from a seeded tenant. Timebox: 2 days.*
2. ~~**The real customer is the fiduciaire, not the TPE.**~~ **CLOSED — negative (D-01).**
   The first customer is the TPE. Thousands of small tenants is exactly the case where
   database-per-tenant hurts most, so this condition not only fails to flip the decision,
   it reinforces it.
3. **The team is one person and runway is under six months.** **NOW LIVE (D-03, D-06):**
   the team is two rather than one, but **the runway is under six months** — so the
   condition most capable of flipping this ADR is genuinely triggered.

   It is answered in [ADR 0006](0006-scope-for-the-first-six-months.md) rather than here,
   and the answer is **narrow the scope, don't change the stack**. The reasoning in one
   line: the wedge product ADR 0006 recommends does no double-entry bookkeeping at all, so
   Odoo's central advantage — a mature ledger — buys nothing, while its costs (framework
   learning curve, desktop-era UI for a mobile-first product, database-per-tenant economics
   under D-01) all remain.

   **This ADR's recommendation therefore stands, but conditionally.** If ADR 0006 is
   rejected and the full sixteen-slice scope is kept on a six-month clock, this condition is
   unanswered and **ADR 0001 must be reopened before any code is written.**
4. ~~**Vercel is not actually a requirement.**~~ **CLOSED (D-02).** Vercel is provisional —
   "to test it first". This does weaken one objection to Option B, but it is not the
   load-bearing one; the multi-tenancy cost argument survives untouched and was just
   strengthened by D-01. **No flip.**
5. **Odoo Community turns out to include the full accounting surface** we need at the
   target version, contradicting the Community/Enterprise split noted above.
   *Check: verify against the specific Odoo version, not against blog posts.*

If none of 1–5 hold, Option A stands.

## Consequences if accepted

- CLAUDE.md §3, §9, §10 stand unchanged.
- The build order in `docs/build-order.md` applies as written.
- Sunk-cost warning: reversing this after slice 3 (the ledger engine) costs roughly a
  month. Decide now, not later.

## Consequences if rejected

- CLAUDE.md §3 (architecture), §9 (Prisma), §10 (Next.js/React/TS) must be **rewritten
  before any code is written**, not adapted afterwards.
- ADR 0002 is largely mooted — the hosting question is answered by the ERP's requirements.
- The Vercel requirement in PROJECT_BRIEF.md §1 must be formally withdrawn.
