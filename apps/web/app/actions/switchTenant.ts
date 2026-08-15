"use server";

import { redirect } from "next/navigation";
import { prisma } from "@mou7asib/db";
import { requireSession, createSession, grantedRole } from "@/lib/auth";

// Creates a new Session scoped to the target tenant rather than mutating the current one
// (see Session's schema.prisma comment) — the org switcher in packages/ui calls this.
// Valid for either an ordinary TenantMembership or an active AccountantAccess grant
// (CLAUDE.md §8.1) — the same two paths getSession re-checks on every subsequent request.
export async function switchTenant(tenantId: string): Promise<void> {
  const session = await requireSession();

  const membership = await prisma.tenantMembership.findUnique({
    where: { tenantId_userId: { tenantId, userId: session.userId } },
    select: { tenantId: true },
  });
  if (membership === null && (await grantedRole(tenantId, session.userId)) === null) {
    // Not a member of that tenant and no active accountant grant into it — no-op rather
    // than an error page for what's realistically a stale client-side list, not an
    // attack worth surfacing loudly.
    redirect("/documents");
  }

  await createSession(session.userId, tenantId);
  redirect("/documents");
}
