import { prisma } from "@mou7asib/db";

// D0 acceptance surface: a Server Component that reads from Postgres through
// the generated Prisma client. No "use client" anywhere in this path.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const checks = await prisma.stackCheck.findMany({
    // CLAUDE.md §9 — select explicitly, never pass a whole record onward.
    select: {
      id: true,
      label: true,
      amount: true,
      bookedAt: true,
      tenant: { select: { name: true } },
    },
    orderBy: { bookedAt: "desc" },
    // CLAUDE.md §9 — no unbounded findMany.
    take: 20,
  });

  // CLAUDE.md §5.7 / §10 — amounts and dates go through the locale formatter,
  // presented with 2 decimals though stored with 4, in Africa/Casablanca time.
  const money = new Intl.NumberFormat("fr-MA", {
    style: "currency",
    currency: "MAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const dateTime = new Intl.DateTimeFormat("fr-MA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Casablanca",
  });

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">mou7asib</h1>
      <p className="mt-2 text-sm text-slate-600">
        Contrôle de pile D0 — Next 16.2 · React 19.2 · TypeScript 7.0 · Prisma 7.9
        · Node 24
      </p>

      {checks.length === 0 ? (
        <p className="mt-8 rounded border border-slate-300 p-4 text-sm">
          Aucune donnée. Lancez <code>npm run db:seed</code>.
        </p>
      ) : (
        <table className="mt-8 w-full border-collapse text-sm">
          <caption className="caption-top pb-2 text-start text-slate-600">
            Lignes lues depuis Postgres via Prisma
          </caption>
          <thead>
            <tr className="border-b border-slate-300">
              <th scope="col" className="p-2 text-start font-medium">
                Libellé
              </th>
              <th scope="col" className="p-2 text-start font-medium">
                Entité
              </th>
              <th scope="col" className="p-2 text-end font-medium">
                Montant
              </th>
              <th scope="col" className="p-2 text-start font-medium">
                Date
              </th>
            </tr>
          </thead>
          <tbody>
            {checks.map((check) => (
              <tr key={check.id} className="border-b border-slate-200">
                <td className="p-2">{check.label}</td>
                <td className="p-2">{check.tenant.name}</td>
                <td className="p-2 text-end tabular-nums">
                  {/* Decimal → string → format. Never through a JS number. */}
                  {money.format(Number(check.amount.toFixed(2)))}
                  <span className="block text-xs text-slate-500">
                    stocké&nbsp;: {check.amount.toFixed(4)}
                  </span>
                </td>
                <td className="p-2">{dateTime.format(check.bookedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
