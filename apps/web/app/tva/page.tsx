import { withTenant, prisma, Prisma } from "@mou7asib/db";
import { buildBilan, buildCpc, computeIs, Decimal as AccountingDecimal, renderPlaceholderDeclaration, renderPlaceholderAttestation, type AccountBalanceLine } from "@mou7asib/accounting";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/policy";
import JournalEntryForm from "./JournalEntryForm";
import EntryList from "./EntryList";
import TrialBalance from "./TrialBalance";
import PeriodsPanel from "./PeriodsPanel";
import ImportWizard from "./ImportWizard";
import TvaRegimePanel from "./TvaRegimePanel";
import TvaRatesPanel from "./TvaRatesPanel";
import TvaFilingFrequencyPanel from "./TvaFilingFrequencyPanel";
import TvaDeclarationPanel from "./TvaDeclarationPanel";
import EtatsSynthesePanel, { type DrillableLine } from "./EtatsSynthesePanel";
import RasPanel, { type RasRuleRow, type RasWithholdingRow } from "./RasPanel";
import IsPanel, { type IsWorksheetRow } from "./IsPanel";
import { netAmountForAccount, formatSignedAmount } from "@/lib/drilldown";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  forbidden: "Action non autorisée pour ce rôle.",
  not_found: "Écriture introuvable.",
  period_locked: "La période est verrouillée — écriture enregistrée en brouillon, non comptabilisée.",
  declaration_period: "Période de déclaration invalide.",
};

interface TvaPageProps {
  searchParams: Promise<{
    error?: string;
    asOf?: string;
    periodStart?: string;
    periodEnd?: string;
    exported?: string;
    attestation?: string;
  }>;
}

function toIsoDate(value: string | undefined, fallback: Date): string {
  if (value !== undefined && !Number.isNaN(Date.parse(value))) {
    return value;
  }
  return fallback.toISOString().slice(0, 10);
}

export default async function TvaPage({ searchParams }: TvaPageProps) {
  const session = await requireSession();
  const params = await searchParams;
  const errorMessage = params.error !== undefined ? (ERROR_MESSAGES[params.error] ?? null) : null;

  const dateFormatter = new Intl.DateTimeFormat("fr-MA", { dateStyle: "medium", timeZone: "UTC" });
  const [tenant, tvaRateRows] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: session.tenantId },
      select: { name: true, tvaRegime: true, tvaFilingFrequency: true },
    }),
    prisma.tvaRate.findMany({ orderBy: { rateCode: "asc" }, select: { rateCode: true, label: true, rate: true, effectiveFrom: true, isPlaceholder: true } }),
  ]);
  const tvaRates = tvaRateRows.map((r) => ({
    rateCode: r.rateCode,
    label: r.label,
    ratePercent: `${r.rate.times(100).toString()} %`,
    effectiveFrom: dateFormatter.format(r.effectiveFrom),
    isPlaceholder: r.isPlaceholder,
  }));

  const { accounts, entries, trialBalanceRows, periods } = await withTenant(session.tenantId, async (tx) => {
    const accountRows = await tx.account.findMany({
      where: { tenantId: session.tenantId },
      select: { id: true, code: true, label: true, classDigit: true },
      orderBy: { code: "asc" },
    });
    const accountById = new Map(accountRows.map((account) => [account.id, account]));

    const entryRows = await tx.journalEntry.findMany({
      where: { tenantId: session.tenantId },
      orderBy: { date: "desc" },
      select: {
        id: true,
        date: true,
        journalCode: true,
        label: true,
        status: true,
        reversesEntryId: true,
        reversedByEntry: { select: { id: true } },
        lines: {
          orderBy: { lineOrder: "asc" },
          select: { id: true, debit: true, credit: true, label: true, accountId: true },
        },
      },
    });

    const balanceRows = await tx.journalLine.groupBy({
      by: ["accountId"],
      where: { tenantId: session.tenantId, entry: { status: "posted" } },
      _sum: { debit: true, credit: true },
    });

    const periodRows = await tx.period.findMany({
      where: { tenantId: session.tenantId },
      orderBy: { startDate: "desc" },
      select: { id: true, startDate: true, endDate: true, status: true },
    });

    return {
      accounts: accountRows.map((account) => ({ code: account.code, label: account.label })),
      entries: entryRows.map((entry) => ({
        id: entry.id,
        date: entry.date,
        journalCode: entry.journalCode,
        label: entry.label,
        status: entry.status,
        isReversal: entry.reversesEntryId !== null,
        reversedByEntryId: entry.reversedByEntry?.id ?? null,
        lines: entry.lines.map((line) => ({
          id: line.id,
          debit: line.debit,
          credit: line.credit,
          label: line.label,
          account: accountById.get(line.accountId) ?? null,
        })),
      })),
      trialBalanceRows: balanceRows
        .map((row) => {
          const account = accountById.get(row.accountId);
          return account === undefined
            ? null
            : {
                code: account.code,
                label: account.label,
                debit: (row._sum.debit ?? new Prisma.Decimal(0)).toString(),
                credit: (row._sum.credit ?? new Prisma.Decimal(0)).toString(),
              };
        })
        .filter((row) => row !== null)
        .sort((a, b) => a.code.localeCompare(b.code)),
      periods: periodRows,
    };
  });

  const now = new Date();
  const asOf = toIsoDate(params.asOf, now);
  const periodStart = toIsoDate(params.periodStart, new Date(Date.UTC(now.getUTCFullYear(), 0, 1)));
  const periodEnd = toIsoDate(params.periodEnd, now);

  const postedEntries = entries.filter((e) => e.status === "posted");

  function aggregate(filter: (entryDate: Date) => boolean): AccountBalanceLine[] {
    const byAccount = new Map<string, AccountBalanceLine>();
    for (const entry of postedEntries) {
      if (!filter(entry.date)) continue;
      for (const line of entry.lines) {
        if (line.account === null) continue;
        const debit = new AccountingDecimal(line.debit.toString());
        const credit = new AccountingDecimal(line.credit.toString());
        const existing = byAccount.get(line.account.code);
        if (existing === undefined) {
          byAccount.set(line.account.code, {
            accountCode: line.account.code,
            accountLabel: line.account.label,
            classDigit: line.account.classDigit,
            debit,
            credit,
          });
        } else {
          existing.debit = existing.debit.plus(debit);
          existing.credit = existing.credit.plus(credit);
        }
      }
    }
    return Array.from(byAccount.values());
  }

  function drillableFrom(lines: { accountCode: string; accountLabel: string; amount: { toFixed(n: number): string } }[], filter: (entryDate: Date) => boolean): DrillableLine[] {
    return lines.map((line) => ({
      accountCode: line.accountCode,
      accountLabel: line.accountLabel,
      amount: line.amount.toFixed(2),
      entries: postedEntries
        .filter((e) => filter(e.date) && e.lines.some((l) => l.account?.code === line.accountCode))
        .map((e) => {
          const net = netAmountForAccount(
            e.lines.map((l) => ({ accountCode: l.account?.code ?? null, debit: new AccountingDecimal(l.debit.toString()), credit: new AccountingDecimal(l.credit.toString()) })),
            line.accountCode,
          );
          return { entryId: e.id, date: dateFormatter.format(e.date), label: e.label, amount: formatSignedAmount(net) };
        }),
    }));
  }

  const asOfDate = new Date(`${asOf}T23:59:59.999Z`);
  const periodStartDate = new Date(`${periodStart}T00:00:00.000Z`);
  const periodEndDate = new Date(`${periodEnd}T23:59:59.999Z`);

  const bilanLines = aggregate((d) => d <= asOfDate);
  const bilanComputed = buildBilan(bilanLines);
  const cpcLines = aggregate((d) => d >= periodStartDate && d <= periodEndDate);
  const cpcComputed = buildCpc(cpcLines);

  const bilanData = {
    actif: drillableFrom(bilanComputed.actif, (d) => d <= asOfDate),
    passif: drillableFrom(
      bilanComputed.passif.filter((l) => l.accountCode !== "RESULT"),
      (d) => d <= asOfDate,
    ),
    totalActif: bilanComputed.totalActif.toFixed(2),
    totalPassif: bilanComputed.totalPassif.toFixed(2),
    resultatNet: bilanComputed.resultatNet.toFixed(2),
    asOf,
  };
  const cpcData = {
    produits: drillableFrom(cpcComputed.produits, (d) => d >= periodStartDate && d <= periodEndDate),
    charges: drillableFrom(cpcComputed.charges, (d) => d >= periodStartDate && d <= periodEndDate),
    totalProduits: cpcComputed.totalProduits.toFixed(2),
    totalCharges: cpcComputed.totalCharges.toFixed(2),
    resultatNet: cpcComputed.resultatNet.toFixed(2),
    periodStart,
    periodEnd,
  };

  const zeroLine = (accountCode: string, accountLabel: string): DrillableLine => ({
    accountCode,
    accountLabel,
    amount: "0.00",
    entries: [],
  });
  const collecteeLine = cpcLines.find((l) => l.accountCode === "4455");
  const deductibleLine = cpcLines.find((l) => l.accountCode === "34552");
  const collecteeDrillable =
    collecteeLine === undefined
      ? zeroLine("4455", "État — TVA facturée")
      : drillableFrom([{ ...collecteeLine, amount: collecteeLine.credit.minus(collecteeLine.debit) }], (d) => d >= periodStartDate && d <= periodEndDate)[0]!;
  const deductibleDrillable =
    deductibleLine === undefined
      ? zeroLine("34552", "État — TVA récupérable")
      : drillableFrom([{ ...deductibleLine, amount: deductibleLine.debit.minus(deductibleLine.credit) }], (d) => d >= periodStartDate && d <= periodEndDate)[0]!;
  const totalDueAmount = new AccountingDecimal(collecteeDrillable.amount).minus(new AccountingDecimal(deductibleDrillable.amount));

  const [exportedRecord, exportHistory] = await withTenant(session.tenantId, async (tx) => {
    const record =
      params.exported === undefined
        ? null
        : await tx.tvaDeclarationExport.findFirst({ where: { id: params.exported, tenantId: session.tenantId } });
    const history = await tx.tvaDeclarationExport.findMany({
      where: { tenantId: session.tenantId },
      orderBy: { exportedAt: "desc" },
      take: 20,
      select: { id: true, periodStart: true, periodEnd: true, totalDue: true, exportedAt: true },
    });
    return [record, history] as const;
  });

  const exportedText =
    exportedRecord === null
      ? null
      : renderPlaceholderDeclaration({
          tenantName: tenant?.name ?? "",
          periodStart: exportedRecord.periodStart,
          periodEnd: exportedRecord.periodEnd,
          regime: exportedRecord.regime,
          totalCollectee: new AccountingDecimal(exportedRecord.totalCollectee.toString()),
          totalDeductible: new AccountingDecimal(exportedRecord.totalDeductible.toString()),
          totalDue: new AccountingDecimal(exportedRecord.totalDue.toString()),
        });

  const rasRuleRows = await prisma.rasRule.findMany({
    orderBy: { paymentNature: "asc" },
    select: { paymentNature: true, payeeType: true, residentStatus: true, rate: true, effectiveFrom: true },
  });
  const rasRules: RasRuleRow[] = rasRuleRows.map((r) => ({
    paymentNature: r.paymentNature,
    payeeType: r.payeeType,
    residentStatus: r.residentStatus,
    ratePercent: `${r.rate.times(100).toString()} %`,
    effectiveFrom: dateFormatter.format(r.effectiveFrom),
  }));

  const rasHistoryRows = await withTenant(session.tenantId, (tx) =>
    tx.rasWithholding.findMany({
      where: { tenantId: session.tenantId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        payeeName: true,
        paymentNature: true,
        status: true,
        baseAmount: true,
        rasAmount: true,
        netPayable: true,
        createdAt: true,
      },
    }),
  );
  const rasHistory: RasWithholdingRow[] = rasHistoryRows.map((row) => ({
    id: row.id,
    payeeName: row.payeeName,
    paymentNature: row.paymentNature,
    status: row.status,
    baseAmount: row.baseAmount.toFixed(2),
    rasAmount: row.rasAmount === null ? null : row.rasAmount.toFixed(2),
    netPayable: row.netPayable === null ? null : row.netPayable.toFixed(2),
    createdAt: dateFormatter.format(row.createdAt),
    attestationHref: row.status === "computed" ? (`/tva?attestation=${row.id}` as const) : null,
  }));

  const attestationId = params.attestation;
  const attestationRecord =
    attestationId === undefined
      ? null
      : await withTenant(session.tenantId, (tx) =>
          tx.rasWithholding.findFirst({
            where: { id: attestationId, tenantId: session.tenantId, status: "computed" },
          }),
        );
  const attestationText =
    attestationRecord === null ||
    attestationRecord.rasAmount === null ||
    attestationRecord.netPayable === null ||
    attestationRecord.matchedRateAtEval === null
      ? null
      : renderPlaceholderAttestation({
          tenantName: tenant?.name ?? "",
          payeeName: attestationRecord.payeeName,
          paymentNature: attestationRecord.paymentNature,
          paymentDate: attestationRecord.paymentDate,
          baseAmount: new AccountingDecimal(attestationRecord.baseAmount.toString()),
          rate: new AccountingDecimal(attestationRecord.matchedRateAtEval.toString()),
          rasAmount: new AccountingDecimal(attestationRecord.rasAmount.toString()),
          netPayable: new AccountingDecimal(attestationRecord.netPayable.toString()),
        });

  const [isBracketRows, isCotisationRows] = await Promise.all([
    prisma.isBracket.findMany({ select: { minIncome: true, maxIncome: true, rate: true, effectiveFrom: true, effectiveTo: true } }),
    prisma.isCotisationMinimaleConfig.findMany({ select: { rate: true, minimumAmount: true, effectiveFrom: true, effectiveTo: true } }),
  ]);
  const isBrackets = isBracketRows.map((b) => ({
    minIncome: new AccountingDecimal(b.minIncome.toString()),
    maxIncome: b.maxIncome === null ? null : new AccountingDecimal(b.maxIncome.toString()),
    rate: new AccountingDecimal(b.rate.toString()),
    effectiveFrom: b.effectiveFrom,
    effectiveTo: b.effectiveTo,
  }));
  const isCotisationConfigs = isCotisationRows.map((c) => ({
    rate: new AccountingDecimal(c.rate.toString()),
    minimumAmount: new AccountingDecimal(c.minimumAmount.toString()),
    effectiveFrom: c.effectiveFrom,
    effectiveTo: c.effectiveTo,
  }));

  const isWorksheetRows = await withTenant(session.tenantId, (tx) =>
    tx.isPassageWorksheet.findMany({
      where: { tenantId: session.tenantId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        periodStart: true,
        periodEnd: true,
        resultatComptable: true,
        status: true,
        validatedAt: true,
        lines: { orderBy: { lineOrder: "asc" }, select: { kind: true, label: true, amount: true, explanation: true } },
      },
    }),
  );
  const isWorksheets: IsWorksheetRow[] = isWorksheetRows.map((w) => {
    const lines = w.lines.map((l) => ({ kind: l.kind, amount: new AccountingDecimal(l.amount.toString()) }));
    const computation = computeIs(
      new AccountingDecimal(w.resultatComptable.toString()),
      lines,
      isBrackets,
      isCotisationConfigs,
      new AccountingDecimal(cpcComputed.totalProduits.toString()),
      w.periodEnd,
    );
    return {
      id: w.id,
      periodStart: dateFormatter.format(w.periodStart),
      periodEnd: dateFormatter.format(w.periodEnd),
      resultatComptable: w.resultatComptable.toFixed(2),
      resultatFiscal: computation.resultatFiscal.toFixed(2),
      status: w.status,
      validatedAt: w.validatedAt === null ? null : dateFormatter.format(w.validatedAt),
      isDue: computation.isDue === null ? null : computation.isDue.toFixed(2),
      lines: w.lines.map((l) => ({ kind: l.kind, label: l.label, amount: l.amount.toFixed(2), explanation: l.explanation })),
    };
  });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <div className="rounded-xl border border-dashed border-border-2 bg-surface-3 p-3.5 text-[12.5px] text-fg-2">
        <strong className="font-semibold text-fg">Grand livre</strong> — voir la feuille
        de route pour les phases restantes. Le moteur TVA (phase 8), le Bilan/CPC
        (phase 10), la déclaration TVA (phase 11), la RAS (phase 12) et l&apos;IS
        (phase 13) sont réels mais reposent sur des données placeholder — voir "Taux de
        TVA configurés", "États de synthèse", "Déclaration TVA", "Retenue à la source" et
        "Impôt sur les Sociétés" ci-dessous, jamais présentés comme officiels.
      </div>

      {errorMessage !== null && (
        <p role="alert" className="rounded-xl border border-neg bg-neg-bg p-3 text-sm text-neg">
          {errorMessage}
        </p>
      )}

      <TvaRegimePanel regime={tenant?.tvaRegime ?? null} canManage={can(session.role, "settings:manage")} />

      <TvaRatesPanel rates={tvaRates} />

      <TvaFilingFrequencyPanel
        frequency={tenant?.tvaFilingFrequency ?? null}
        canManage={can(session.role, "settings:manage")}
      />

      <TvaDeclarationPanel
        periodStart={periodStart}
        periodEnd={periodEnd}
        collectee={collecteeDrillable}
        deductible={deductibleDrillable}
        totalDue={totalDueAmount.toFixed(2)}
        canDeclare={can(session.role, "tva:declare")}
        exportedText={exportedText}
        history={exportHistory.map((row) => ({
          id: row.id,
          periodStart: dateFormatter.format(row.periodStart),
          periodEnd: dateFormatter.format(row.periodEnd),
          totalDue: row.totalDue.toFixed(2),
          exportedAt: dateFormatter.format(row.exportedAt),
        }))}
      />

      <RasPanel
        rules={rasRules}
        history={rasHistory}
        canEvaluate={can(session.role, "ras:evaluate")}
        attestationText={attestationText}
      />

      <IsPanel
        canManage={can(session.role, "is:manage")}
        periodStart={periodStart}
        periodEnd={periodEnd}
        resultatComptable={cpcComputed.resultatNet.toFixed(2)}
        worksheets={isWorksheets}
        bracketsConfigured={isBrackets.length > 0}
        cotisationConfigured={isCotisationConfigs.length > 0}
      />

      {can(session.role, "ledger:write") && <ImportWizard />}

      {can(session.role, "ledger:write") && <JournalEntryForm accounts={accounts} />}

      <EntryList entries={entries} canWrite={can(session.role, "ledger:write")} />

      <EtatsSynthesePanel bilan={bilanData} cpc={cpcData} />

      <TrialBalance rows={trialBalanceRows} />

      <PeriodsPanel periods={periods} canManage={can(session.role, "period:manage")} />
    </div>
  );
}
