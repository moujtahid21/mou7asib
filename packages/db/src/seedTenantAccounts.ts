import type { Prisma } from "../generated/prisma/client.ts";

/**
 * Copies the shared CGNC reference plan into a brand-new tenant's own Account rows
 * (CLAUDE.md §5.1's "customisable sub-account layer") — copies, not a live foreign key,
 * so the tenant can rename or extend freely afterward without ever touching
 * ReferenceAccount. Must run inside a transaction that has already set
 * `app.tenant_id` for `tenantId` (accounts is RLS'd) — see actions/signup.ts for the one
 * call site today.
 */
export async function seedTenantAccounts(tx: Prisma.TransactionClient, tenantId: string): Promise<void> {
  const referenceAccounts = await tx.referenceAccount.findMany();
  for (const ref of referenceAccounts) {
    await tx.account.create({
      data: {
        tenantId,
        code: ref.code,
        label: ref.label,
        classDigit: ref.classDigit,
        parentCode: ref.parentCode,
        sourceReferenceCode: ref.code,
      },
    });
  }
}
