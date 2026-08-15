"use client";

import { useState } from "react";
import { useActionState } from "react";
import { postDocumentEntry, type PostDocumentEntryState } from "@/app/actions/postDocumentEntry";
import { MAX_ENTRY_LINES } from "@/lib/ledger";
import type { TvaBreakdown } from "@/lib/tvaResolution";

export interface AccountOption {
  code: string;
  label: string;
}

export interface PostedEntrySummary {
  status: "draft" | "posted";
  date: string;
  journalCode: string;
  label: string;
}

export interface PostingSuggestionSummary {
  supplierName: string;
  matchCount: number;
  earliestDate: string;
  debitAccount: { code: string; label: string; frequency: number };
  creditAccount: { code: string; label: string; frequency: number };
}

interface PostingPanelProps {
  documentId: string;
  accounts: AccountOption[];
  postedEntry: PostedEntrySummary | null;
  suggestion: PostingSuggestionSummary | null;
  tvaBreakdown: TvaBreakdown | null;
  tvaRegime: "encaissement" | "debit" | null;
  cashThreshold: string | null;
  defaultDate: string | null;
  defaultLabel: string;
  defaultAmount: string | null;
}

const initialState: PostDocumentEntryState = null;

interface RowDefault {
  accountCode: string;
  label: string;
  debit: string;
  credit: string;
}

function buildRowDefaults(
  suggestion: PostingSuggestionSummary | null,
  tvaBreakdown: TvaBreakdown | null,
  defaultAmount: string | null,
): RowDefault[] {
  const rows: RowDefault[] = Array.from({ length: MAX_ENTRY_LINES }, () => ({
    accountCode: "",
    label: "",
    debit: "",
    credit: "",
  }));

  if (tvaBreakdown !== null && tvaBreakdown.unresolvedCount === 0 && tvaBreakdown.postingLines.length > 0) {
    let i = 0;
    rows[i] = { accountCode: suggestion?.debitAccount.code ?? "", label: "Base HT", debit: tvaBreakdown.totalHt, credit: "" };
    i += 1;
    for (const line of tvaBreakdown.postingLines) {
      if (i >= MAX_ENTRY_LINES - 1) break;
      rows[i] = { accountCode: line.accountCode, label: line.label, debit: line.amount, credit: "" };
      i += 1;
    }
    rows[i] = { accountCode: suggestion?.creditAccount.code ?? "4411", label: "Fournisseur", debit: "", credit: tvaBreakdown.totalTtc };
    return rows;
  }

  rows[0] = { accountCode: suggestion?.debitAccount.code ?? "", label: "", debit: defaultAmount ?? "", credit: "" };
  rows[1] = { accountCode: suggestion?.creditAccount.code ?? "", label: "", debit: "", credit: defaultAmount ?? "" };
  return rows;
}

// Manual posting — the ledger is only ever written by a human confirming a form, never by
// a suggestion or the TVA engine itself (CLAUDE.md §5 rule 5). Three sources feed the
// prefill, none of them authoritative on their own: S6's posting suggestion (accounts),
// S7's TVA breakdown (packages/accounting's computeTvaLines, via lib/tvaResolution.ts —
// amounts), and the extracted TTC as a last-resort fallback when no TVA lines were
// extracted or a rate didn't resolve. postDocumentEntry.ts still re-validates everything.
export default function PostingPanel({
  documentId,
  accounts,
  postedEntry,
  suggestion,
  tvaBreakdown,
  tvaRegime,
  cashThreshold,
  defaultDate,
  defaultLabel,
  defaultAmount,
}: PostingPanelProps) {
  const boundAction = postDocumentEntry.bind(null, documentId);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);
  const [isCash, setIsCash] = useState(false);

  if (postedEntry !== null) {
    return (
      <div className="mt-3 rounded-xl border border-pos/30 bg-pos-bg p-3.5 text-[12.5px] text-pos">
        <strong className="font-semibold">
          {postedEntry.status === "posted" ? "Comptabilisé" : "Écriture en brouillon (période verrouillée)"}
        </strong>{" "}
        — {postedEntry.journalCode}, {postedEntry.date}, {postedEntry.label}. Voir le{" "}
        <a href="/tva" className="underline">
          grand livre
        </a>
        .
      </div>
    );
  }

  const rowDefaults = buildRowDefaults(suggestion, tvaBreakdown, defaultAmount);
  const ttcForThresholdCheck = tvaBreakdown?.totalTtc ?? defaultAmount;
  const exceedsThreshold =
    isCash && cashThreshold !== null && ttcForThresholdCheck !== null && Number(ttcForThresholdCheck) > Number(cashThreshold);

  return (
    <form action={formAction} className="mt-3 rounded-xl border border-ai-border bg-ai-bg p-3.5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="m-0 text-[13px] font-semibold text-ai">Comptabiliser ce document</h2>
        <span className="rounded-md border border-border bg-surface px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-fg-2">
          Saisie manuelle — non comptabilisé
        </span>
      </div>

      {suggestion !== null && (
        <div className="mt-3 rounded-lg border border-ai-border bg-surface p-2.5 text-[11.5px] text-fg-2">
          <span className="font-semibold text-ai">Précédent utilisé —</span> {suggestion.matchCount} facture
          {suggestion.matchCount > 1 ? "s" : ""} de {suggestion.supplierName} comptabilisée
          {suggestion.matchCount > 1 ? "s" : ""} en {suggestion.debitAccount.code} depuis{" "}
          {suggestion.earliestDate}. Comptes pré-remplis ci-dessous — à vérifier avant de confirmer, ce
          n&apos;est pas un ordre.
          <input type="hidden" name="suggestedAccountCode_0" value={suggestion.debitAccount.code} />
          <input type="hidden" name="suggestedAccountCode_1" value={suggestion.creditAccount.code} />
        </div>
      )}

      {tvaBreakdown !== null && (
        <div className="mt-3 rounded-lg border border-ai-border bg-surface p-2.5 text-[11.5px]">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-ai">TVA — non officiel (taux placeholder, voir CLAUDE.md §5.3)</span>
            {tvaRegime === null && (
              <span className="rounded-md border border-warn/30 bg-warn-bg px-1.5 py-0.5 text-[10.5px] font-semibold text-warn">
                Régime TVA non défini
              </span>
            )}
          </div>
          <table className="mt-2 w-full border-collapse text-[11px]">
            <thead>
              <tr className="text-fg-3">
                <th scope="col" className="p-1 text-start font-medium">Taux extrait</th>
                <th scope="col" className="p-1 text-start font-medium">Taux résolu</th>
                <th scope="col" className="p-1 text-end font-medium">Base HT</th>
                <th scope="col" className="p-1 text-end font-medium">TVA</th>
              </tr>
            </thead>
            <tbody>
              {tvaBreakdown.rows.map((row) => (
                <tr key={row.groupIndex} className="border-t border-border">
                  <td className="p-1">{row.ratePercentLabel}</td>
                  <td className="p-1">
                    {row.rateCode ?? <span className="text-neg">non reconnu</span>}
                  </td>
                  <td className="p-1 text-end font-mono tabular-nums">{row.baseHt}</td>
                  <td className="p-1 text-end font-mono tabular-nums">{row.tvaAmount ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {tvaBreakdown.unresolvedCount > 0 ? (
            <p className="mt-2 text-neg">
              {tvaBreakdown.unresolvedCount} taux non reconnu(s) — comptes non pré-remplis, saisie manuelle
              nécessaire ci-dessous.
            </p>
          ) : (
            <p className="mt-2 text-fg-3">
              Total HT {tvaBreakdown.totalHt} + TVA {tvaBreakdown.totalTva} = TTC {tvaBreakdown.totalTtc}
            </p>
          )}
        </div>
      )}

      <label className="mt-3 flex items-center gap-2 text-[11.5px] text-fg-2">
        <input type="checkbox" checked={isCash} onChange={(e) => setIsCash(e.target.checked)} />
        Réglé en espèces
      </label>
      {isCash && cashThreshold === null && (
        <p className="mt-1 text-[11px] text-fg-3">Seuil de déductibilité en espèces non configuré — TODO(legal), voir CLAUDE.md §5.3.</p>
      )}
      {exceedsThreshold && (
        <p className="mt-1 rounded-lg border border-warn/30 bg-warn-bg p-2 text-[11.5px] text-warn">
          Montant supérieur au seuil configuré ({cashThreshold} MAD, non officiel) — la TVA pourrait ne pas être
          déductible. À vérifier.
        </p>
      )}

      <datalist id="posting-account-codes">
        {accounts.map((account) => (
          <option key={account.code} value={account.code}>
            {account.label}
          </option>
        ))}
      </datalist>

      <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <div>
          <label htmlFor="pd-date" className="block text-xs font-medium text-fg-2">
            Date
          </label>
          <input
            id="pd-date"
            name="date"
            type="date"
            defaultValue={defaultDate ?? new Date().toISOString().slice(0, 10)}
            required
            className="mt-1 w-full rounded-lg border border-border-2 bg-surface px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="pd-journal" className="block text-xs font-medium text-fg-2">
            Journal
          </label>
          <input
            id="pd-journal"
            name="journalCode"
            defaultValue="ACH"
            required
            className="mt-1 w-full rounded-lg border border-border-2 bg-surface px-2 py-1.5 text-sm font-mono"
          />
        </div>
        <div>
          <label htmlFor="pd-label" className="block text-xs font-medium text-fg-2">
            Libellé
          </label>
          <input
            id="pd-label"
            name="label"
            defaultValue={defaultLabel}
            required
            className="mt-1 w-full rounded-lg border border-border-2 bg-surface px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse text-sm">
          <thead>
            <tr className="text-xs text-fg-2">
              <th scope="col" className="p-1 text-start font-medium">Compte</th>
              <th scope="col" className="p-1 text-start font-medium">Libellé ligne</th>
              <th scope="col" className="p-1 text-end font-medium">Débit</th>
              <th scope="col" className="p-1 text-end font-medium">Crédit</th>
            </tr>
          </thead>
          <tbody>
            {rowDefaults.map((row, i) => (
              <tr key={i}>
                <td className="p-1">
                  <input
                    name={`accountCode_${i}`}
                    list="posting-account-codes"
                    placeholder="ex. 6111"
                    defaultValue={row.accountCode}
                    className="w-28 rounded border border-border-2 bg-surface px-2 py-1 font-mono text-xs"
                  />
                </td>
                <td className="p-1">
                  <input
                    name={`label_${i}`}
                    defaultValue={row.label}
                    className="w-full rounded border border-border-2 bg-surface px-2 py-1 text-xs"
                  />
                </td>
                <td className="p-1">
                  <input
                    name={`debit_${i}`}
                    inputMode="decimal"
                    placeholder="0.00"
                    defaultValue={row.debit}
                    className="w-28 rounded border border-border-2 bg-surface px-2 py-1 text-end font-mono text-xs tabular-nums"
                  />
                </td>
                <td className="p-1">
                  <input
                    name={`credit_${i}`}
                    inputMode="decimal"
                    placeholder="0.00"
                    defaultValue={row.credit}
                    className="w-28 rounded border border-border-2 bg-surface px-2 py-1 text-end font-mono text-xs tabular-nums"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {state?.error !== undefined && (
        <p role="alert" className="mt-2 rounded-lg border border-neg bg-neg-bg p-2 text-sm text-neg">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="mt-3 rounded-lg bg-fg px-4 py-2 text-sm font-medium text-bg disabled:opacity-60"
      >
        {isPending ? "Comptabilisation…" : "Comptabiliser"}
      </button>
    </form>
  );
}
