# COMPETITION.md — mou7asib

Competitive landscape and positioning. Read alongside `PROJECT_BRIEF.md` (what we build)
and `CLAUDE.md` (how we build it).

**Purpose of this file:** it tells you *which differentiators must be visible in the
product*, not just in the pitch. If a feature listed in §4 as a wedge feature is buried
three menus deep or shipped without a demo path, we have built the right thing and lost
anyway.

---

## 0. Source quality — read this before trusting anything below

| Claim type | Confidence | Basis |
|---|---|---|
| Comptably's feature set | **Medium-high** | Their public homepage, fetched 2026-07-27 |
| Comptably's entry price (399 MAD/mois) | **Medium** | Stated on their homepage as a starting price |
| Comptably's tier structure | **Unknown** | Pricing page is client-rendered; not readable |
| Comptably's traction (500+ firms, 2,000+ users, 99.9% uptime) | **Low** | Unverified marketing copy |
| Absence of a feature | **Low-medium** | Absence from a homepage ≠ absence from a product |

Their site footer reads 2025, so the material may be somewhat stale.

**Everything in §2 marked "not mentioned" is an inference from marketing copy, not a
verified gap.** Before betting the roadmap on any of it, run the verification tasks in §7.

---

## 1. The competitor: Comptably (comptably.ma)

A cloud ERP for Moroccan TPE/PME. Positioning: one integrated platform replacing
spreadsheets and double entry across invoicing, stock, purchasing, sales, treasury,
payroll and accounting.

**Their automation thesis is workflow integration.** A sale updates stock, generates the
accounting entry, and feeds treasury in real time. Re-keying disappears for transactions
that *originate inside their system*.

**Our automation thesis is document ingestion.** Re-keying disappears for documents that
arrive *from outside* — a supplier PDF, an emailed invoice, a photographed receipt.

These are different problems. They are not primarily competing with us; they are competing
with Excel and with legacy desktop accounting packages. We compete with the two hours a
week a merchant spends typing supplier invoices into something.

Compliance ground they claim and we must match to be credible at all:
CGNC/PCGM, DGI-compliant invoices with ICE and HT/TVA/TTC detail, sequential numbering,
automatic journal entries, grand livre, balance générale, and the états de synthèse
(bilan, CPC, ESG).

---

## 2. Feature gap matrix

Legend: ✅ present · ❌ not mentioned on their site · ➖ out of scope for us · 🅿️ planned

| Capability | Comptably | mou7asib | Note |
|---|---|---|---|
| **Document ingestion (our wedge)** ||||
| OCR / photo capture of invoices | ❌ | ✅ core | Nothing on their site mentions OCR, AI or photo capture |
| AI extraction (n° facture, dates, HT/TVA/TTC, ICE) | ❌ | ✅ core | |
| Learned posting from tenant's own history | ❌ | ✅ core | |
| Confidence-scored review queue | ❌ | ✅ core | The "no invoice lost, none miscoded" promise |
| Mobile-first photo capture | ❌ | ✅ core | They give no sign of a mobile app |
| **Compliance parity (table stakes)** ||||
| CGNC / PCGM chart of accounts | ✅ | ✅ | Parity required |
| Bilan, CPC, ESG | ✅ | ✅ | Parity required |
| Tableau de financement, ETIC | ❓ | ✅ | They name only three of the five statements |
| DGI-compliant invoicing, ICE, sequential numbering | ✅ | ✅ | Parity required |
| Grand livre, balance générale | ✅ | ✅ | Parity required |
| TVA declaration prep | ✅ | ✅ | |
| IS / liasse fiscale prep | ✅ | ✅ | |
| **Compliance depth (our wedge)** ||||
| SIMPL-compatible file generation | ❌ | ✅ core | They say "ready to transmit," which is softer |
| Retenue à la source (RAS) rule engine | ❌ | ✅ core | Hardest Moroccan mechanic; unmentioned by them |
| Prorata de déduction (mixed activities) | ❌ | ✅ core | Unmentioned by them |
| Régime encaissement vs débit | ❓ | ✅ | Unmentioned; common source of wrong filings |
| **Connectivity (our wedge)** ||||
| Bank reconciliation / lettrage | ❌ | ✅ core | Unmentioned by them |
| Sage / Cegid connectors | ❌ | ✅ core | They target accounting firms as *customers*, not as integrations |
| Dedicated accountant portal | ❓ | ✅ core | They have a cabinet-comptable landing page; unclear if it's a product surface |
| **Their strengths, our gaps** ||||
| Payroll (CNSS, AMO, IR sur salaire) | ✅ | ❌ | See §5 |
| Stock (FIFO, CMP, multi-dépôt, inventaire) | ✅ | ❌ | See §5 |
| Purchase cycle (BC, réception, 3-way match) | ✅ | 🅿️ | Partially implied by our supplier-invoice flow |
| HR, projects, tasks | ✅ | ➖ | Not our product |
| Sector verticals (8 industries) | ✅ | ➖ v1 | See §6 |
| Arabic UI / RTL | ✅ | ✅ | Parity required — they ship 5 languages |

---

## 3. Positioning statement

> Comptably digitises the transactions you create.
> **mou7asib digitises the paper that lands on your desk.**

Longer form, for the landing page and the pitch:

> Moroccan accounting software assumes you'll type your invoices in. mou7asib assumes
> you'll photograph them. Snap a supplier invoice, and it's extracted, coded against the
> CGNC the way *you* coded the last one from that supplier, and posted — or flagged, if
> the system isn't sure. Nothing is lost, nothing is silently miscoded.

Rules for using this:

- **Never position as "cheaper ERP."** That is a race we lose to an incumbent with stock
  and payroll modules already built.
- **Never claim feature parity we don't have.** If a prospect needs stock management,
  say so and lose the deal cleanly. A churned customer costs more than a lost one.
- The comparison we want is not mou7asib vs Comptably. It is **mou7asib vs. the two hours
  a week currently spent on data entry**, and mou7asib vs. the fiduciaire's shoebox.

---

## 4. What this means for the product (actionable)

These are constraints on implementation, not marketing suggestions.

1. **The capture flow is the product.** Photo → extracted → reviewed → posted must be
   reachable within seconds of first login and must work on a mid-range Android phone over
   3G. If it takes more than three taps, the differentiator is invisible. Budget the JS
   payload accordingly (`CLAUDE.md` §10).
2. **Show the extraction, don't hide it.** Every extracted field displays its source
   region on the document and its confidence. The magic is only persuasive if it's
   legible. This is also why `CLAUDE.md` §7.2 requires storing bounding boxes.
3. **The review queue is a feature, not an apology.** Frame flagged items as "3 invoices
   need your eye," never as extraction failure. Design it as a fast triage surface — the
   thing the user opens daily.
4. **Learning must be visible.** When the system proposes a posting, show the historical
   entry it learned from. "Coded like your March invoice from Atlas Distribution" beats a
   confidence percentage for trust.
5. **RAS and prorata are demo-able differentiators.** They are also the two features most
   likely to be got silently wrong (`CLAUDE.md` §5.3–5.4). Correctness here is a sales
   asset; a wrong number here is existential.
6. **Arabic and RTL are parity, not polish.** The incumbent ships five languages. Shipping
   French-only reads as unfinished in this market.
7. **The accountant surface is a distribution channel.** A fiduciaire with 40 clients is a
   40-seat deal. Build the accountant portal as a first-class product, not a permission
   flag — and make the Sage/Cegid connector the thing that makes them say yes.

---

## 5. Their strengths we've chosen not to match (yet)

**Payroll (CNSS, AMO, IR sur salaire).** For a Moroccan TPE with three employees, monthly
payroll is a pain comparable to invoice entry. Its absence will lose feature-comparison
deals. It is also a large, high-liability build with its own effective-dated scales.

*Decision: out of v1. Revisit once extraction accuracy and retention are proven.* Have an
honest answer ready: mou7asib exports what your payroll provider or fiduciaire needs.

**Stock (FIFO/CMP, multi-dépôt).** Our stated audience — merchants and artisans — often
needs stock more than they need clever bookkeeping. This is the sharpest tension in our
positioning: the segment we named may not be the segment our wedge serves best.

*Decision: out of v1, and treat as a segmentation question, not a feature question.* Our
strongest early buyer is more likely a **service business or professional practice with
high invoice volume and no inventory** — consultants, agencies, cabinets, small
contractors. Validate this before building for merchants.

---

## 6. Go-to-market: the part we can copy legitimately

Comptably runs a substantial SEO content engine: tax calculators (TVA, IS, IR, CNSS, net
salary, margin), a Moroccan accounting glossary, statement templates, a Q&A base, and
eight sector landing pages.

This is the most replicable part of their business for a small team, and it captures
exactly our buyer at exactly the moment they're searching.

- Build free calculators as public, indexable pages from month one. A TVA calculator costs
  a day and ranks indefinitely.
- Treat their topic list as a **keyword map**, nothing more.
- **Do not copy their text.** It is their copyright, and duplicate content would sink our
  own ranking regardless. Write original explanations, and cite the CGI / Loi de Finances
  directly.
- Public content pages have no auth and touch no tenant data — keep them in a separate
  route group so no accounting logic sits behind an unauthenticated route.

---

## 7. Verification tasks (do these before acting on §2)

Absence from a homepage is weak evidence. Confirm before betting the roadmap:

- [ ] Sign up for their public demo. Run a full cycle: create an invoice → post → produce
      CPC → produce a TVA declaration. Record where it's good and where it's thin.
- [ ] Confirm whether any document-upload or OCR capability exists in the product.
- [ ] Read the actual pricing tiers (browser, not fetcher) — entry price, what's included,
      per-user cost, annual discount.
- [ ] Check whether the états de synthèse are real derived reports or static templates.
- [ ] Check for a mobile app in the Play Store / App Store.
- [ ] Identify other players: Sage Maroc, Cegid, Odoo partners in Morocco, and any local
      OCR-first entrant. Comptably is one competitor, not the market.
- [ ] Interview five target users. Ask what they'd pay and what they do today. Their answer
      to "would you pay 200 MAD" is worth more than any price inferred from a competitor.

---

## 8. The pricing problem (unresolved)

Their stated entry point is **399 MAD/month**. Our brief targets **100–200 MAD/month**.

We would undercut the established local price by half to three-quarters **while carrying
per-document AI inference costs they do not have**. That is a deliberate bet and it needs
evidence, not optimism.

Three viable resolutions — pick one consciously:

1. **Hold the low price, narrow the product.** Capture + posting + TVA only. Volume play.
   Requires per-document cost well under ~1 MAD and disciplined scope.
2. **Price at parity or above, sell the time saved.** If we save four hours a month,
   399 MAD is trivially justified. Requires the extraction to genuinely work.
3. **Tier on volume.** Low entry tier with a monthly document cap, priced up from there.
   Aligns revenue with our real cost driver.

**Blocking action:** instrument cost per document from the very first prototype
(`CLAUDE.md` §7.4 requires per-tenant cost tracking anyway). No pricing decision is valid
before that number exists.

---

## 9. Maintenance

Re-verify this file quarterly, and immediately if a competitor ships document capture.
Record what changed and when. Do not let it drift into folklore — a stale competitive
assumption is worse than none, because it gets acted on with confidence.

Last updated: 2026-07-27. Based on comptably.ma homepage only.
