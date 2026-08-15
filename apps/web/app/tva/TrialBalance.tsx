import { Decimal } from "@mou7asib/accounting";
import { DataTableShell } from "@mou7asib/ui";

interface TrialBalanceRow {
  code: string;
  label: string;
  debit: string;
  credit: string;
}

// Server data only, posted lines already summed by Prisma's groupBy — this is display
// formatting, not the balance invariant itself (that's enforced at the DB layer and by
// packages/accounting, see the phase2_ledger migration and balance.ts).
export default function TrialBalance({ rows }: { rows: TrialBalanceRow[] }) {
  const totalDebit = rows.reduce((total, row) => total.plus(row.debit), new Decimal(0));
  const totalCredit = rows.reduce((total, row) => total.plus(row.credit), new Decimal(0));

  return (
    <DataTableShell title="Balance générale" meta="écritures comptabilisées uniquement">
      {rows.length === 0 ? (
        <p className="m-0 p-4 text-sm text-fg-2">Aucune écriture comptabilisée pour le moment.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Balance générale par compte</caption>
          <thead>
            <tr className="text-xs text-fg-2">
              <th scope="col" className="p-2 text-start font-medium">
                Compte
              </th>
              <th scope="col" className="p-2 text-start font-medium">
                Libellé
              </th>
              <th scope="col" className="p-2 text-end font-medium">
                Débit
              </th>
              <th scope="col" className="p-2 text-end font-medium">
                Crédit
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.code} className="border-t border-border">
                <td className="p-2 font-mono">{row.code}</td>
                <td className="p-2">{row.label}</td>
                <td className="p-2 text-end font-mono tabular-nums">{new Decimal(row.debit).toFixed(2)}</td>
                <td className="p-2 text-end font-mono tabular-nums">{new Decimal(row.credit).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border font-semibold">
              <td className="p-2" colSpan={2}>
                Total
              </td>
              <td className="p-2 text-end font-mono tabular-nums">{totalDebit.toFixed(2)}</td>
              <td className="p-2 text-end font-mono tabular-nums">{totalCredit.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      )}
    </DataTableShell>
  );
}
