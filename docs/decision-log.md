# Decision log — inputs resolved by the project owner

Running record of answers to questions the ADRs and the build order were blocked on.
Each entry states the answer, and — more importantly — **what it changes**.

---

## 2026-07-27 — first round

### D-01 · First customer is the **TPE**, not the fiduciaire

**Changes:**

- **ADR 0001 flip condition 2 is closed — negative.** The "sell to accounting firms, so
  Odoo's DB-per-tenant cost stops mattering" escape route is gone. Thousands of small
  tenants is exactly the shape that makes per-tenant database cost the deciding factor.
  **The custom-stack recommendation is now stronger than when written.**
- **ADR 0004 flip condition 3 is closed — negative.** The Sage/Cegid connector is not a
  sales requirement. It stays off the critical path; the accountant surface (R1) and the
  historical journal import remain the parts worth building.
- **ADR 0005 flip condition 5 is closed — negative.** Revenue is per-tenant while cost is
  per-document, so the mismatch this ADR is about is real and unavoidable.
- **ADR 0005 gets worse, not better.** TPE-first means merchants and artisans, which means
  phone photos of thermal-printer *tickets de caisse* — the most expensive extraction path
  and the least accurate. The `P(cheap path)` term, which the ADR identifies as the single
  biggest cost lever, is likely to be *low* for this segment rather than high. This raises
  the priority of measuring it.

### D-02 · Vercel is **provisional** — "deployed on Vercel to test it first"

**Changes:**

- Vercel is a starting point, not a permanent architectural constraint. This was ADR 0001's
  flip condition 4; it is now closed, and it weakens one objection to Odoo — but the
  multi-tenancy cost argument that D-01 just strengthened is the load-bearing one, so the
  ADR 0001 recommendation is unaffected.
- **ADR 0002 item 6 is promoted from "cheap insurance" to the core of the design.** No
  Vercel-only primitives: no Vercel KV, no Vercel Blob, no logic in edge middleware. Option
  C (everything on one container platform) is now the *expected destination* rather than a
  contingency, so the cost of arriving there must stay near zero.
- Migration off Vercel should be a Dockerfile and a DNS change. If at any point it would be
  more than that, something has gone wrong and it is a bug, not a trade-off.

### D-03 · Team of **two**

**Changes:**

- **ADR 0001 flip condition 3 is partially closed.** Two people is not the one-person case
  that would have favoured a worse-but-faster Odoo module. It is still a small team, so the
  build order's discipline about thin slices matters more, not less.
- **ADR 0002 flip condition 2 is a live concern.** Two platforms means two deploy pipelines,
  two secret stores and two on-call surfaces for two people. The recommendation (split)
  still stands because the §8.4 sandboxing requirement is not optional — but combined with
  D-02, the argument for going to Option C sooner rather than later is stronger than the
  ADR as written suggests.
- **Runway is still unanswered**, and it is the other half of ADR 0001 flip condition 3.

### D-04 · Node.js target — **accepted: 24.x**

**Applied.** CLAUDE.md §4 updated: Node 24.x (Krypton, active LTS), with the engine-floor
table and the `engines`/`.nvmrc` requirement recorded inline.

**Immediate action:** this machine runs **Node 22.11.0**, which is below Prisma 7.9.0's
`^22.12` floor. It must be upgraded to 24.x before slice S0 runs.

The other five corrections proposed in `docs/version-verification.md` (@types/node,
@types/react exact pins, the TensorFlow justification, the mypy 2.x note) are **not yet
applied** — they were not part of the question that was answered.

### D-05 · No access to real Moroccan invoices yet

**This is the most consequential answer of the round**, because slice S1 — the spike that
tests the core product premise — was defined as measuring extraction accuracy against a
corpus of real anonymised Moroccan documents that does not exist.

**Changes:** S1 splits into S1a and S1b. See `docs/build-order.md`.

The honest position: **extraction accuracy cannot be measured without real documents**, and
no amount of synthetic data substitutes for a photo of a real *ticket de caisse* taken in a
badly lit shop. Anything measured before S1b is a measurement of the harness, not of the
product.

Corpus acquisition is now a **tracked dependency with an owner and a date**, sitting on the
critical path alongside the legal questions.

---

## 2026-07-27 — second round

### D-06 · Runway is **under six months** *(closes Q-2)*

**The most consequential answer so far.** Combined with D-03 (team of two), it means the
sixteen-slice plan in `docs/build-order.md` cannot be completed — the arithmetic is set out
in ADR 0006. Best case reaches slice S6 at ~4.5 months, having spent the entire runway on a
product that cannot yet produce a single statutory filing, and having left the two riskiest
business assumptions untested until month four.

**Changes:**

- **ADR 0001 flip condition 3 is now fully open**, and it was the condition that would
  favour a worse-but-shipping approach. It is addressed head-on in ADR 0006, which argues
  the answer is to narrow scope rather than to change stack — because the wedge product
  needs no ledger, and a ledger is the only thing Odoo would have bought us. **ADR 0001's
  recommendation stands, but conditionally on ADR 0006 being accepted.** If ADR 0006 is
  rejected and the full scope is kept on a six-month clock, ADR 0001 genuinely does need
  reopening.
- **ADR 0006 written.** Recommends the extraction wedge: ship ingestion, review and
  structured export; defer the ledger, TVA, états de synthèse, SIMPL, RAS and IS.
- `docs/build-order.md` slices S2–S15 become the post-wedge roadmap rather than the plan.

### D-07 · The 100–200 MAD/month price is **a placeholder in the brief** *(closes Q-1)*

No analysis behind it.

**Changes:**

- **ADR 0005 flip condition 3 is closed — the price is soft.** The figure should stop doing
  architectural work. CLAUDE.md §1 currently states the price point "constrains
  architecture"; that sentence is resting on a number with nothing behind it.
- The metering and cost-accounting recommendation **survives on different grounds**: at a
  sub-six-month runway, burn matters regardless of what customers are eventually charged.
  Measure cost per document because we cannot afford surprises, not because of the 150 MAD.
- Pricing machinery (caps, tiers, overage) can stay minimal until there is a real price.
- W4 in ADR 0006 tests the price with paying users, which is the only way to answer it.

### D-08 · Corpus route is **the founders' own business documents** *(closes Q-3)*

Options 2 (friendly businesses) and 3 (via an expert-comptable) were not selected.

**Changes:**

- **This is a weak corpus and the plan should say so.** Two founders' documents are a small,
  biased sample — supplier PDFs and utility bills, not the creased thermal *tickets de
  caisse* from a hardware shop that D-01's target segment will actually photograph. Accuracy
  measured on it will read better than reality.
- Sufficient for **S1a/W1**: enough to prove the harness and get a first cost-per-document
  signal. Not sufficient for a trustworthy accuracy claim.
- **ADR 0006 resolves this structurally rather than by finding more documents:** the wedge's
  first ten customers become the corpus. Every user grows the regression fixture set.
- **The expert-comptable route is still the highest-leverage unclaimed action in the
  project** and should be pursued anyway — one relationship supplies documents, answers
  `docs/legal-inputs.md`, and reaches the TPEs who are the first customers. It has the
  longest lead time of anything here. Recorded as Q-4.

---

## 2026-07-27 — third round

### D-09 · The expert-comptable is **downstream of a demo**, not upstream *(closes Q-4)*

There is a contact, but they need something to show first — "at least an MVP".

**This inverts a dependency I had backwards.** The previous two rounds treated the
accountant as the thing to secure first, because they supply documents, legal answers and a
channel to customers. That is unavailable on those terms. The real graph is:

```
demo  →  accountant  →  { anonymised documents, legal answers (77 rows), first customers }
```

**Changes:**

- **A showable demo is now the single highest-priority artefact in the project**, because it
  is the key that unlocks three other dependencies at once. It moved from a by-product of
  W4 to the gating milestone.
- It must be buildable from **only what exists today**: the founders' own documents (D-08),
  no legal answers, no customers. That is a real constraint on what the demo can contain —
  and conveniently, it rules out anything requiring the legal table.
- The demo must be built to convince **an accountant**, not a general audience. What earns
  a yes from them is narrow: photograph a real Moroccan invoice, watch the right fields come
  out, see where on the document each number came from, and see what happens when the system
  is unsure. Not a dashboard, not a chart of accounts, not a ledger.
- ADR 0006 restructured accordingly — see Revision 2 in that document.

**Warning attached to this decision:** once the accountant is interested, the temptation
will be to let them upload real client documents into the demo. **Do not**, until CLAUDE.md
§8.4 (upload handling) and §8.6 (CNDP, sub-processors) are actually satisfied. Real client
invoices are third-party personal and financial data. A demo built on the founders' own
documents carries no such exposure; the moment it holds someone else's client files, it
does.

### D-10 · Q-5/Q-6 — weak positive signal, not validation

"Some companies let their bookkeepers use this software to help them in their work."

**Changes:**

- Mild support for ADR 0006's premise that a structured export reaching a bookkeeper is a
  coherent product: there is precedent for a business and its bookkeeper working in shared
  software.
- **It is not validation.** It is a restatement of the assumption from observation rather
  than from asking anyone. ADR 0006 flip conditions 1 and 5 stay open.
- **But D-09 supplies the validation mechanism.** The demo → accountant conversation *is*
  the test of Q-5 and Q-6. The accountant will say, unprompted, whether they would use the
  output and in what format. So these no longer need a separate discovery exercise — they
  are answered by the milestone we now have to hit anyway. The loop closes.

### D-11 · Part-time alongside study — **no hard cliff** *(closes Q-7)*

**This triggers ADR 0006 flip condition 2**, and it cuts both ways:

- **Good:** there is no six-month cliff. "Under six months" was savings runway, not a
  deadline after which work stops. The panic framing in ADR 0006 — "reach revenue before the
  money runs out" — is wrong and should be withdrawn.
- **Bad:** two part-time students is materially less throughput than the two working
  full-time that ADR 0006's arithmetic assumed. Call it ~1.25 FTE against the 2 FTE assumed.
  **Calendar estimates roughly double.**

**Net effect: the wedge recommendation survives and strengthens.** With a longer horizon the
full sixteen-slice plan is no longer impossible — but at ~1.25 FTE it is *further* out of
reach within any reasonable planning window, so narrow scope matters more, not less. What
changes is the *reason*: scope is now narrow because throughput is low, not because a
deadline is approaching.

Practical consequences:

- Plan in **calendar weeks at part-time pace**, and do not treat a slowed week as failure.
- **Avoid work in progress across two people.** At this throughput, two half-finished
  slices are worse than one finished one.
- The `docs/legal-inputs.md` lead time is now an *advantage*: answers arriving over weeks
  no longer block, because we will not reach the slices needing them for months.

---

## Still open

| # | Question | Blocks |
|---|---|---|
| Q-5 | Will a TPE pay for extraction without bookkeeping? | ADR 0006 flip condition 1 — now answered by the demo → accountant conversation (D-09/D-10) rather than separately |
| Q-6 | Will an expert-comptable accept a structured export, and in what format? | ADR 0006 flip condition 5 — same conversation |
| Q-8 | What, concretely, would make this contact say "yes, I'd use this"? | Defines the demo's acceptance criterion. Worth asking them *before* building, even without a demo — it is a five-minute question and it aims the whole milestone |

---

## 2026-08-02 — D2's first real-document test

### D-12 · Schema targets commercial invoices, not household bills — confirmed on a real document

Ran D2's pipeline end to end against a real Moroccan document for the first time — an
anonymised household electricity bill, used with the data subject's explicit, scoped
consent (local processing only, no cloud AI provider, deletable afterward). No document
content is recorded here, only what the test revealed about the product. Processing stayed
on local Ollama throughout; the agent assisting with this work did not read the document or
its extracted values, to honour the "local only" condition of that consent.

**Changes:**

- **The safety design holds on a real document, not just synthetic ones.** Fields redacted
  in the source image (customer name, ICE, IF) came back empty rather than hallucinated —
  CLAUDE.md §7.2's "flag rather than guess" worked under real conditions, including a
  document type never specifically prompted for.
- **Surfaces a genuine document-type mismatch, not a bug.** `InvoiceExtraction` implicitly
  assumes `total_ttc` *is* the amount owed — true for a commercial *facture*, not
  necessarily for a utility bill, which can carry a "Net à payer" distinct from the period's
  TTC (carried-over balance, adjustments — concepts the schema has no field for). The model
  extracted a plausible "amount to pay" rather than the literal TTC line, reasonable given
  the prompt but not what the schema means by `total_ttc`.
- **Household bills are out of scope, and that's why this is a fine result, not a bad one.**
  CLAUDE.md's domain is a TPE's own business invoicing (supplier *factures* for
  bookkeeping/TVA), not household bills. This doesn't lower confidence in D1/D2's numbers —
  it confirms the schema targets the right document class and hasn't yet been tested against
  it specifically.
- **The representative S1b test is still open**: a real commercial invoice (a supplier bill
  to the founders' own business), not a utility bill. Corpus acquisition (D-05/D-08) remains
  the real dependency.
- **Process worth repeating for future real-document sourcing**: third-party document →
  explicit scoped consent from the data subject → visual redaction of identifying fields →
  flatten to a rasterized image (removes any residual PDF text layer under the redaction,
  which a black box alone does not) → process locally → keep the agent assisting with the
  work out of the actual content, reporting only in general/qualitative terms → delete or
  gitignore afterward. Slower than just using a document, but it is what let this test
  happen at all instead of being blocked entirely.

---

## 2026-08-02 — D2 dashboard extension

### D-13 · PDF upload + document management: retry/soft-delete/correction semantics

Extended D2 with PDF upload (Moroccan businesses commonly receive invoices as PDF, not just
photos — confirmed by D-12's real-document test) and document management: richer list/filter,
delete, retry, and editable extracted fields. Verified end to end against the real local
worker: a synthetic PDF (not personal data) uploaded, routed correctly to the cheap
text-layer path, extracted, grounded (21/23 fields with real bounding boxes), reviewed,
edited, reverted, deleted, and retried — all confirmed working via direct testing.

**Changes:**

- **Retry creates a new `ExtractionJob` row, never reuses/resets the failed one.** Preserves
  the failed job's audit history (CLAUDE.md §7.1) rather than overwriting it — mirrors
  `Document.currentAttemptId`'s existing "reprocess creates a new attempt, repoints, doesn't
  delete" pattern one level up. Idempotency-guarded: a document already `queued`/`processing`
  can't get a second competing job.
- **Delete is soft on the `Document` row (`deletedAt`), hard on the file bytes.** CLAUDE.md
  §9 wants soft-delete for non-ledger user-facing records — nothing here is a ledger record
  yet. But the raw image/PDF is the most sensitive artifact (can show more than the extracted
  fields), and there's no legal retention obligation yet blocking its immediate physical
  removal (CLAUDE.md §8.6), so it's actually deleted while metadata + an audit trail survive.
  **No purge job for soft-deleted rows** — kept indefinitely; revisit only once a real legal
  retention obligation exists to purge against.
- **Editing a field adds override columns (`overrideValueText`/`overrideValueDecimal`/
  `correctedAt`), never overwrites the model's original output.** Display rule everywhere:
  `override ?? original`. This is voluntary, not a CLAUDE.md compliance requirement (the
  append-only rule is about posted ledger entries, which don't exist yet) — done because
  overwriting in place would permanently destroy the "was the model right on this field"
  signal D1/S1a's whole accuracy-measurement mission depends on.
- **Two residual gaps flagged, not solved, consistent with this project's practice of naming
  a gap rather than silently narrowing scope:**
  - PDF parsing (PyMuPDF, in the worker) has no process/container sandboxing yet (CLAUDE.md
    §8.4) — a wall-clock timeout stopgap only, same reasoning already accepted for D2's
    malware-scan deferral (single demo tenant, founders' own documents only). A prerequisite
    before this ever accepts a document from anyone else.
  - PDF metadata (author, embedded XMP GPS some scanners write) has no stripping step —
    no vetted Node PDF-metadata tool exists in this stack yet, matching the same
    "don't reach for an unverified capability" discipline already applied to `sharp`/HEIC.
