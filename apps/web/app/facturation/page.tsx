import { withTenant, prisma } from "@mou7asib/db";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/policy";
import IssuerIdentityPanel from "./IssuerIdentityPanel";
import InvoiceForm from "./InvoiceForm";
import InvoiceList, { type InvoiceRow } from "./InvoiceList";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("fr-MA", { dateStyle: "medium", timeZone: "UTC" });

const ERROR_MESSAGES: Record<string, string> = {
  forbidden: "Action non autorisée pour ce rôle.",
  not_found: "Facture introuvable ou déjà finalisée.",
  already_has_avoir: "Cette facture a déjà un avoir.",
  avoir_mentions: "Impossible de créer l'avoir — mentions obligatoires manquantes sur le tenant.",
};

interface FacturationPageProps {
  searchParams: Promise<{ error?: string; detail?: string; finalized?: string; draft?: string }>;
}

export default async function FacturationPage({ searchParams }: FacturationPageProps) {
  const session = await requireSession();
  const params = await searchParams;
  const errorMessage =
    params.error === "mentions"
      ? `Mentions obligatoires manquantes : ${params.detail ?? ""}`
      : params.error !== undefined
        ? (ERROR_MESSAGES[params.error] ?? null)
        : null;

  const [tenant, tvaRateRows, invoiceRows] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: session.tenantId },
      select: { name: true, ice: true, ifNumber: true, rc: true, patente: true, cnss: true },
    }),
    prisma.tvaRate.findMany({
      where: { effectiveTo: null },
      orderBy: { rateCode: "asc" },
      select: { rateCode: true, label: true },
    }),
    withTenant(session.tenantId, (tx) =>
      tx.invoice.findMany({
        where: { tenantId: session.tenantId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          fullNumber: true,
          status: true,
          customerName: true,
          issueDate: true,
          totalTtc: true,
          isAvoir: true,
          avoirOfInvoice: { select: { fullNumber: true } },
          avoirInvoice: { select: { id: true } },
          lines: {
            orderBy: { lineOrder: "asc" },
            select: { description: true, quantity: true, unitPriceHt: true, rateCode: true },
          },
        },
      }),
    ),
  ]);

  const invoices: InvoiceRow[] = invoiceRows.map((invoice) => ({
    id: invoice.id,
    fullNumber: invoice.fullNumber,
    status: invoice.status,
    customerName: invoice.customerName,
    issueDate: dateFormatter.format(invoice.issueDate),
    totalTtc: invoice.totalTtc.toFixed(2),
    isAvoir: invoice.isAvoir,
    avoirOfFullNumber: invoice.avoirOfInvoice?.fullNumber ?? null,
    hasAvoir: invoice.avoirInvoice !== null,
    lines: invoice.lines.map((line) => ({
      description: line.description,
      quantity: line.quantity.toString(),
      unitPriceHt: line.unitPriceHt.toFixed(2),
      rateCode: line.rateCode,
    })),
  }));

  const canWrite = can(session.role, "invoice:write");

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="rounded-xl border border-dashed border-border-2 bg-surface-3 p-3.5 text-[12.5px] text-fg-2">
        <strong className="font-semibold text-fg">Facturation sortante</strong> — numérotation
        séquentielle réelle (par série, sans trou ni réutilisation), mentions obligatoires
        (CLAUDE.md §5.3, TODO(legal) L-48/L-49 pour la liste définitive), immutabilité une fois
        finalisée, correction par avoir. Les factures ne sont pas encore comptabilisées
        automatiquement au grand livre — comptabilisation manuelle via{" "}
        <a href="/tva" className="underline">
          le grand livre
        </a>{" "}
        pour l&apos;instant.
      </div>

      {errorMessage !== null && (
        <p role="alert" className="rounded-xl border border-neg bg-neg-bg p-3 text-sm text-neg">
          {errorMessage}
        </p>
      )}
      {params.finalized !== undefined && (
        <p className="rounded-xl border border-pos/30 bg-pos-bg p-3 text-sm text-pos">
          Facture {params.finalized} finalisée.
        </p>
      )}

      <IssuerIdentityPanel
        identity={{
          name: tenant?.name ?? "",
          ice: tenant?.ice ?? null,
          ifNumber: tenant?.ifNumber ?? null,
          rc: tenant?.rc ?? null,
          patente: tenant?.patente ?? null,
          cnss: tenant?.cnss ?? null,
        }}
      />

      {canWrite && <InvoiceForm rates={tvaRateRows} />}

      <InvoiceList invoices={invoices} canWrite={canWrite} />
    </div>
  );
}
