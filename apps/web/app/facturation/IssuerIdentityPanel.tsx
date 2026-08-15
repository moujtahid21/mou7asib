"use client";

import { useActionState } from "react";
import { setTenantIdentity, type SetTenantIdentityState } from "@/app/actions/setTenantIdentity";

export interface IssuerIdentity {
  name: string;
  ice: string | null;
  ifNumber: string | null;
  rc: string | null;
  patente: string | null;
  cnss: string | null;
}

const initialState: SetTenantIdentityState = null;

// Feeds the mentions validator (CLAUDE.md §5.6) — ICE/IF are required to finalise an
// invoice, RC/patente/CNSS only warn (see packages/accounting/src/invoiceMentions.ts's
// comment on why: "where applicable" is exactly what L-49 hasn't resolved yet).
export default function IssuerIdentityPanel({ identity }: { identity: IssuerIdentity }) {
  const [state, formAction, isPending] = useActionState(setTenantIdentity, initialState);

  return (
    <section className="rounded-xl border border-border bg-surface p-4 shadow-card">
      <h2 className="m-0 text-[13.5px] font-semibold text-fg">Identité de l&apos;émetteur</h2>
      <p className="mt-1 text-[12.5px] text-fg-2">
        Requis pour finaliser une facture (ICE, IF) — RC/patente/CNSS recommandés si applicables.
      </p>
      <form action={formAction} className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <div>
          <label htmlFor="ii-ice" className="block text-xs font-medium text-fg-2">ICE *</label>
          <input
            id="ii-ice"
            name="ice"
            defaultValue={identity.ice ?? ""}
            className="mt-1 w-full rounded-lg border border-border-2 px-2 py-1.5 text-sm font-mono"
          />
        </div>
        <div>
          <label htmlFor="ii-if" className="block text-xs font-medium text-fg-2">IF *</label>
          <input
            id="ii-if"
            name="ifNumber"
            defaultValue={identity.ifNumber ?? ""}
            className="mt-1 w-full rounded-lg border border-border-2 px-2 py-1.5 text-sm font-mono"
          />
        </div>
        <div>
          <label htmlFor="ii-rc" className="block text-xs font-medium text-fg-2">RC</label>
          <input
            id="ii-rc"
            name="rc"
            defaultValue={identity.rc ?? ""}
            className="mt-1 w-full rounded-lg border border-border-2 px-2 py-1.5 text-sm font-mono"
          />
        </div>
        <div>
          <label htmlFor="ii-patente" className="block text-xs font-medium text-fg-2">Patente/TP</label>
          <input
            id="ii-patente"
            name="patente"
            defaultValue={identity.patente ?? ""}
            className="mt-1 w-full rounded-lg border border-border-2 px-2 py-1.5 text-sm font-mono"
          />
        </div>
        <div>
          <label htmlFor="ii-cnss" className="block text-xs font-medium text-fg-2">CNSS</label>
          <input
            id="ii-cnss"
            name="cnss"
            defaultValue={identity.cnss ?? ""}
            className="mt-1 w-full rounded-lg border border-border-2 px-2 py-1.5 text-sm font-mono"
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg border border-border-2 px-3 py-1.5 text-xs font-medium text-fg disabled:opacity-60"
          >
            {isPending ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </form>
      {state?.error !== undefined && (
        <p role="alert" className="mt-2 rounded-lg border border-neg bg-neg-bg p-2 text-sm text-neg">
          {state.error}
        </p>
      )}
    </section>
  );
}
