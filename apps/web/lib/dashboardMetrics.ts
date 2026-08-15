import { Decimal, ZERO, sum, type Money } from "@mou7asib/accounting";

// Pure aggregation helpers for the dashboard (phase 6) — no Prisma, no Date.now(), dates
// always passed in, same "inject the clock" discipline as packages/accounting (CLAUDE.md
// §5.7). The DB queries that produce their inputs live in app/dashboard/page.tsx; keeping
// the arithmetic here means it can be unit-tested without a database.

export interface AgingBuckets {
  d0to30: Money;
  d31to60: Money;
  d61to90: Money;
  d90plus: Money;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Buckets gross debit amounts posted to a receivables account by age since posting date.
 * Deliberately gross, not netted against later payments — matching individual invoices to
 * settlements needs bank reconciliation (phase 7) or per-invoice tracking (phase 9),
 * neither of which exists yet. Never present this as "amount still owed" without that
 * caveat (see the dashboard page's copy).
 */
export function bucketAgingByAge(lines: readonly { date: Date; amount: Money }[], asOf: Date): AgingBuckets {
  const buckets: AgingBuckets = { d0to30: ZERO, d31to60: ZERO, d61to90: ZERO, d90plus: ZERO };
  for (const line of lines) {
    const ageDays = Math.floor((asOf.getTime() - line.date.getTime()) / DAY_MS);
    if (ageDays <= 30) {
      buckets.d0to30 = buckets.d0to30.plus(line.amount);
    } else if (ageDays <= 60) {
      buckets.d31to60 = buckets.d31to60.plus(line.amount);
    } else if (ageDays <= 90) {
      buckets.d61to90 = buckets.d61to90.plus(line.amount);
    } else {
      buckets.d90plus = buckets.d90plus.plus(line.amount);
    }
  }
  return buckets;
}

export interface CashTrendPoint {
  /** First day of the month (UTC), for labeling by the caller (locale-aware). */
  monthStart: Date;
  /** Cumulative balance as of the end of this month (or `asOf` for the current month). */
  balance: Money;
}

/**
 * Reconstructs a real month-end cash-balance trend from every posted movement into/out of
 * the cash accounts, starting from `openingBalance` (the balance immediately before the
 * earliest movement in `movements`, i.e. 0 unless the caller has reason to seed it
 * otherwise). No forecasting, no fabricated future points — the mockup's dashed "Prévision
 * IA" segment is not built here (CLAUDE.md §14: don't invent a result that looks
 * authoritative).
 */
export function buildMonthlyCashTrend(
  movements: readonly { date: Date; delta: Money }[],
  monthsBack: number,
  asOf: Date,
  openingBalance: Money = ZERO,
): CashTrendPoint[] {
  const sorted = [...movements].sort((a, b) => a.date.getTime() - b.date.getTime());

  const monthStarts: Date[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    monthStarts.push(new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() - i, 1)));
  }

  let runningBalance = openingBalance;
  let movementIndex = 0;
  const points: CashTrendPoint[] = [];

  for (const monthStart of monthStarts) {
    const isCurrentMonth = monthStart.getUTCFullYear() === asOf.getUTCFullYear() && monthStart.getUTCMonth() === asOf.getUTCMonth();
    const cutoff = isCurrentMonth ? asOf : new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1));

    while (movementIndex < sorted.length && sorted[movementIndex]!.date < cutoff) {
      runningBalance = runningBalance.plus(sorted[movementIndex]!.delta);
      movementIndex += 1;
    }
    points.push({ monthStart, balance: runningBalance });
  }

  return points;
}

/** Net balance (debit - credit) across a set of lines — the standard sign convention for
 * asset-side accounts (cash, receivables). Use the negation for liability-side accounts
 * (payables) where the natural balance is credit - debit. */
export function netDebitBalance(lines: readonly { debit: Money; credit: Money }[]): Money {
  return sum(lines.map((l) => l.debit)).minus(sum(lines.map((l) => l.credit)));
}

export { Decimal, ZERO };
