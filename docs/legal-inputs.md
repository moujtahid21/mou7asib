# Moroccan legal inputs required before building — questionnaire for the accountant

- **Date:** 2026-07-27
- **Status:** every row unanswered
- **Purpose:** this is the list of legal facts the build needs that **neither
  PROJECT_BRIEF.md nor CLAUDE.md supplies**. Per CLAUDE.md §14, none of these may be
  invented, guessed, or defaulted. They are marked `TODO(legal)` and must be filled in
  from an authoritative source before the code that depends on them ships.

## How to use this document

Take it to the expert-comptable. For each row we need three things, not one:

1. **The value** — the rate, threshold, deadline, field list.
2. **The effective dates** — `effectiveFrom` and `effectiveTo`. CLAUDE.md §2 rule 8 makes
   every one of these effective-dated configuration. A value without dates is unusable,
   because the system must be able to book a 2024 invoice under 2024 rules.
3. **The source** — CGI article, Loi de Finances year and article, DGI circular, or DGI
   portal documentation. "My accountant said so" is not sufficient for a rule that will be
   applied automatically to thousands of tenants' books.

Historical values matter as much as current ones. A tenant onboarding in 2026 will import
prior-year history, and the reduced TVA rates in particular have been under multi-year
reform — so we need the **schedule**, not a snapshot.

**Legend:** `TODO(legal)` = required, not yet supplied. No row below has a provisional
value, deliberately.

---

## A. TVA — rates and effective dates

Blocks: `packages/accounting/src/tva/`, slice 4. PROJECT_BRIEF.md §4.1 names 20/14/10/7 as
the rates in use, but names no values-with-dates, no scope, and no reform schedule.

| ID | What we need | Why the build needs it | Value |
|---|---|---|---|
| L-01 | Full list of TVA rate codes in force, each with rate, `effectiveFrom`, `effectiveTo` | Seed of the `TvaRate` table; rate resolution is by `(rateCode, transactionDate)` per CLAUDE.md §5.3 | `TODO(legal)` |
| L-02 | The multi-year reform schedule for the reduced rates (which rate applies to which goods/services in which year) | Historical bookings must use the rate in force at their transaction date, not today's | `TODO(legal)` |
| L-03 | Which goods/services map to each reduced rate, precisely enough to classify | Needed for extraction validation and posting suggestion; also determines when to flag for review | `TODO(legal)` |
| L-04 | Exempt operations — with and without right of deduction (*exonéré avec/sans droit à déduction*) | These are different accounting treatments, not one "exempt" flag. Affects prorata numerator/denominator | `TODO(legal)` |
| L-05 | Out-of-scope (*hors champ*) operations | Distinct again from exempt; must not enter the prorata the same way | `TODO(legal)` |
| L-06 | Autoliquidation / reverse-charge cases and the exact *mention obligatoire* required on the invoice | CLAUDE.md §5.6 blocks finalisation on a missing mention | `TODO(legal)` |
| L-07 | TVA treatment of imports and of services purchased from non-residents | Common for a TPE buying SaaS abroad; affects both declaration and posting | `TODO(legal)` |

## B. TVA — regimes, deduction, prorata

| ID | What we need | Why the build needs it | Value |
|---|---|---|---|
| L-08 | Exact rules governing *régime d'encaissement* vs *régime de débit*: who may elect which, how the election is made, when it takes effect, and whether it can be changed | CLAUDE.md §5.3 requires both; determines *when* TVA becomes due, which is the most common source of wrong declarations | `TODO(legal)` |
| L-09 | The *décalage* rule for deducting input TVA, if any is currently in force, and its history | Determines the period in which input TVA is claimable | `TODO(legal)` |
| L-10 | Prorata de déduction: exact formula, what enters the numerator and the denominator | CLAUDE.md §5.3 requires storing numerator and denominator, not just the ratio — we need to know what they are | `TODO(legal)` |
| L-11 | Prorata: provisional application during the year and the regularisation mechanism and deadline | Drives an annual scheduled job and a correcting entry | `TODO(legal)` |
| L-12 | Immobilisations: the regularisation window (number of years) and the variation threshold that triggers a regularisation | Multi-year obligation; must be modelled from the start or retrofitting is painful | `TODO(legal)` |
| L-13 | Cash-payment threshold above which input TVA is **not deductible** — per transaction and/or per supplier per period — with effective dates | CLAUDE.md §5.3 mandates encoding this and warning the user. We must not guess the figure | `TODO(legal)` |
| L-14 | Corresponding threshold for deductibility of the **charge itself** for IS purposes, if different from L-13 | Feeds the IS *réintégrations* table; frequently confused with L-13 | `TODO(legal)` |
| L-15 | Rules on non-deductible input TVA by nature (e.g. certain vehicles, fuel, accommodation, gifts) | Posting rules must route these to the right account without user intervention | `TODO(legal)` |
| L-16 | Treatment of TVA credit: carry-forward, and conditions/procedure for refund (*remboursement*) | Affects the declaration and the balance-sheet position | `TODO(legal)` |

## C. TVA — filing

| ID | What we need | Why the build needs it | Value |
|---|---|---|---|
| L-17 | Turnover threshold and any activity criteria determining monthly vs quarterly filing, with effective dates | CLAUDE.md §5.3 derives frequency from configuration + prior-year turnover; we need the actual threshold | `TODO(legal)` |
| L-18 | Filing and payment deadlines for each frequency, and the rule when a deadline falls on a weekend or public holiday | Drives the *échéancier* (PROJECT_BRIEF.md §4.2) and user reminders. Note Moroccan public holidays include lunar-calendar dates | `TODO(legal)` |
| L-19 | Whether electronic filing via SIMPL is mandatory, for whom, and from what threshold | Determines whether the SIMPL export is optional or the only path | `TODO(legal)` |
| L-20 | Penalties and *majorations* for late filing and late payment | Needed to warn the user honestly, and they are non-deductible charges feeding L-27 | `TODO(legal)` |
| L-21 | Obligation and format of any TVA annexes (e.g. a listing of deductions/purchases filed with the declaration) | This is often a separate structured file with its own schema | `TODO(legal)` |

## D. SIMPL export format

Blocks: `packages/accounting/src/filings/simpl/`, slice 7. CLAUDE.md §5.3 requires a
versioned adapter. **We currently have no specification at all.**

| ID | What we need | Why the build needs it | Value |
|---|---|---|---|
| L-22 | The official DGI specification for the TVA declaration file: format (XML/EDI/CSV/XLSX), schema or XSD, encoding, version | Cannot build the adapter without it. This is the single largest unknown in the filing feature | `TODO(legal)` |
| L-23 | Complete field list of the TVA declaration form, with each field's derivation from ledger balances | Every declaration line must be traceable to journal lines. A field we cannot derive is a schema gap | `TODO(legal)` |
| L-24 | Whether SIMPL offers an API/upload endpoint or is manual upload only; authentication method if API | Determines whether "no manual export" is achievable for filing | `TODO(legal)` |
| L-25 | The annexe/listing file format, if separate (see L-21) | Second adapter, second schema | `TODO(legal)` |
| L-26 | How the DGI communicates format version changes, and whether old versions remain accepted | Determines the adapter versioning strategy | `TODO(legal)` |

## E. IS — Impôt sur les Sociétés

Blocks: slice 9.

| ID | What we need | Why the build needs it | Value |
|---|---|---|---|
| L-27 | IS brackets and rates, with `effectiveFrom`/`effectiveTo`, including the current multi-year convergence schedule | CLAUDE.md §5.5 forbids hardcoding. Rates have changed year over year | `TODO(legal)` |
| L-28 | Whether different rates apply by activity or status (e.g. exporters, industrial companies, CFC, ZAI) and the conditions | Changes which bracket table applies per tenant | `TODO(legal)` |
| L-29 | *Cotisation minimale*: rate, base (which revenue lines), minimum amount in MAD, exemption period for new companies | Computed even at a loss; a common source of unpleasant surprises for TPEs | `TODO(legal)` |
| L-30 | *Acomptes provisionnels*: number, calculation basis, due dates, and the rules for suspending or adjusting them | Drives the payment calendar | `TODO(legal)` |
| L-31 | *Déficits reportables*: carry-forward duration for ordinary losses vs the portion attributable to depreciation | CLAUDE.md §5.5 names the distinction but not the durations | `TODO(legal)` |
| L-32 | Standard *réintégrations* list — non-deductible charges, with the rule for each | Pre-fills the *tableau de passage*; each line needs an explanation string for the user | `TODO(legal)` |
| L-33 | Standard *déductions extra-comptables* list | Same table, other column | `TODO(legal)` |
| L-34 | Maximum tax-deductible depreciation rates by asset class | Excess depreciation is a *réintégration*; needs the rate table | `TODO(legal)` |
| L-35 | IS filing deadline (relative to fiscal year end) and payment deadlines | Échéancier | `TODO(legal)` |
| L-36 | The official *liasse fiscale* / IS return field list and file format, if electronic filing is required | Same problem as L-22, for IS | `TODO(legal)` |
| L-37 | Whether the fiscal year may differ from the calendar year and any constraints | Period model must support it if so | `TODO(legal)` |

## F. Retenue à la source (RAS)

Blocks: slice 8. CLAUDE.md §5.4 requires a rule table keyed on
`(paymentNature, payeeType, residentStatus, effectiveFrom, effectiveTo)`. **We have the
schema; we have none of the rows.**

| ID | What we need | Why the build needs it | Value |
|---|---|---|---|
| L-38 | The complete list of payment natures subject to RAS | Defines the `paymentNature` enum. An incomplete list means silently missed withholding | `TODO(legal)` |
| L-39 | For each nature: rate, base of calculation, effective dates | The rule table itself | `TODO(legal)` |
| L-40 | For each nature: whether liability arises at invoice date or payment date | CLAUDE.md §5.4 explicitly refuses to assume this. It varies | `TODO(legal)` |
| L-41 | Different rates for resident vs non-resident payees; interaction with double-taxation treaties and the procedure to apply a treaty rate | Non-resident payments are common (foreign SaaS, consultants) | `TODO(legal)` |
| L-42 | Whether the payee being a company vs an individual vs a *profession libérale* changes the rate | Part of the composite key | `TODO(legal)` |
| L-43 | Any de-minimis threshold below which no RAS is due | Without it we either over-withhold or flag everything | `TODO(legal)` |
| L-44 | RAS declaration: periodicity, deadlines, form, and file format if electronic | Second filing adapter | `TODO(legal)` |
| L-45 | Required content of the *attestation de retenue à la source* issued to the payee | It is a generated legal document; missing mentions make it useless to the payee | `TODO(legal)` |
| L-46 | Payment deadline for withheld amounts, and penalties for late payment | Échéancier and warnings | `TODO(legal)` |
| L-47 | Which CGNC accounts are conventionally used for each RAS type | The rule table maps to accounts (CLAUDE.md §5.4) | `TODO(legal)` |

## G. Outgoing invoices — mentions obligatoires

Blocks: slice 6. CLAUDE.md §5.6 lists mentions but explicitly frames them as requiring
validation against the law. Missing mention = cannot finalise, so a wrong list either
blocks valid invoices or ships invalid ones.

| ID | What we need | Why the build needs it | Value |
|---|---|---|---|
| L-48 | The authoritative list of mandatory invoice mentions, with the legal source for each (CGI vs Code de commerce — they are different obligations) | The finalisation validator. Each mention needs its own rule and error message | `TODO(legal)` |
| L-49 | Which mentions are conditional, and on what (CNSS, patente/TP, RC, capital social, forme juridique) | Otherwise we block a sole trader for lacking a company-only mention | `TODO(legal)` |
| L-50 | Rules governing invoice numbering: what "unbroken sequence" legally requires, whether multiple series are permitted, whether the sequence resets annually | CLAUDE.md §5.6 mandates a per-tenant per-series DB sequence; we need to know whether annual reset is permitted or prohibited | `TODO(legal)` |
| L-51 | Required mentions and numbering rules for *avoirs* (credit notes), and whether they share the invoice sequence | Immutability corrections go through *avoirs* | `TODO(legal)` |
| L-52 | Rules on invoice language (French / Arabic) and currency for domestic invoices | Affects i18n and the PDF renderer, not just labels | `TODO(legal)` |
| L-53 | Required mentions for exempt and autoliquidation invoices (cross-ref L-06) | Conditional validator rules | `TODO(legal)` |
| L-54 | Legal requirements for an electronic invoice: signature, archival format, integrity guarantees | CLAUDE.md §5.6 requires designing so e-invoicing can be added without a rewrite. We need to know what it will demand | `TODO(legal)` |
| L-55 | Status and timetable of DGI *facturation électronique* mandates, and any published technical specification | Determines how urgently the canonical invoice representation must anticipate it | `TODO(legal)` |
| L-56 | Penalties for non-compliant invoices | For honest user-facing warnings | `TODO(legal)` |

## H. Accounting records, retention, and the chart of accounts

| ID | What we need | Why the build needs it | Value |
|---|---|---|---|
| L-57 | Legal retention period for accounting books, and for supporting documents (invoices, statements) — stated separately if they differ | CLAUDE.md §8.6 says encode it as configuration and explicitly says *don't invent it*. It also bounds GDPR/CNDP deletion requests | `TODO(legal)` |
| L-58 | Retention period start point: fiscal year end, document date, or filing date | Changes the deletion schedule by up to a year | `TODO(legal)` |
| L-59 | Legal requirements on the accounting journal: mandatory journals, chronological order, prohibition on modification, *clôture* requirements | Validates the CLAUDE.md §2 rules 3 and 4 design against actual law | `TODO(legal)` |
| L-60 | Requirements for computerised accounting systems: audit trail, whether any certification/attestation of the software is required, whether a fiscal audit file format exists | **A certification requirement, if one exists, is a go/no-go for the whole product.** Ask this one early | `TODO(legal)` |
| L-61 | Authoritative machine-readable CGNC chart of accounts (all classes 0–9, standard account codes and labels, FR and AR) | Seed data. Must come from an authoritative source, not a scraped PDF | `TODO(legal)` |
| L-62 | Criteria determining *régime normal* vs *régime simplifié*, and which états de synthèse each requires | CLAUDE.md §5.2 makes this a tenant setting; we need the criteria | `TODO(legal)` |
| L-63 | Official line-by-line structure of each of the five états de synthèse (Bilan, CPC, ESG, Tableau de financement, ETIC), with the account-to-line mapping | These are golden-file tests (CLAUDE.md §12). Without the official structure there is nothing to test against | `TODO(legal)` |
| L-64 | Whether the *régime de l'auto-entrepreneur* / CPU is in scope, and its distinct obligations | Materially different obligations; changes the product's scope. Ask before assuming out of scope | `TODO(legal)` |

## I. Identifiers

| ID | What we need | Why the build needs it | Value |
|---|---|---|---|
| L-65 | ICE: exact format, length, and check-digit/validation algorithm if any | Enables client-side validation and extraction cross-checking. Without it we cannot verify an extracted ICE | `TODO(legal)` |
| L-66 | IF (Identifiant Fiscal): format and validation rules | Same | `TODO(legal)` |
| L-67 | RC, patente/TP, CNSS number: formats and which entity types must have each | Conditional invoice mentions (L-49) | `TODO(legal)` |
| L-68 | Whether a public ICE lookup/verification service exists | Would materially improve extraction accuracy and duplicate/fraud detection | `TODO(legal)` |

## J. Data protection — CNDP / Loi 09-08

Blocks ADR 0002. **These are the questions that decide where the product may be hosted.**

| ID | What we need | Why the build needs it | Value |
|---|---|---|---|
| L-69 | Whether processing this data requires a CNDP declaration or authorisation, and which | Compliance prerequisite to launch | `TODO(legal)` |
| L-70 | Rules on cross-border transfer of personal data: which destination countries are permitted, and the exact authorisation mechanism and timeline | **Directly determines whether a US or EU hosted model provider and non-Moroccan hosting are lawful.** ADR 0002 is blocked on this | `TODO(legal)` |
| L-71 | Whether accounting/financial data carries any residency obligation beyond general personal-data rules | May be stricter than L-70 | `TODO(legal)` |
| L-72 | Data subject rights under Loi 09-08 and how they interact with the L-57 retention obligation | We must be able to tell a user precisely what we can and cannot delete | `TODO(legal)` |
| L-73 | Breach notification obligations and deadlines | Incident response runbook | `TODO(legal)` |
| L-74 | Whether a sub-processor (AI provider, hosting, object storage) requires prior notification or authorisation | CLAUDE.md §8.6 requires flagging each new sub-processor; we need to know the actual procedure | `TODO(legal)` |

## K. Banking (informational — see ADR 0003)

| ID | What we need | Why the build needs it | Value |
|---|---|---|---|
| L-75 | Whether Bank Al-Maghrib has mandated open-banking APIs, and the access route for a non-bank vendor | Decides ADR 0003 option B vs A | `TODO(legal)` |
| L-76 | Whether licensed account-aggregation providers with Moroccan coverage exist, and their regulatory status | Decides ADR 0003 option C | `TODO(legal)` |
| L-77 | RIB/IBAN format and validation rules for Moroccan accounts | Validation and *lettrage* matching | `TODO(legal)` |

---

## Priority ordering

Not everything is needed at once. Ordered by what blocks the earliest slice:

| Priority | Rows | Blocks |
|---|---|---|
| **Now — before any code** | L-60, L-70, L-71 | Software certification and data residency are go/no-go questions. A wrong answer invalidates the architecture, not a feature |
| **Before slice 3** (ledger) | L-59, L-61, L-57 | Journal legal requirements, CGNC seed, retention |
| **Before slice 4** (TVA) | L-01 – L-05, L-08, L-13 | The TVA engine |
| **Before slice 6** (invoicing) | L-48 – L-51, L-65 – L-67 | The finalisation validator |
| **Before slice 7** (SIMPL) | L-17 – L-26 | The filing adapter |
| **Before slice 8** (RAS) | L-38 – L-47 | The RAS rule table |
| **Before slice 9** (IS) | L-27 – L-37 | The passage table |
| **Before prorata work** | L-10 – L-12, L-16 | Prorata and regularisation |
| **Before statements** | L-62, L-63 | États de synthèse golden files |
| **When bank work starts** | L-75 – L-77 | ADR 0003 |
| **Before launch** | L-69, L-72 – L-74, L-56, L-20 | Compliance and user-facing warnings |

Two rows deserve to be asked in the first conversation, because a bad answer stops the
project rather than delaying a feature:

- **L-60** — is there a certification/approval requirement for computerised accounting
  software in Morocco?
- **L-70** — may accounting data containing personal data leave Morocco, and under what
  authorisation?
