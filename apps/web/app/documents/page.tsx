import Link from "next/link";
import { withTenant, type DocumentStatus } from "@mou7asib/db";
import { Badge, type BadgeTone } from "@mou7asib/ui";
import { visibleDocumentWhere } from "@/lib/documents";
import { requireSession } from "@/lib/auth";
import { deleteDocument } from "@/app/actions/deleteDocument";
import { retryDocument } from "@/app/actions/retryDocument";

// D2 dashboard extension: filter/search/sort over the visible documents.
// Still explicitly not a "dashboard" in the ADR 0006 sense (no charts, no
// aggregates, no accounting views) — just document management.
export const dynamic = "force-dynamic";

const STATUS_LABELS_FR: Record<string, string> = {
  uploaded: "Téléversé",
  queued: "En attente",
  processing: "En cours",
  extracted: "Extrait",
  failed: "Échec",
};

const STATUS_TONES: Record<string, BadgeTone> = {
  uploaded: "neutral",
  queued: "neutral",
  processing: "ai",
  extracted: "pos",
  failed: "neg",
};

const STATUS_VALUES: readonly DocumentStatus[] = [
  "uploaded",
  "queued",
  "processing",
  "extracted",
  "failed",
];

const dateTimeFormatter = new Intl.DateTimeFormat("fr-MA", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Casablanca",
});

function isDocumentStatus(value: string): value is DocumentStatus {
  return (STATUS_VALUES as readonly string[]).includes(value);
}

interface DocumentsPageProps {
  searchParams: Promise<{ status?: string; q?: string; sort?: string }>;
}

export default async function DocumentsPage({ searchParams }: DocumentsPageProps) {
  const session = await requireSession();
  const params = await searchParams;
  const statusFilter = params.status !== undefined && isDocumentStatus(params.status) ? params.status : undefined;
  const search = params.q?.trim();
  const sortByStatus = params.sort === "status";

  const { documents, suggestionAcceptance } = await withTenant(session.tenantId, async (tx) => {
    const docs = await tx.document.findMany({
      where: {
        ...visibleDocumentWhere(session.tenantId),
        ...(statusFilter !== undefined ? { status: statusFilter } : {}),
        ...(search !== undefined && search.length > 0
          ? { originalFilename: { contains: search, mode: "insensitive" } }
          : {}),
      },
      select: { id: true, originalFilename: true, status: true, uploadedAt: true },
      orderBy: sortByStatus ? { status: "asc" } : { uploadedAt: "desc" },
      take: 50,
    });

    // S6's required acceptance-rate metric (lib/postingSuggestion.ts's precedent panel) —
    // read from AuditLog, which postDocumentEntry.ts writes to every time a suggestion was
    // offered. Small volume per tenant, so counting in JS rather than a JSON-path query.
    const outcomes = await tx.auditLog.findMany({
      where: { tenantId: session.tenantId, action: "posting_suggestion_outcome" },
      select: { after: true },
    });
    const total = outcomes.length;
    const accepted = outcomes.filter(
      (row) => row.after !== null && typeof row.after === "object" && (row.after as { outcome?: string }).outcome === "accepted",
    ).length;

    return { documents: docs, suggestionAcceptance: total === 0 ? null : { accepted, total } };
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div
          role="alert"
          className="flex-1 rounded-xl border border-dashed border-border-2 bg-surface-3 p-3.5 text-[12.5px] text-fg-2"
        >
          Réception — factures et pièces à vérifier avant comptabilisation. Une fois
          qu&apos;un fournisseur a été comptabilisé une première fois, sa fiche propose les
          comptes habituellement utilisés, appris sur l&apos;historique de ce tenant
          uniquement — jamais posté sans confirmation.
          {suggestionAcceptance !== null && (
            <span className="mt-1.5 block font-mono text-[11px] text-fg-3">
              Propositions acceptées telles quelles : {suggestionAcceptance.accepted}/
              {suggestionAcceptance.total} (
              {Math.round((suggestionAcceptance.accepted / suggestionAcceptance.total) * 100)}%)
            </span>
          )}
        </div>
        <Link
          href="/capture"
          className="shrink-0 rounded-lg bg-fg px-4 py-2.5 text-sm font-medium text-bg"
        >
          + Nouvelle facture
        </Link>
      </div>

      {/* Plain GET form — navigates via the URL, no client-side JS needed. */}
      <form method="get" className="flex flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Rechercher un fichier…"
          className="min-w-[200px] flex-1 rounded-lg border border-border-2 px-2.5 py-1.5 text-sm"
        />
        <select
          name="status"
          defaultValue={params.status ?? "all"}
          className="rounded-lg border border-border-2 px-2.5 py-1.5 text-sm"
        >
          <option value="all">Tous les statuts</option>
          {STATUS_VALUES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS_FR[status]}
            </option>
          ))}
        </select>
        <select
          name="sort"
          defaultValue={params.sort ?? "date"}
          className="rounded-lg border border-border-2 px-2.5 py-1.5 text-sm"
        >
          <option value="date">Plus récent</option>
          <option value="status">Statut</option>
        </select>
        <button type="submit" className="rounded-lg border border-border-2 px-3 py-1.5 text-sm font-medium text-fg">
          Filtrer
        </button>
      </form>

      {documents.length === 0 ? (
        <p className="rounded-xl border border-border-2 bg-surface p-4 text-sm text-fg-2">
          Aucun document ne correspond.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {documents.map((doc) => {
            const boundDelete = deleteDocument.bind(null, doc.id);
            const boundRetry = retryDocument.bind(null, doc.id);
            return (
              <li key={doc.id} className="rounded-xl border border-border bg-surface p-3 shadow-card">
                <Link href={`/documents/${doc.id}`} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-medium text-fg">{doc.originalFilename}</span>
                  <Badge tone={STATUS_TONES[doc.status] ?? "neutral"}>
                    {STATUS_LABELS_FR[doc.status] ?? doc.status}
                  </Badge>
                </Link>
                <p className="mt-1 font-mono text-[11px] text-fg-3">{dateTimeFormatter.format(doc.uploadedAt)}</p>
                <div className="mt-2 flex gap-3">
                  {doc.status === "failed" && (
                    <form action={boundRetry}>
                      <button type="submit" className="text-xs font-medium text-fg-2 underline">
                        Réessayer
                      </button>
                    </form>
                  )}
                  <form action={boundDelete}>
                    <button type="submit" className="text-xs font-medium text-neg underline">
                      Supprimer
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
