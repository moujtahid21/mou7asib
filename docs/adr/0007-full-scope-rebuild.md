# ADR 0007 — Full-scope rebuild on the new design, phased

- **Status:** Accepted
- **Date:** 2026-08-14
- **Supersedes:** ADR 0006 ("Scope for the first six months")
- **Does not supersede:** ADR 0001 (custom stack). See "Why ADR 0001 stands" below.
- **Resolves:** the design mockup `Mou7asib Workspace.dc.html`'s implied scope
  vs. the narrower D2 wedge scope ADR 0006 chose.

---

## Context

`Mou7asib Workspace.dc.html` is a full-SaaS design mockup: dashboard, bank
reconciliation, an AI copilot chat panel, command palette, org switching,
dark/light theme, outgoing invoicing, TVA/IS screens. It was commissioned as
the target design for a real, multi-page application — not a reskin of the D2
demo, every screen backed by real data.

That is a materially larger surface than what ADR 0006 scoped D2 down to
(capture → documents list → review, single demo tenant, no ledger, no
dashboard, no bank rec). ADR 0006's reasoning for the narrower scope was sound
at the time: the full 16-slice plan in `docs/build-order.md` doesn't fit the
team's throughput, and slices S7 onward are gated on `docs/legal-inputs.md`,
which remains 77 rows of unanswered `TODO(legal)`.

The project owner has now explicitly decided to build the full scope for real,
accepting that:

1. This reopens S2–S15 of the original build order, on the timeline those
   slices always implied (the project's own estimate: 4+ months at 1.25 FTE,
   before counting the new UI layer the mockup adds on top).
2. The legal-data gap has not closed. No row in `docs/legal-inputs.md` has an
   answer yet.

## Decision

**Accepted, phased.** The full mockup gets built as a real application,
sequenced by technical dependency (tenancy before ledger, ledger before TVA,
history before posting suggestions, etc. — see the roadmap plan). Execution is
continuous across phases, not gated behind a fresh approval for each one.

### How the legal-data gap is resolved

CLAUDE.md §14/§15 are explicit: never invent a Moroccan legal rule, rate,
threshold, deadline, or form field; mark it `TODO(legal)` and surface it; don't
ship it behind a default. This ADR applies that literally rather than treating
it as a blocker on the engineering:

- Every engine that depends on a legally-sourced value — TVA rate table, IS
  brackets, RAS rule table, CGNC chart, invoice mentions list, SIMPL export
  format, états de synthèse structure — is built for real: correct data model,
  effective-dated where the law requires it, correct resolution logic,
  correct UI.
- It is **seeded with placeholder rows explicitly marked `TODO(legal)`**, not
  invented numbers presented as authoritative.
- Any user-facing output derived from a placeholder is **labelled
  non-authoritative** and, where the action would otherwise imply an official
  result, **blocked**: an invoice cannot be finalised against a placeholder
  mentions list (same as CLAUDE.md §5.6's "missing mention = cannot finalise",
  just triggered by an incomplete rule table instead of a missing field); a
  SIMPL export produces a clearly-marked "brouillon — non officiel" file, not
  something that could accidentally be submitted to the DGI.
- Replacing a placeholder with real legal data is then a configuration change,
  not a rewrite — the engine doesn't move.

This means the engineering is not blocked on the legal table, but the product
also never claims correctness it doesn't have.

### Nav and rollout honesty

The full navigation (Tableau de bord, Rapprochement, Réception, Facturation,
TVA & états, Paramètres) ships from the first phase. A screen whose phase
hasn't landed yet shows an explicit "not built yet" state — no fabricated
numbers, no invented rows — replaced page by page as its phase completes.

## Why ADR 0001 stands

Nothing here reopens the custom-stack-vs-Odoo question. ADR 0001's argument was
about who owns the ledger and the compliance layer at a *different* project
constraint (a two-person team's throughput on a runway). That constraint's
resolution (build the full scope, on the timeline it takes) doesn't change the
underlying analysis in ADR 0001 — an ERP would still buy the wrong thing for a
TPE-first, cost-sensitive, deeply Morocco-specific compliance product. ADR
0006's own text already anticipated this: reopening 0001 was only indicated if
the ledger came back onto a *hard* deadline. There is no hard deadline here.

## Consequences

- `docs/build-order.md`'s S2–S15 sequencing is back in effect (its own banner
  already said to read it "for the sequencing logic... not as a schedule" —
  this ADR turns it back into one, extended with the new UI-only phases the
  mockup adds).
- The D2 demo's narrow scope is superseded, not deleted: its real,
  working pieces (upload, extraction, review, duplicate detection, cost
  accounting) are the foundation the Réception screen and later the posting
  pipeline (S5/S6) build on, not replaced from scratch.
- Most of `docs/legal-inputs.md` stays open and off the *engineering* critical
  path, per the placeholder strategy above — but stays firmly on the
  *product-readiness* critical path: no filing, invoice, or declaration
  produced by a placeholder-seeded engine is fit to send to the DGI or a real
  customer until the real legal data lands.
- The full phase-by-phase roadmap and the concrete first-phase deliverable are
  tracked outside this ADR (implementation plan, kept current as phases land).
