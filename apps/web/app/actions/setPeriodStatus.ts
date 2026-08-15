"use server";

import { revalidatePath } from "next/cache";
import { withTenant, type PeriodStatus } from "@mou7asib/db";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/policy";

// Locking/unlocking is owner-only (period:manage) — a period lock is a compliance
// control (CLAUDE.md §2 rule 4), not something an employee/accountant should flip
// unilaterally. The DB triggers don't restrict *who* can post into a locked period,
// only *whether* posting is allowed at all — this role check is the only gate on who
// may change that.
export async function setPeriodStatus(periodId: string, status: PeriodStatus): Promise<void> {
  const session = await requireSession();
  if (!can(session.role, "period:manage")) {
    throw new Error("Action non autorisée pour ce rôle.");
  }

  await withTenant(session.tenantId, (tx) =>
    tx.period.updateMany({ where: { id: periodId, tenantId: session.tenantId }, data: { status } }),
  );

  revalidatePath("/tva");
}
