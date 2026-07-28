# ADR 0005 — Reconciling the 100–200 MAD/month price point with per-document AI cost

- **Status:** Proposed — awaiting decision by the project owner
- **Date:** 2026-07-27
- **Resolves:** CLAUDE.md §16 decision 5

---

## Context

PROJECT_BRIEF.md §5 targets 100–200 MAD/month per tenant. CLAUDE.md §1 states this
constrains architecture and §16 requires per-document model cost to be measured from the
first prototype.

The risk is specific and it is not "AI is expensive". It is that **the cost driver is
per-document and the revenue is per-tenant**, so unit economics depend on a variable
(documents per tenant per month) that nobody has measured, that varies by an order of
magnitude across the target segment, and that a customer can change unilaterally after
signing.

A merchant photographing every supplier ticket may produce hundreds of documents a month.
A consultant issuing four invoices may produce ten. Same subscription.

## The model to instrument (not the numbers — the shape)

```
gross margin per tenant  =  subscription
                          − (documents × cost per document)
                          − fixed infrastructure per tenant
```

where

```
cost per document  =  P(cheap path) × cost_text_layer
                    + P(OCR path)   × (cost_OCR + cost_extraction_model)
                    + retry_rate    × cost_extraction_model
                    + cost_storage + cost_scan + cost_embedding/retrieval
```

Every term on the right is currently unknown. The point of this ADR is that they must be
*measured*, not estimated — but the structure already tells you where the leverage is:

- **`P(cheap path)` is the single biggest lever.** CLAUDE.md §7.4 already mandates
  "cheap path first". A PDF with a usable text layer costs a rounding error; a phone photo
  costs OCR plus a vision model call. If most incoming documents are supplier PDFs, unit
  economics are comfortable. If most are photos of thermal-printer tickets — which is
  exactly the merchant/artisan segment the brief targets — they are not.
- **`retry_rate` is a hidden multiplier.** CLAUDE.md §7.2 mandates schema-validation retry.
  A 20% retry rate is a 20% cost increase on the expensive path, and it is invisible unless
  instrumented separately from first-attempt cost.
- **Fixed per-tenant infrastructure** must stay near zero, which is the RLS single-database
  argument in ADR 0001 and the warm-worker argument in ADR 0002.

### Worked illustration (assumptions, not findings)

Purely to show the shape of the answer. **Every number here is a placeholder to be
replaced with a measurement.** FX assumed at 10 MAD/USD — replace with the live rate.

| | Light tenant | Heavy tenant |
|---|---|---|
| Documents/month | 20 | 300 |
| Share needing OCR + vision | 30% | 80% |
| Assumed cost per expensive document | $0.02 | $0.02 |
| Assumed cost per cheap document | $0.001 | $0.001 |
| Model cost/month | ≈ $0.13 ≈ 1.3 MAD | ≈ $4.86 ≈ 49 MAD |
| Against a 150 MAD subscription | ~1% | ~32% |

The conclusion that survives regardless of the exact numbers: **light tenants are fine and
heavy tenants are where the margin goes.** A flat price with unmetered document volume
transfers all volume risk to us. That is the actual decision in this ADR.

## Options

### Option A — Flat price, unmetered documents

**For** — simplest to sell; matches the brief; no surprise bills; no meter to explain to a
merchant.

**Against** — unbounded cost exposure per tenant; the heaviest users are the least
profitable, and they are also the ones the product is best for. Adverse selection.

### Option B — Flat price with a fair-use document cap, then overage or throttle

**For** — bounded exposure; cap can be set generously so most tenants never see it; aligns
cost with the driver.

**Against** — a cap is a product surface (counter, warnings, upgrade path, what happens at
the limit); "manual entry still available" must be genuinely usable, not a punishment.
CLAUDE.md §7.4 already requires exactly this degradation behaviour, so the mechanism is
mandated anyway — Option B mostly makes it customer-visible.

### Option C — Tiered plans by document volume

**For** — standard SaaS shape; revenue scales with the cost driver; heavy users self-select.

**Against** — the tenant must predict their volume at signup, which they cannot; risks
pricing out the exact merchant segment the brief targets at 100–200 MAD.

### Option D — Engineer the cost down until Option A is safe

Aggressive cheap-path routing, small/cheap model for classification with escalation to a
larger model only on low confidence, batching, caching by document hash, self-hosted OCR
for the rasterisation step.

**For** — preserves the simplest pricing; the engineering is worth doing regardless.

**Against** — cannot be relied on before it is measured; some of it (self-hosted OCR) is
real infrastructure work that competes with shipping features.

## Recommendation

**Instrument first, price second — and Option A + Option D as the launch position, with
Option B's mechanism built but its cap set to infinity.**

Concretely:

1. **Cost accounting is part of slice 1, not a later addition.** Every model call writes
   `(tenantId, documentId, provider, model, promptVersion, inputTokens, outputTokens,
   costMinorUnits, latencyMs, attemptNumber, path: text_layer|ocr)`. CLAUDE.md §7.2
   already requires most of these fields stored per extraction — this ADR adds that the
   **cost must be queryable per tenant per month**, and that first-attempt and retry cost
   must be distinguishable.
2. **Build the per-tenant cost cap and the degradation path from the start** (CLAUDE.md
   §7.4 requires it). Ship with the cap set high enough to be invisible. This means that
   when pricing changes, it is a configuration change, not a feature build.
3. **Publish an internal unit-economics dashboard from the first ten real tenants**: cost
   per document by path, documents per tenant per month distribution, cheap-path hit rate,
   retry rate, and gross margin per tenant. Review it before adding any feature that
   increases per-document model calls.
4. **Set a gate, and honour it:** if median cost per tenant per month exceeds ~15% of the
   subscription, engineering work on Option D takes priority over new features. If the
   90th percentile exceeds ~50%, adopt Option B's cap before scaling acquisition.
5. **Do not run a document through a large model to decide whether to run it through a
   large model.** Classification and routing use the cheap path, deterministic checks, or a
   small model.
6. **Cache by content hash.** CLAUDE.md §7.2 already requires a content hash for duplicate
   detection; reuse it so a re-uploaded document costs nothing. Free, and non-trivially
   common in practice.

Note this recommendation deliberately does not set a price. It makes the price a decision
that can be taken later on evidence, and makes the mechanism to enforce it exist beforehand.

## What would have to be true for this recommendation to be wrong

1. **Measured cost per document is negligible** (say under 0.5% of subscription even for
   heavy tenants). Then the metering, caps and dashboards are over-engineering; ship
   Option A and delete the machinery.
2. **Cost per document is so high that no flat price works** — e.g. if the merchant segment
   is dominated by poor-quality photos requiring multiple model passes. Then the product
   strategy changes before pricing does: either the segment narrows, or the price rises
   above the brief's band, or extraction moves to a self-hosted model. This is a
   business-model finding, not an engineering one, and it should surface within weeks.
3. **The price point is not actually fixed.** If 100–200 MAD was an aspiration rather than
   a market-tested constraint, the tension largely dissolves. *This is worth confirming with
   the owner — it is doing a lot of architectural work in CLAUDE.md for an unvalidated number.*
4. **Model prices fall faster than volume grows.** Plausible on recent trends, but not
   something to bet a business model on prospectively.
5. ~~**Revenue is not per-tenant.**~~ **CLOSED — negative (decision log D-01).** The first
   customer is the TPE, so revenue is per-tenant while cost stays per-document. The
   mismatch this ADR exists to manage is real and unavoidable.

> **Update 2026-07-27 (decision log D-01).** TPE-first makes this ADR's problem *worse*, and
> the reason is worth stating plainly. The target segment is merchants and artisans, whose
> documents are phone photos of thermal-printer *tickets de caisse* — the most expensive
> path and the least accurate. `P(cheap path)`, identified above as the single biggest cost
> lever, is likely to be **low** for this segment, not high. Measuring it moves from
> "important" to "the first number to look at in S1b".
>
> **Update 2026-07-27, second round (decision log D-06, D-07).** Condition 3 is now
> **closed — the price is soft.** 100–200 MAD/month is a placeholder in the brief with no
> analysis behind it. Two consequences:
>
> 1. **The figure should stop doing architectural work.** CLAUDE.md §1 says the price point
>    "constrains architecture"; that sentence rests on a number with nothing behind it, and
>    should be softened. Pricing machinery — tiers, overage, customer-visible caps — can wait
>    for a real price.
> 2. **The instrumentation recommendation survives on different grounds.** At a runway under
>    six months (D-06), burn matters regardless of what customers are eventually charged.
>    Measure cost per document because a surprise is unaffordable, not because of the 150 MAD.
>    Keep recommendations 1, 5 and 6 (cost accounting, cheap routing, hash caching); defer
>    2, 3 and 4 (caps, dashboards, margin gates) until there is revenue to have a margin on.
>
> W4 in ADR 0006 tests the price against paying users, which is the only thing that will
> actually answer it.

## Consequences if accepted

- A cost-accounting table and a per-tenant monthly aggregate, added in slice 1.
- An internal dashboard (not customer-facing initially).
- An explicit alert when a tenant approaches the cap (CLAUDE.md §13 already requires it).
- Every future PR that adds a model call to the document path must state its expected cost
  impact in the PR description, alongside the CLAUDE.md §14 requirement to state risk to
  the correctness of the books.
