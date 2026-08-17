import { finalizeInvoice } from "@/app/actions/finalizeInvoice";
import { deleteInvoiceDraft } from "@/app/actions/deleteInvoiceDraft";
import { createAvoir } from "@/app/actions/createAvoir";

export interface InvoiceRow {
  id: string;
  fullNumber: string | null;
  status: "draft" | "finalized";
  customerName: string;
  issueDate: string;
  totalTtc: string;
  isAvoir: boolean;
  avoirOfFullNumber: string | null;
  hasAvoir: boolean;
  lines: { description: string; quantity: string; unitPriceHt: string; rateCode: string }[];
}

export default function InvoiceList({ invoices, canWrite }: { invoices: InvoiceRow[]; canWrite: boolean }) {
  if (invoices.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface p-4 text-center text-sm text-fg-2 shadow-card">
        Aucune facture pour l&apos;instant.
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
      <div className="border-b border-border px-3.5 py-2.5">
        <h2 className="m-0 text-[13.5px] font-semibold text-fg">Factures</h2>
      </div>
      <ul className="divide-y divide-border">
        {invoices.map((invoice) => {
          const boundFinalize = finalizeInvoice.bind(null, invoice.id);
          const boundDelete = deleteInvoiceDraft.bind(null, invoice.id);
          const boundAvoir = createAvoir.bind(null, invoice.id);
          return (
            <li key={invoice.id} className="p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[12.5px] font-semibold text-fg">
                  {invoice.fullNumber ?? "Brouillon"}
                </span>
                <span
                  className={`rounded-md border px-1.5 py-0.5 font-mono text-[10.5px] font-semibold ${
                    invoice.status === "finalized" ? "border-pos/30 bg-pos-bg text-pos" : "border-ai-border bg-ai-bg text-ai"
                  }`}
                >
                  {invoice.status === "finalized" ? "Finalisée" : "Brouillon"}
                </span>
                {invoice.isAvoir && (
                  <span className="rounded-md border border-warn/30 bg-warn-bg px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-warn">
                    Avoir{invoice.avoirOfFullNumber !== null ? ` de ${invoice.avoirOfFullNumber}` : ""}
                  </span>
                )}
                <span className="text-[12.5px] text-fg-2">{invoice.customerName}</span>
                <span className="font-mono text-[11px] text-fg-3">{invoice.issueDate}</span>
                <span className="ms-auto font-mono text-sm font-semibold tabular-nums text-fg">
                  {invoice.status === "finalized" ? (
                    `${invoice.totalTtc} MAD`
                  ) : (
                    <span className="text-fg-3" title="Le total TTC n'est calculé qu'à la finalisation">
                      — MAD
                    </span>
                  )}
                </span>
              </div>

              <ul className="mt-2 space-y-0.5 ps-1 text-[11.5px] text-fg-2">
                {invoice.lines.map((line, i) => (
                  <li key={i} className="font-mono">
                    {line.description} — {line.quantity} × {line.unitPriceHt} ({line.rateCode})
                  </li>
                ))}
              </ul>

              {canWrite && (
                <div className="mt-2 flex gap-2">
                  {invoice.status === "draft" && (
                    <>
                      <form action={boundFinalize}>
                        <button type="submit" className="rounded-lg bg-fg px-2.5 py-1 text-[11.5px] font-semibold text-bg">
                          Finaliser
                        </button>
                      </form>
                      <form action={boundDelete}>
                        <button type="submit" className="rounded-lg border border-neg/30 px-2.5 py-1 text-[11.5px] font-medium text-neg">
                          Supprimer
                        </button>
                      </form>
                    </>
                  )}
                  {invoice.status === "finalized" && !invoice.isAvoir && !invoice.hasAvoir && (
                    <form action={boundAvoir}>
                      <button type="submit" className="rounded-lg border border-border-2 px-2.5 py-1 text-[11.5px] font-medium text-fg">
                        Avoir
                      </button>
                    </form>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
