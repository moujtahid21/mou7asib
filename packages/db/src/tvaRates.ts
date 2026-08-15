/**
 * Placeholder TVA rate and cash-threshold seed data (CLAUDE.md §14 / §5.3).
 *
 * **Every row here is `isPlaceholder: true` and MUST stay that way until
 * docs/legal-inputs.md L-01 (rate codes/values/effective dates), L-02 (the multi-year
 * reform schedule), and L-13 (the cash-payment threshold) are resolved from an
 * authoritative source (CGI, Loi de Finances, DGI documentation).**
 *
 * The four percentage values below (20/14/10/7) are not invented — CLAUDE.md §5.3 itself
 * states them as "rates in use" in this project's own instructions. What is NOT verified
 * here: the exact effective-dating (L-02's reform schedule — recent Lois de Finances have
 * been changing which goods/services sit at which reduced rate), and the cash threshold
 * figure is a round placeholder with no source at all, present only so the engine
 * (packages/accounting's resolveCashThreshold) has something real to resolve and the UI
 * has something to warn about honestly labelled as unverified.
 *
 * `effectiveFrom` is set far enough in the past (2015-01-01) to cover any transaction date
 * this app will realistically see in its current form, NOT because that's when these rates
 * actually took effect — that date is itself unverified pending L-02.
 */
export interface TvaRateSeed {
  rateCode: string;
  label: string;
  rate: string;
  effectiveFrom: string;
  legalSourceNote: string;
}

const PLACEHOLDER_NOTE =
  "TODO(legal) L-01/L-02 — value taken from CLAUDE.md §5.3's list of rates in use; exact effective-dating and the reduced-rate reform schedule are not verified against an authoritative CGI/Loi de Finances source.";

export const TVA_RATE_SEEDS: readonly TvaRateSeed[] = [
  { rateCode: "NORMAL_20", label: "Taux normal 20 %", rate: "0.2000", effectiveFrom: "2015-01-01", legalSourceNote: PLACEHOLDER_NOTE },
  { rateCode: "REDUIT_14", label: "Taux réduit 14 %", rate: "0.1400", effectiveFrom: "2015-01-01", legalSourceNote: PLACEHOLDER_NOTE },
  { rateCode: "REDUIT_10", label: "Taux réduit 10 %", rate: "0.1000", effectiveFrom: "2015-01-01", legalSourceNote: PLACEHOLDER_NOTE },
  { rateCode: "REDUIT_7", label: "Taux réduit 7 %", rate: "0.0700", effectiveFrom: "2015-01-01", legalSourceNote: PLACEHOLDER_NOTE },
  {
    rateCode: "EXONERE",
    label: "Exonéré",
    rate: "0.0000",
    effectiveFrom: "2015-01-01",
    legalSourceNote:
      "TODO(legal) L-04 — modelled as a single 0% code for now; exonéré avec/sans droit à déduction are different accounting treatments and are not distinguished yet.",
  },
  {
    rateCode: "HORS_CHAMP",
    label: "Hors champ",
    rate: "0.0000",
    effectiveFrom: "2015-01-01",
    legalSourceNote: "TODO(legal) L-05 — distinct from exonéré; not yet distinguished from it in the prorata sense.",
  },
];

// No TvaCashThreshold seed row: CLAUDE.md §5.3/§14 requires the figure to come from an
// authoritative source, and nothing in this codebase's inputs (including CLAUDE.md
// itself) gives one — unlike the rate percentages above. Shipping a placeholder *number*
// here (even labelled non-official) would be inventing a legal fact, which CLAUDE.md §15
// explicitly bans. The table and the engine (resolveCashThreshold) are ready; the row is
// what's missing, and its absence is itself the honest signal — see the TVA screen's
// "seuil non configuré" state.
