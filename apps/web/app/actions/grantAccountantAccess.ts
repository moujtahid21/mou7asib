"use server";

import { redirect } from "next/navigation";
import { prisma, withTenant, type AccountantAccessScope } from "@mou7asib/db";
import { requireSession, normalizeEmail } from "@/lib/auth";
import { can } from "@/lib/policy";

const VALID_SCOPES: readonly AccountantAccessScope[] = ["read_only", "read_write"];

// CLAUDE.md §8.1 — "cross-tenant access exists only for accountants explicitly granted
// access by the tenant, through an explicit, audited AccountantAccess grant with a scope
// and an expiry." Grants by email lookup only — never creates an account on the
// accountant's behalf (CLAUDE.md's prohibited-actions list bars that even server-side);
// the accountant must already hold their own mou7asib login.
export async function grantAccountantAccess(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!can(session.role, "accountant:manage")) {
    redirect("/comptables?error=forbidden");
  }

  const emailField = formData.get("accountantEmail");
  const scopeField = formData.get("scope");
  const expiresAtField = formData.get("expiresAt");
  if (typeof emailField !== "string" || typeof scopeField !== "string" || typeof expiresAtField !== "string") {
    redirect("/comptables?error=invalid");
  }
  if (!VALID_SCOPES.includes(scopeField as AccountantAccessScope)) {
    redirect("/comptables?error=invalid");
  }
  const scope = scopeField as AccountantAccessScope;

  const expiresAt = new Date(`${expiresAtField}T23:59:59.999Z`);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
    redirect("/comptables?error=expiry");
  }

  const email = normalizeEmail(emailField);
  const accountant = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (accountant === null) {
    // No account exists for that email — surfaced as a distinct error rather than
    // silently creating one (CLAUDE.md's prohibited-actions list).
    redirect("/comptables?error=no_such_user");
  }
  if (accountant.id === session.userId) {
    redirect("/comptables?error=self_grant");
  }

  await prisma.accountantAccess.upsert({
    where: { tenantId_accountantId: { tenantId: session.tenantId, accountantId: accountant.id } },
    create: {
      tenantId: session.tenantId,
      accountantId: accountant.id,
      scope,
      expiresAt,
      grantedById: session.userId,
    },
    // Re-granting (including after a prior revocation) updates the same row rather than
    // accumulating dead grants — see the model's schema.prisma comment.
    update: { scope, expiresAt, grantedById: session.userId, revokedAt: null, revokedById: null },
  });

  await withTenant(session.tenantId, (tx) =>
    tx.auditLog.create({
      data: {
        tenantId: session.tenantId,
        userId: session.userId,
        action: "accountant_access_granted",
        targetType: "AccountantAccess",
        targetId: accountant.id,
        after: { accountantEmail: email, scope, expiresAt: expiresAt.toISOString() },
      },
    }),
  );

  redirect("/comptables");
}
