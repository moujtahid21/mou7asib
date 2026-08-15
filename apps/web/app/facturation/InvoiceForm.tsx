"use client";

import { useActionState } from "react";
import { createInvoiceDraft, type CreateInvoiceState } from "@/app/actions/createInvoiceDraft";
import { MAX_INVOICE_LINES } from "@/lib/invoicing";

export interface RateOption {
  rateCode: string;
  label: string;
}

const initialState: CreateInvoiceState = null;
const todayIso = () => new Date().toISOString().slice(0, 10);

export default function InvoiceForm({ rates }: { rates: RateOption[] }) {
  const [state, formAction, isPending] = useActionState(createInvoiceDraft, initialState);

  return (
    <form action={formAction} className="rounded-xl border border-border bg-surface p-4 shadow-card">
      <h2 className="m-0 text-[13.5px] font-semibold text-fg">Nouvelle facture (brouillon)</h2>

      <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div>
          <label htmlFor="if-customer-name" className="block text-xs font-medium text-fg-2">Client</label>
          <input
            id="if-customer-name"
            name="customerName"
            required
            className="mt-1 w-full rounded-lg border border-border-2 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="if-customer-ice" className="block text-xs font-medium text-fg-2">ICE client</label>
          <input
            id="if-customer-ice"
            name="customerIce"
            className="mt-1 w-full rounded-lg border border-border-2 px-2 py-1.5 text-sm font-mono"
          />
        </div>
        <div>
          <label htmlFor="if-customer-if" className="block text-xs font-medium text-fg-2">IF client</label>
          <input
            id="if-customer-if"
            name="customerIf"
            className="mt-1 w-full rounded-lg border border-border-2 px-2 py-1.5 text-sm font-mono"
          />
        </div>
        <div>
          <label htmlFor="if-issue-date" className="block text-xs font-medium text-fg-2">Date</label>
          <input
            id="if-issue-date"
            name="issueDate"
            type="date"
            defaultValue={todayIso()}
            required
            className="mt-1 w-full rounded-lg border border-border-2 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="if-payment-terms" className="block text-xs font-medium text-fg-2">Conditions de paiement</label>
          <input
            id="if-payment-terms"
            name="paymentTerms"
            placeholder="ex. 30 jours net"
            className="mt-1 w-full rounded-lg border border-border-2 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="text-xs text-fg-2">
              <th scope="col" className="p-1 text-start font-medium">Description</th>
              <th scope="col" className="p-1 text-end font-medium">Qté</th>
              <th scope="col" className="p-1 text-end font-medium">PU HT</th>
              <th scope="col" className="p-1 text-start font-medium">Taux TVA</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: MAX_INVOICE_LINES }, (_, i) => i).map((i) => (
              <tr key={i}>
                <td className="p-1">
                  <input
                    name={`description_${i}`}
                    className="w-full rounded border border-border-2 px-2 py-1 text-xs"
                  />
                </td>
                <td className="p-1">
                  <input
                    name={`quantity_${i}`}
                    inputMode="decimal"
                    defaultValue={i === 0 ? "1" : ""}
                    className="w-16 rounded border border-border-2 px-2 py-1 text-end font-mono text-xs tabular-nums"
                  />
                </td>
                <td className="p-1">
                  <input
                    name={`unitPriceHt_${i}`}
                    inputMode="decimal"
                    placeholder="0.00"
                    className="w-24 rounded border border-border-2 px-2 py-1 text-end font-mono text-xs tabular-nums"
                  />
                </td>
                <td className="p-1">
                  <select name={`rateCode_${i}`} className="rounded border border-border-2 px-1.5 py-1 text-xs">
                    {rates.map((rate) => (
                      <option key={rate.rateCode} value={rate.rateCode}>
                        {rate.label}
                      </option>
                    ))}
                  </select>
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
