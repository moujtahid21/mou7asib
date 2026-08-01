import Link from "next/link";

// D2: the landing page is just an entry point into the capture flow — no
// dashboard, no chart of accounts, no ledger (ADR 0006's explicit D2 scope).
export default function HomePage() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold">mou7asib</h1>
      <p className="mt-2 text-sm text-slate-600">
        Photographiez une facture pour voir les champs extraits.
      </p>

      <Link
        href="/capture"
        className="mt-8 block rounded bg-slate-900 px-4 py-3 text-center text-sm font-medium text-white"
      >
        Photographier une facture
      </Link>

      <Link
        href="/documents"
        className="mt-3 block rounded border border-slate-300 px-4 py-3 text-center text-sm font-medium text-slate-900"
      >
        Documents précédents
      </Link>
    </main>
  );
}
