import type { Prisma, Period } from "@mou7asib/db";

// A fixed, generous number of line rows rendered by the manual-entry form
// (app/tva/JournalEntryForm.tsx) — simplest possible progressive-enhancement shape, no
// client-side add/remove state machine, matching this codebase's existing form
// conventions (CaptureForm, LoginForm). Lives here, not in the "use server" action file,
// because a "use server" module may only export async functions.
export const MAX_ENTRY_LINES = 8;

/** Calendar-month boundaries (UTC) containing `date`. */
export function monthBoundsFor(date: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
  return { start, end };
}

/**
 * Finds or creates the tenant's calendar-month period covering `date` — see the Period
 * model's comment in schema.prisma for why "auto-vivify a calendar month" is a
 * placeholder policy (no fiscal-year configuration exists yet, that's a later
 * Paramètres/phase 16 concern) and not something to mistake for a real close/open
 * workflow. Must run inside a tenant-scoped transaction (periods is RLS'd).
 */
export async function findOrCreatePeriod(
  tx: Prisma.TransactionClient,
  tenantId: string,
  date: Date,
): Promise<Period> {
  const { start, end } = monthBoundsFor(date);
  const existing = await tx.period.findUnique({
    where: { tenantId_startDate_endDate: { tenantId, startDate: start, endDate: end } },
  });
  if (existing !== null) {
    return existing;
  }
  return tx.period.create({ data: { tenantId, startDate: start, endDate: end, status: "open" } });
}
