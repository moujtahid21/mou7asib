import Link from "next/link";
import { prisma, type DocumentStatus } from "@mou7asib/db";
import { visibleDocumentWhere } from "@/lib/documents";
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
  const params = await searchParams;
  const statusFilter = params.status !== undefined && isDocumentStatus(params.status) ? params.status : undefined;
  const search = params.q?.trim();
  const sortByStatus = params.sort === "status";

  const documents = await prisma.document.findMany({
    where: {
      ...visibleDocumentWhere(),
      ...(statusFilter !== undefined ? { status: statusFilter } : {}),
      ...(search !== undefined && search.length > 0
        ? { originalFilename: { contains: search, mode: "insensitive" } }
        : {}),
    },
    select: { id: true, originalFilename: true, status: true, uploadedAt: true },
    orderBy: sortByStatus ? { status: "asc" } : { uploadedAt: "desc" },
    take: 50,
  });

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold">Documents précédents</h1>

      {/* Plain GET form — navigates via the URL, no client-side JS needed. */}
      <form method="get" className="mt-4 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Rechercher un fichier…"
          className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
        <select
          name="status"
          defaultValue={params.status ?? "all"}
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
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
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="date">Plus récent</option>
          <option value="status">Statut</option>
        </select>
        <button type="submit" className="rounded border border-slate-300 px-3 py-1.5 text-sm">
          Filtrer
        </button>
      </form>

      {documents.length === 0 ? (
        <p className="mt-6 rounded border border-slate-300 p-4 text-sm text-slate-600">
          Aucun document ne correspond.
        </p>
      ) : (
        <ul className="mt-6 space-y-2">
          {documents.map((doc) => {
            const boundDelete = deleteDocument.bind(null, doc.id);
            const boundRetry = retryDocument.bind(null, doc.id);
            return (
              <li key={doc.id} className="rounded border border-slate-300 p-3">
                <Link href={`/documents/${doc.id}`} className="flex items-center justify-between text-sm">
                  <span className="truncate">{doc.originalFilename}</span>
                  <span className="ms-3 shrink-0 text-slate-500">
                    {STATUS_LABELS_FR[doc.status] ?? doc.status}
                  </span>
                </Link>
                <p className="mt-1 text-xs text-slate-400">{dateTimeFormatter.format(doc.uploadedAt)}</p>
                <div className="mt-2 flex gap-2">
                  {doc.status === "failed" && (
                    <form action={boundRetry}>
                      <button type="submit" className="text-xs font-medium text-slate-700 underline">
                        Réessayer
                      </button>
                    </form>
                  )}
                  <form action={boundDelete}>
                    <button type="submit" className="text-xs font-medium text-red-700 underline">
                      Supprimer
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Link href="/capture" className="mt-6 block text-sm font-medium text-slate-900">
        + Nouvelle facture
      </Link>
    </main>
  );
}
