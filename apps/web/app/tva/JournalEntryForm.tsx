"use client";

import { useActionState } from "react";
import { createJournalEntry, type CreateEntryState } from "@/app/actions/createJournalEntry";
import { MAX_ENTRY_LINES } from "@/lib/ledger";

const initialState: CreateEntryState = null;

export interface AccountOption {
  code: string;
  label: string;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function JournalEntryForm({ accounts }: { accounts: AccountOption[] }) {
  const [state, formAction, isPending] = useActionState(createJournalEntry, initialState);

  return (
    <form action={formAction} className="rounded-xl border border-border bg-surface p-4 shadow-card">
      <h2 className="m-0 text-[13.5px] font-semibold text-fg">Nouvelle écriture (brouillon)</h2>

      <datalist id="account-codes">
        {accounts.map((account) => (
          <option key={account.code} value={account.code}>
            {account.label}
          </option>
        ))}
      </datalist>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="date" className="block text-xs font-medium text-fg-2">
            Date
          </label>
          <input
            id="date"
            name="date"
            type="date"
            defaultValue={todayIso()}
            required
            className="mt-1 w-full rounded-lg border border-border-2 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="journalCode" className="block text-xs font-medium text-fg-2">
            Journal
          </label>
          <input
            id="journalCode"
            name="journalCode"
            defaultValue="OD"
            required
            className="mt-1 w-full rounded-lg border border-border-2 px-2 py-1.5 text-sm font-mono"
          />
        </div>
        <div>
          <label htmlFor="label" className="block text-xs font-medium text-fg-2">
            Libellé
          </label>
          <input
            id="label"
            name="label"
            required
            className="mt-1 w-full rounded-lg border border-border-2 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="text-xs text-fg-2">
              <th scope="col" className="p-1 text-start font-medium">
                Compte
              </th>
              <th scope="col" className="p-1 text-start font-medium">
                Libellé ligne
              </th>
              <th scope="col" className="p-1 text-end font-medium">
                Débit
              </th>
              <th scope="col" className="p-1 text-end font-medium">
                Crédit
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: MAX_ENTRY_LINES }, (_, i) => i).map((i) => (
              <tr key={i}>
                <td className="p-1">
                  <input
                    name={`accountCode_${i}`}
                    list="account-codes"
                    placeholder="ex. 6111"
                    className="w-28 rounded border border-border-2 px-2 py-1 font-mono text-xs"
                  />
                </td>
                <td className="p-1">
                  <input name={`label_${i}`} className="w-full rounded border border-border-2 px-2 py-1 text-xs" />
                </td>
                <td className="p-1">
                  <input
                    name={`debit_${i}`}
                    inputMode="decimal"
                    placeholder="0.00"
                    className="w-28 rounded border border-border-2 px-2 py-1 text-end font-mono text-xs tabular-nums"
                  />
                </td>
                <td className="p-1">
                  <input
                    name={`credit_${i}`}
                    inputMode="decimal"
                    placeholder="0.00"
                    className="w-28 rounded border border-border-2 px-2 py-1 text-end font-mono text-xs tabular-nums"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {state?.error !== undefined && (
        <p role="alert" className="mt-3 rounded-lg border border-neg bg-neg-bg p-2.5 text-sm text-neg">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="mt-3 rounded-lg bg-fg px-4 py-2 text-sm font-medium text-bg disabled:opacity-60"
      >
        {isPending ? "Enregistrement…" : "Enregistrer le brouillon"}
      </button>
    </form>
  );
}
