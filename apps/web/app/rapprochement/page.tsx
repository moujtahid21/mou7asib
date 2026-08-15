import { withTenant } from "@mou7asib/db";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/policy";
import { suggestMatches } from "@/lib/bankMatching";
import StatementImportWizard from "./StatementImportWizard";
import MatchList, { type UnmatchedRow } from "./MatchList";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("fr-MA", { dateStyle: "medium", timeZone: "Africa/Casablanca" });
const moneyFormatter = new Intl.NumberFormat("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ERROR_MESSAGES: Record<string, string> = {
  forbidden: "Action non autorisée pour ce rôle.",
  not_found: "Transaction introuvable ou déjà lettrée.",
  line_unavailable: "L'écriture proposée n'est plus disponible (déjà lettrée entre-temps).",
  amount_mismatch: "Le montant de l'écriture ne correspond plus exactement — lettrage refusé.",
};

interface RapprochementPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function RapprochementPage({ searchParams }: RapprochementPageProps) {
  const session = await requireSession();
  const params = await searchParams;
  const errorMessage = params.error !== undefined ? (ERROR_MESSAGES[params.error] ?? null) : null;

  const data = await withTenant(session.tenantId, async (tx) => {
    const cashAccounts = await tx.account.findMany({
      where: { tenantId: session.tenantId, OR: [{ code: { startsWith: "514" } }, { code: { startsWith: "516" } }] },
      select: { code: true, label: true },
      orderBy: { code: "asc" },
    });
    const cashCodes = cashAccounts.map((a) => a.code);

    const unmatched = await tx.bankTransaction.findMany({
      where: { tenantId: session.tenantId, status: "unmatched" },
      select: { id: true, valueDate: true, label: true, amount: true },
      orderBy: { valueDate: "asc" },
      take: 100,
    });

    const openLines =
      cashCodes.length === 0
        ? []
        : await tx.journalLine.findMany({
            where: {
              tenantId: session.tenantId,
              account: { code: { in: cashCodes } },
              entry: { status: "posted" },
              matchedByBankTransaction: null,
            },
            select: {
              id: true,
              debit: true,
              credit: true,
              entry: { select: { date: true, label: true } },
            },
          });

    const matchedCount = await tx.bankTransaction.count({ where: { tenantId: session.tenantId, status: "matched" } });

    return { cashAccounts, unmatched, openLines, matchedCount };
  });

  const suggestions = suggestMatches(
    data.unmatched.map((t) => ({ id: t.id, valueDate: t.valueDate, amount: t.amount })),
    data.openLines.map((l) => ({ id: l.id, date: l.entry.date, debit: l.debit, credit: l.credit })),
  );
  const lineById = new Map(data.openLines.map((l) => [l.id, l]));

  const rows: UnmatchedRow[] = data.unmatched.map((t) => {
    const suggestion = suggestions.get(t.id);
    const line = suggestion !== undefined ? lineById.get(suggestion.lineId) : undefined;
    return {
      transactionId: t.id,
      date: dateFormatter.format(t.valueDate),
      label: t.label,
      amount: `${t.amount.isPositive() ? "+" : ""}${moneyFormatter.format(Number(t.amount.toString()))} MAD`,
      isIncoming: t.amount.isPositive(),
      suggestion:
        suggestion !== undefined && line !== undefined
          ? {
              lineId: line.id,
              entryLabel: line.entry.label,
              entryDate: dateFormatter.format(line.entry.date),
              dateDiffDays: suggestion.dateDiffDays,
            }
          : null,
    };
  });

  const canReconcile = can(session.role, "bank:reconcile");

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="rounded-xl border border-dashed border-border-2 bg-surface-3 p-3.5 text-[12.5px] text-fg-2">
        <strong className="font-semibold text-fg">Rapprochement bancaire</strong> — import de relevé et
        suggestions de lettrage contre les écritures déjà comptabilisées. Une transaction sans écriture
        correspondante reste sans proposition — elle se comptabilise manuellement depuis{" "}
        <a href="/tva" className="underline">
          le grand livre
        </a>
        , comme aujourd&apos;hui.
        {data.matchedCount > 0 && (
          <span className="mt-1 block font-mono text-[11px] text-fg-3">
            {data.matchedCount} transaction(s) déjà lettrée(s).
          </span>
        )}
      </div>

      {errorMessage !== null && (
        <p role="alert" className="rounded-xl border border-neg bg-neg-bg p-3 text-sm text-neg">
          {errorMessage}
        </p>
      )}

      {canReconcile && <StatementImportWizard bankAccounts={data.cashAccounts} />}

      <MatchList rows={rows} canConfirm={canReconcile} />
    </div>
  );
}
