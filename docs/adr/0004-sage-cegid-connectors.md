# ADR 0004 — Sage / Cegid connectors and the accountant interface

- **Status:** Proposed — awaiting decision by the project owner
- **Date:** 2026-07-27
- **Resolves:** CLAUDE.md §16 decision 4

---

## Context

PROJECT_BRIEF.md §3 requires an interface for experts-comptables / fiduciaires with
"connexion directe à Sage, Cegid ou au système actuel de l'utilisateur", and states
plainly: **"Pas d'exportation manuelle. Pas de double saisie."**

The requirement as written cannot be designed against, because "Sage" and "Cegid" are not
products — they are vendor portfolios spanning many products, editions, generations and
deployment models (desktop, on-premise server, and cloud), each with a different
integration surface or none at all. Which of these a Moroccan fiduciaire actually runs is
an empirical question that nobody on the project has answered yet.

Answering it wrongly is expensive: an integration built against the wrong product is a
total loss, and integration work is among the least reusable code in the codebase.

## The two requirements hiding in one sentence

They have very different costs and should be decided separately:

**R1 — The accountant surface.** A logged-in expert-comptable can read the tenant's books,
post and correct entries, and close a period, inside mou7asib. This is entirely within our
control. CLAUDE.md §8.1 already specifies the `AccountantAccess` grant with scope and
expiry, and §8.2 already defines `accountant_external` as a role.

**R2 — The connector.** The accountant's *existing* Sage/Cegid installation stays the
system of record and mou7asib feeds it (or vice versa). This depends entirely on
third-party products we have not identified.

R1 delivers most of the user value — "no double entry" is satisfied if the accountant
works *in* mou7asib. R2 is only needed for accountants who will not change tools.

## Options

### Option A — Build R1 only; defer R2 until the target products are identified

**For** — fully within our control; delivers the "no double entry" promise for
accountants willing to work in the product; no integration built on a guess.

**Against** — does not satisfy the brief's literal "connexion directe"; loses accountants
who are contractually or habitually locked to their existing tool.

### Option B — R1 plus a versioned file-exchange adapter (structured export/import)

An export in a documented, versioned format that Sage/Cegid can ingest (their journal-entry
import formats), automated and scheduled rather than hand-driven, plus an import path for
the accountant's opening balances and historical entries.

**For**
- Works with *every* generation of both vendors' products, including desktop installs with
  no API at all — which is likely a large share of the Moroccan market.
- Cheap. It is a serialiser over the ledger we already have.
- The import direction is independently valuable: onboarding a tenant means loading their
  historical journal, and CLAUDE.md §7.2 says intelligent posting learns from the tenant's
  own history. **Without a historical import there is no history to learn from, and the
  headline AI feature is cold on day one.** This is the strongest argument in this ADR.

**Against**
- A scheduled file drop is arguably still "exportation", just automated. Whether that
  satisfies the brief is the owner's call.
- Round-tripping risks divergence if both systems are edited.

### Option C — Build a real API/database connector to one specific product now

**For** — satisfies the brief literally; a genuine differentiator if it hits the right product.

**Against**
- Requires knowing the product, version, deployment model, licensing and API terms. We
  know none of these.
- Database-level integration into a third-party accounting product is the worst of the
  three mechanisms: unsupported, version-fragile, and it writes to a ledger whose
  invariants we do not control. Would need a strong justification.
- High risk of building for a product no target customer runs.

### Option D — Build connectors for both vendors, broadly

Rejected: unbounded scope against unidentified products, before a single customer exists.

## Recommendation

**Option B, sequenced — and R2 is gated on discovery, not on engineering.**

1. **Ship R1 first.** The `AccountantAccess` grant, the accountant role and the accountant
   views. This is on the critical path and independent of any third party.
2. **Build the import direction of R2 before the export direction.** Historical journal
   import is a prerequisite for intelligent posting, so it earns its place regardless of
   whether any connector is ever built. Design it as a general "journal entry import"
   (normalised CSV/Excel, with a mapping profile per source system) rather than as a
   Sage-specific or Cegid-specific feature — the same profile pattern as ADR 0003.
3. **Do not design the export/connector interface until this discovery is complete:**

   | Question | Why it changes the design |
   |---|---|
   | Which exact products, editions and versions do the target fiduciaires run? | Determines whether an API exists at all |
   | Cloud, on-premise server, or desktop? | Desktop ⇒ file exchange is the only option |
   | Does the accountant want mou7asib → their system, their system → mou7asib, or both? | Determines direction and conflict handling |
   | Which is the system of record? | Determines who owns sequence allocation and period close |
   | What are the API/licensing terms for third-party integration? | May prohibit the integration outright |

   *Method: interview five real fiduciaires. Timebox: one week. Cheaper than one wrong
   sprint.*

4. **When R2 export is built, isolate it.** One adapter per target system under
   `packages/accounting/src/connectors/<system>/`, versioned, behind a shared port —
   exactly the pattern CLAUDE.md §5.3 mandates for the SIMPL adapter. Format details must
   never leak outside the adapter directory.

**Answer the "system of record" question before writing a line of connector code.** If the
accountant's Sage instance is the system of record and mou7asib feeds it, then CLAUDE.md §2
rules 2, 3 and 4 (balance, append-only, closed periods) are being enforced by a system we
do not control, and much of the correctness argument for `packages/accounting` weakens.
That is an architectural fork, not an integration detail.

## What would have to be true for this recommendation to be wrong

1. **Discovery finds one dominant product with a clean documented API.** If most target
   fiduciaires run the same modern cloud product, Option C against it becomes a strong
   differentiator and should be built early.
2. **Accountants refuse to work in a new tool at all.** If R1 has no adopters, the whole
   accountant surface is wasted effort and only R2 matters — reverse the sequencing.
3. ~~**The fiduciaire is the buyer, not the TPE.**~~ **CLOSED — negative (decision log
   D-01).** The first customer is the TPE. The connector is therefore not a sales
   requirement and stays off the critical path. The parts of this ADR that survive on their
   own merits are the accountant surface (R1) and, more importantly, the historical journal
   import — which slice S4 needs regardless, because intelligent posting has nothing to
   learn from without it.
4. **A licensing term prohibits third-party integration** with the target product. Then
   Option B's file exchange is not a fallback, it is the only lawful route — which is an
   argument for building it first anyway.

## Consequences if accepted

- `AccountantAccess` (scope + expiry + audit) is on the critical path and needs its own
  tenant-isolation tests (CLAUDE.md §8.1).
- Historical journal import needs a mapping-profile model, a dry-run preview, and
  idempotency — it writes to the ledger, so it is a high-risk path deserving a second
  reviewer per CLAUDE.md §14.
- No third-party service or dependency is added in v1.
- Discovery is a real, scheduled task with an owner — not an assumption to be revisited
  "later".
