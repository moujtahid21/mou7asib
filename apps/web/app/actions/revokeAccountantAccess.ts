"use server";

import { redirect } from "next/navigation";
import { prisma, withTenant } from "@mou7asib/db";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/policy";

// CLAUDE.md §8.1 — revocation must take effect immediately, everywhere: getSession
// re-checks revokedAt on every request (see lib/auth.ts's grantedRole), it isn't just a
// UI-level hide. AccountantAccess is deliberately not RLS'd (bootstrap/identity table —
// see its schema.prisma comment), so tenantId is filtered explicitly here rather than
// relying on a backstop.
export async function revokeAccountantAccess(accessId: string): Promise<void> {
  const session = await requireSession();
  if (!can(session.role, "accountant:manage")) {
    redirect("/comptables?error=forbidden");
  }

  const grant = await prisma.accountantAccess.findFirst({
    where: { id: accessId, tenantId: session.tenantId, revokedAt: null },
    select: { id: true, accountantId: true },
  });
  if (grant === null) {
    redirect("/comptables");
  }

  await prisma.accountantAccess.update({
    where: { id: grant.id },
    data: { revokedAt: new Date(), revokedById: session.userId },
  });

  await withTenant(session.tenantId, (tx) =>
    tx.auditLog.create({
      data: {
        tenantId: session.tenantId,
        userId: session.userId,
        action: "accountant_access_revoked",
        targetType: "AccountantAccess",
        targetId: grant.accountantId,
      },
    }),
  );

  redirect("/comptables");
}
