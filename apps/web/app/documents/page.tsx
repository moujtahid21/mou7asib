import Link from "next/link";
import { prisma } from "@mou7asib/db";
import { DEMO_TENANT_ID } from "@/lib/tenant";

// D2: a bare-minimum list so the founders can find previously uploaded test
// documents while iterating — explicitly not a "dashboard" in the ADR 0006
// sense (no charts, no aggregates, no accounting views).
export const dynamic = "force-dynamic";

const STATUS_LABELS_FR: Record<string, string> = {
  uploaded: "Téléversé",
  queued: "En attente",
  processing: "En cours",
  extracted: "Extrait",
  failed: "Échec",
};

const dateTimeFormatter = new Intl.DateTimeFormat("fr-MA", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Casablanca",
});

export default async function DocumentsPage() {
  const documents = await prisma.document.findMany({
    where: { tenantId: DEMO_TENANT_ID },
    select: { id: true, originalFilename: true, status: true, uploadedAt: true },
    orderBy: { uploadedAt: "desc" },
    take: 50,
  });

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold">Documents précédents</h1>

      {documents.length === 0 ? (
        <p className="mt-6 rounded border border-slate-300 p-4 text-sm text-slate-600">
          Aucun document pour le moment.
        </p>
      ) : (
        <ul className="mt-6 space-y-2">
          {documents.map((doc) => (
            <li key={doc.id}>
              <Link
                href={`/documents/${doc.id}`}
                className="flex items-center justify-between rounded border border-slate-300 p-3 text-sm"
              >
                <span className="truncate">{doc.originalFilename}</span>
                <span className="ms-3 shrink-0 text-slate-500">
                  {STATUS_LABELS_FR[doc.status] ?? doc.status}
                </span>
              </Link>
              <p className="mt-1 text-xs text-slate-400">
                {dateTimeFormatter.format(doc.uploadedAt)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <Link href="/capture" className="mt-6 block text-sm font-medium text-slate-900">
        + Nouvelle facture
      </Link>
    </main>
  );
}
