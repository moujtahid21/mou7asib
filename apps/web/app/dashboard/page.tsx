import Link from "next/link";
import { withTenant } from "@mou7asib/db";
import { KpiCard } from "@mou7asib/ui";
import { requireSession } from "@/lib/auth";
import { visibleDocumentWhere } from "@/lib/documents";
import { Decimal, netDebitBalance, bucketAgingByAge, buildMonthlyCashTrend } from "@/lib/dashboardMetrics";

export const dynamic = "force-dynamic";

const moneyFormatter = new Intl.NumberFormat("fr-MA", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const monthLabelFormatter = new Intl.DateTimeFormat("fr-MA", { month: "short", timeZone: "UTC" });
const dateFormatter = new Intl.DateTimeFormat("fr-MA", { dateStyle: "medium", timeZone: "Africa/Casablanca" });

function fmt(amount: InstanceType<typeof Decimal>): string {
  return moneyFormatter.format(Number(amount.toFixed(0)));
}

interface AttentionItem {
  key: string;
  dotTone: "neg" | "warn" | "ai";
  title: string;
  detail: string;
  meta: string;
  href: `/documents/${string}`;
  actionLabel: string;
}

export default async function DashboardPage() {
  const session = await requireSession();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const data = await withTenant(session.tenantId, async (tx) => {
    const lines = await tx.journalLine.findMany({
      where: { tenantId: session.tenantId, entry: { status: "posted" } },
      select: {
        debit: true,
        credit: true,
        account: { select: { code: true, classDigit: true } },
        entry: { select: { date: true } },
      },
    });

    const entriesThisMonth = await tx.journalEntry.count({
      where: { tenantId: session.tenantId, status: "posted", date: { gte: monthStart } },
    });

    const toPost = await tx.document.findMany({
      where: { ...visibleDocumentWhere(session.tenantId), status: "extracted", postedJournalEntry: null },
      select: { id: true, originalFilename: true, uploadedAt: true, currentAttempt: { select: { arithmeticOk: true } } },
      orderBy: { uploadedAt: "asc" },
      take: 20,
    });

    const failed = await tx.document.findMany({
      where: { ...visibleDocumentWhere(session.tenantId), status: "failed" },
      select: { id: true, originalFilename: true, uploadedAt: true },
      orderBy: { uploadedAt: "asc" },
      take: 10,
    });

    const duplicateGroups = await tx.document.groupBy({
      by: ["contentHash"],
      where: visibleDocumentWhere(session.tenantId),
      _count: { id: true },
      having: { id: { _count: { gt: 1 } } },
    });
    const duplicateSamples =
      duplicateGroups.length === 0
        ? []
        : await tx.document.findMany({
            where: { ...visibleDocumentWhere(session.tenantId), contentHash: { in: duplicateGroups.map((g) => g.contentHash) } },
            select: { id: true, originalFilename: true, contentHash: true, uploadedAt: true },
            orderBy: { uploadedAt: "asc" },
          });

    const suggestionOutcomes = await tx.auditLog.findMany({
      where: { tenantId: session.tenantId, action: "posting_suggestion_outcome" },
      select: { after: true },
    });

    return { lines, entriesThisMonth, toPost, failed, duplicateSamples, suggestionOutcomes };
  });

  const isCash = (code: string) => code.startsWith("514") || code.startsWith("516");
  const isReceivable = (code: string) => code.startsWith("342");
  const isPayable = (code: string) => code.startsWith("441");

  const cashLines = data.lines.filter((l) => isCash(l.account.code));
  const receivableLines = data.lines.filter((l) => isReceivable(l.account.code));
  const payableLines = data.lines.filter((l) => isPayable(l.account.code));
  const chargeLines = data.lines.filter((l) => l.account.classDigit === 6 && l.entry.date >= monthStart);

  const cashBalance = netDebitBalance(cashLines);
  const receivablesBalance = netDebitBalance(receivableLines);
  const payablesBalance = netDebitBalance(payableLines).negated();
  const chargesThisMonth = chargeLines.reduce((acc, l) => acc.plus(l.debit), new Decimal(0));

  const cashTrend = buildMonthlyCashTrend(
    cashLines.map((l) => ({ date: l.entry.date, delta: l.debit.minus(l.credit) })),
    6,
    now,
  );

  const aging = bucketAgingByAge(
    receivableLines.filter((l) => !l.debit.isZero()).map((l) => ({ date: l.entry.date, amount: l.debit })),
    now,
  );

  const suggestionTotal = data.suggestionOutcomes.length;
  const suggestionAccepted = data.suggestionOutcomes.filter(
    (row) => row.after !== null && typeof row.after === "object" && (row.after as { outcome?: string }).outcome === "accepted",
  ).length;

  const attention: AttentionItem[] = [
    ...data.failed.map(
      (doc): AttentionItem => ({
        key: `failed-${doc.id}`,
        dotTone: "neg",
        title: "Extraction échouée",
        detail: doc.originalFilename,
        meta: `reçu le ${dateFormatter.format(doc.uploadedAt)}`,
        href: `/documents/${doc.id}`,
        actionLabel: "Voir",
      }),
    ),
    ...data.duplicateSamples.map(
      (doc): AttentionItem => ({
        key: `dup-${doc.id}`,
        dotTone: "warn",
        title: "Doublon détecté",
        detail: doc.originalFilename,
        meta: `même contenu qu'un autre document — reçu le ${dateFormatter.format(doc.uploadedAt)}`,
        href: `/documents/${doc.id}`,
        actionLabel: "Vérifier",
      }),
    ),
    ...data.toPost
      .filter((doc) => doc.currentAttempt?.arithmeticOk === false)
      .map(
        (doc): AttentionItem => ({
          key: `arith-${doc.id}`,
          dotTone: "neg",
          title: "HT + TVA ≠ TTC",
          detail: doc.originalFilename,
          meta: `reçu le ${dateFormatter.format(doc.uploadedAt)}`,
          href: `/documents/${doc.id}`,
          actionLabel: "Vérifier",
        }),
      ),
    ...data.toPost.map(
      (doc): AttentionItem => ({
        key: `topost-${doc.id}`,
        dotTone: "ai",
        title: "À comptabiliser",
        detail: doc.originalFilename,
        meta: `extrait le ${dateFormatter.format(doc.uploadedAt)}`,
        href: `/documents/${doc.id}`,
        actionLabel: "Comptabiliser",
      }),
    ),
  ];

  const maxTrend = cashTrend.reduce((max, p) => (p.balance.abs().gt(max) ? p.balance.abs() : max), new Decimal(1));
  const chartHeight = 120;
  const chartWidth = 560;
  const pointGap = cashTrend.length > 1 ? chartWidth / (cashTrend.length - 1) : 0;
  const yFor = (balance: InstanceType<typeof Decimal>) => {
    const ratio = balance.div(maxTrend).toNumber();
    return chartHeight - (ratio + 1) * (chartHeight / 2);
  };
  const points = cashTrend.map((p, i) => `${i * pointGap},${yFor(p.balance)}`).join(" ");

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="rounded-xl border border-dashed border-border-2 bg-surface-3 p-3.5 text-[12.5px] text-fg-2">
        <strong className="font-semibold text-fg">Tableau de bord</strong> — agrégats
        calculés directement depuis le grand livre (écritures comptabilisées uniquement).
        Aucune prévision, aucun chiffre inventé — voir les notes sous chaque bloc pour les
        limites connues.
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Trésorerie" value={fmt(cashBalance)} unit="MAD" sub="Comptes 5141 + 5161" />
        <KpiCard label="Créances clients" value={fmt(receivablesBalance)} unit="MAD" sub="Compte 3421, brut" />
        <KpiCard label="Fournisseurs" value={fmt(payablesBalance)} unit="MAD" sub="Compte 4411" />
        <KpiCard label="Charges du mois" value={fmt(chargesThisMonth)} unit="MAD" sub="Classe 6, mois en cours" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-3 p-2.5">
          <span className="text-[11.5px] text-fg-2">Documents à traiter</span>
          <span className="font-mono text-[13px] font-semibold text-fg">{data.toPost.length}</span>
        </div>
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-3 p-2.5">
          <span className="text-[11.5px] text-fg-2">Extractions échouées</span>
          <span className="font-mono text-[13px] font-semibold text-fg">{data.failed.length}</span>
        </div>
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-3 p-2.5">
          <span className="text-[11.5px] text-fg-2">Écritures ce mois</span>
          <span className="font-mono text-[13px] font-semibold text-fg">{data.entriesThisMonth}</span>
        </div>
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-3 p-2.5">
          <span className="text-[11.5px] text-fg-2">Suggestions acceptées</span>
          <span className="font-mono text-[13px] font-semibold text-fg">
            {suggestionTotal === 0 ? "—" : `${suggestionAccepted}/${suggestionTotal}`}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.5fr_1fr]">
        <section className="rounded-xl border border-border bg-surface p-4 shadow-card">
          <h2 className="m-0 text-[13.5px] font-semibold text-fg">Trésorerie — 6 derniers mois</h2>
          <p className="mt-0.5 text-[11.5px] text-fg-3">Comptes 5141 Banque + 5161 Caisse, solde de fin de mois</p>
          {cashTrend.every((p) => p.balance.isZero()) ? (
            <p className="mt-4 text-sm text-fg-2">Aucun mouvement sur les comptes de trésorerie pour l&apos;instant.</p>
          ) : (
            <>
              <svg viewBox={`0 -10 ${chartWidth} ${chartHeight + 20}`} className="mt-3 w-full" role="img" aria-label="Courbe de trésorerie sur six mois">
                <line x1="0" y1={chartHeight / 2} x2={chartWidth} y2={chartHeight / 2} className="stroke-border" strokeWidth="1" strokeDasharray="3 5" />
                <polyline points={points} fill="none" className="stroke-fg" strokeWidth="2" strokeLinejoin="round" />
                {cashTrend.map((p, i) => (
                  <circle key={p.monthStart.toISOString()} cx={i * pointGap} cy={yFor(p.balance)} r="3" className="fill-surface stroke-fg" strokeWidth="2" />
                ))}
              </svg>
              <div className="mt-1 flex justify-between font-mono text-[10px] text-fg-3">
                {cashTrend.map((p) => (
                  <span key={p.monthStart.toISOString()}>{monthLabelFormatter.format(p.monthStart)}</span>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
          <div className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-2.5">
            <h2 className="m-0 text-[13.5px] font-semibold text-fg">À traiter</h2>
            <span className="font-mono text-[11px] text-fg-3">{attention.length} élément{attention.length > 1 ? "s" : ""}</span>
          </div>
          {attention.length === 0 ? (
            <p className="p-4 text-center text-[12px] text-fg-3">Rien à traiter pour l&apos;instant.</p>
          ) : (
            <ul className="flex max-h-[420px] flex-col overflow-y-auto">
              {attention.map((item) => (
                <li key={item.key} className="flex flex-col gap-1.5 border-b border-border p-3">
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                        item.dotTone === "neg" ? "bg-neg" : item.dotTone === "warn" ? "bg-warn" : "bg-ai"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="m-0 text-[12.5px] font-medium text-fg">{item.title}</p>
                      <p className="mt-0.5 truncate text-[11.5px] text-fg-2">{item.detail}</p>
                      <p className="mt-0.5 font-mono text-[10.5px] text-fg-3">{item.meta}</p>
                    </div>
                  </div>
                  <Link
                    href={item.href}
                    className="ms-4 self-start rounded-lg border border-ai-border bg-ai-bg px-2.5 py-1 text-[11.5px] font-semibold text-ai"
                  >
                    {item.actionLabel}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
        <h2 className="m-0 text-[13.5px] font-semibold text-fg">Créances clients — antériorité</h2>
        <p className="mt-0.5 text-[11.5px] text-fg-3">
          Débits bruts comptabilisés en 3421, non nettés des règlements — le lettrage (phase 7) ou la
          facturation par facture (phase 9) sera nécessaire pour une antériorité nette par pièce.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg border border-border-2 p-2.5 text-center">
            <p className="m-0 text-[10.5px] uppercase tracking-wide text-fg-3">0–30 j</p>
            <p className="mt-1 font-mono text-sm font-semibold text-fg">{fmt(aging.d0to30)}</p>
          </div>
          <div className="rounded-lg border border-border-2 p-2.5 text-center">
            <p className="m-0 text-[10.5px] uppercase tracking-wide text-fg-3">31–60 j</p>
            <p className="mt-1 font-mono text-sm font-semibold text-fg">{fmt(aging.d31to60)}</p>
          </div>
          <div className="rounded-lg border border-border-2 p-2.5 text-center">
            <p className="m-0 text-[10.5px] uppercase tracking-wide text-fg-3">61–90 j</p>
            <p className="mt-1 font-mono text-sm font-semibold text-fg">{fmt(aging.d61to90)}</p>
          </div>
          <div className="rounded-lg border border-warn/30 bg-warn-bg p-2.5 text-center">
            <p className="m-0 text-[10.5px] uppercase tracking-wide text-warn">90+ j</p>
            <p className="mt-1 font-mono text-sm font-semibold text-warn">{fmt(aging.d90plus)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
