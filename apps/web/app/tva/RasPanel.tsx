"use client";

import { useActionState } from "react";
import { evaluateRasPayment } from "@/app/actions/evaluateRasPayment";

export interface RasRuleRow {
  paymentNature: string;
  payeeType: string;
  residentStatus: string;
  ratePercent: string;
  effectiveFrom: string;
}

export interface RasWithholdingRow {
  id: string;
  payeeName: string;
  paymentNature: string;
  status: "flagged" | "computed";
  baseAmount: string;
  rasAmount: string | null;
  netPayable: string | null;
  createdAt: string;
  attestationHref: `/tva?attestation=${string}` | null;
}

// CLAUDE.md §5.4 — this is a client component only because useActionState needs it; the
// form itself degrades to a normal POST. canEvaluate gates the form the same way every
// other write surface on this page does.
export default function RasPanel({
  rules,
  history,
  canEvaluate,
  attestationText,
}: {
  rules: RasRuleRow[];
  history: RasWithholdingRow[];
  canEvaluate: boolean;
  attestationText: string | null;
}) {
  const [state, formAction, isPending] = useActionState(evaluateRasPayment, null);

  return (
    <section className="rounded-xl border border-border bg-surface p-4 shadow-card">
      <h2 className="m-0 text-[13.5px] font-semibold text-fg">Retenue à la source — non officielle</h2>
      <p className="mt-1 text-[11.5px] text-fg-2">
        Table de règles TODO(legal) L-38–L-47 — aucune règle n&apos;est configurée, donc
        chaque paiement évalué est signalé pour vérification manuelle plutôt que de
        supposer qu&apos;aucune retenue n&apos;est due (CLAUDE.md §5.4).
      </p>

      {rules.length === 0 ? (
        <p className="mt-2 rounded-lg border border-warn/30 bg-warn-bg p-2.5 text-[11.5px] text-warn">
          Aucune règle RAS configurée.
        </p>
      ) : (
        <table className="mt-2 w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-border text-fg-2">
              <th scope="col" className="p-1.5 text-start font-medium">Nature</th>
              <th scope="col" className="p-1.5 text-start font-medium">Bénéficiaire</th>
              <th scope="col" className="p-1.5 text-start font-medium">Résidence</th>
              <th scope="col" className="p-1.5 text-end font-medium">Taux</th>
              <th scope="col" className="p-1.5 text-start font-medium">Depuis</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r, i) => (
              <tr key={i} className="border-b border-border">
                <td className="p-1.5">{r.paymentNature}</td>
                <td className="p-1.5">{r.payeeType}</td>
                <td className="p-1.5">{r.residentStatus}</td>
                <td className="p-1.5 text-end font-mono tabular-nums">{r.ratePercent}</td>
                <td className="p-1.5 font-mono text-fg-3">{r.effectiveFrom}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {canEvaluate && (
        <form action={formAction} className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <div>
            <label htmlFor="ras-payee" className="block text-xs font-medium text-fg-2">Bénéficiaire</label>
            <input id="ras-payee" name="payeeName" required className="mt-1 w-full rounded-lg border border-border-2 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label htmlFor="ras-nature" className="block text-xs font-medium text-fg-2">Nature du paiement</label>
            <input
              id="ras-nature"
              name="paymentNature"
              required
              placeholder="ex. honoraires"
              className="mt-1 w-full rounded-lg border border-border-2 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label htmlFor="ras-payee-type" className="block text-xs font-medium text-fg-2">Type de bénéficiaire</label>
            <select id="ras-payee-type" name="payeeType" className="mt-1 w-full rounded-lg border border-border-2 px-2 py-1.5 text-sm">
              <option value="entreprise">Entreprise</option>
              <option value="profession_liberale">Profession libérale</option>
              <option value="individu">Individu</option>
            </select>
          </div>
          <div>
            <label htmlFor="ras-resident" className="block text-xs font-medium text-fg-2">Statut de résidence</label>
            <select id="ras-resident" name="residentStatus" className="mt-1 w-full rounded-lg border border-border-2 px-2 py-1.5 text-sm">
              <option value="resident">Résident</option>
              <option value="non_resident">Non-résident</option>
            </select>
          </div>
          <div>
            <label htmlFor="ras-invoice-date" className="block text-xs font-medium text-fg-2">Date de facture</label>
            <input id="ras-invoice-date" name="invoiceDate" type="date" required className="mt-1 w-full rounded-lg border border-border-2 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label htmlFor="ras-payment-date" className="block text-xs font-medium text-fg-2">Date de paiement</label>
            <input id="ras-payment-date" name="paymentDate" type="date" required className="mt-1 w-full rounded-lg border border-border-2 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label htmlFor="ras-base" className="block text-xs font-medium text-fg-2">Montant de base</label>
            <input id="ras-base" name="baseAmount" inputMode="decimal" placeholder="0.00" required className="mt-1 w-full rounded-lg border border-border-2 px-2 py-1.5 text-sm font-mono" />
          </div>
          <div className="flex items-end sm:col-span-3">
            <button type="submit" disabled={isPending} className="rounded-lg bg-fg px-4 py-2 text-sm font-medium text-bg disabled:opacity-60">
              {isPending ? "Évaluation…" : "Évaluer"}
            </button>
          </div>
          {state?.error !== undefined && (
            <p role="alert" className="sm:col-span-3 rounded-lg border border-neg bg-neg-bg p-2.5 text-sm text-neg">
              {state.error}
            </p>
          )}
        </form>
      )}

      {attestationText !== null && (
        <pre className="mt-3 overflow-x-auto rounded-lg border border-border-2 bg-surface-2 p-3 text-[11px] text-fg">
          {attestationText}
        </pre>
      )}

      {history.length > 0 && (
        <div className="mt-4">
          <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-fg-2">Paiements évalués</h3>
          <ul className="mt-2 divide-y divide-border text-[11.5px] text-fg-2">
            {history.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-2 py-1.5">
                <span
                  className={`rounded-md border px-1.5 py-0.5 font-mono text-[10.5px] font-semibold ${
                    row.status === "flagged" ? "border-warn/30 bg-warn-bg text-warn" : "border-pos/30 bg-pos-bg text-pos"
                  }`}
                >
                  {row.status === "flagged" ? "À vérifier" : "Calculée"}
                </span>
                <span>{row.payeeName}</span>
                <span className="font-mono text-fg-3">{row.paymentNature}</span>
                <span className="font-mono">{row.baseAmount} MAD</span>
                {row.rasAmount !== null && <span className="font-mono text-neg">-{row.rasAmount} MAD</span>}
                {row.netPayable !== null && <span className="font-mono text-pos">{row.netPayable} MAD net</span>}
                <span className="ms-auto font-mono text-fg-3">{row.createdAt}</span>
                {row.attestationHref !== null && (
                  <a href={row.attestationHref} className="rounded border border-border-2 px-2 py-0.5 text-[10.5px] font-medium text-fg">
                    Attestation
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
