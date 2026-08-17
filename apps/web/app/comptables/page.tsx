import { prisma } from "@mou7asib/db";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/policy";
import ComptablesPanel, { type AccountantAccessRow } from "./ComptablesPanel";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("fr-MA", { dateStyle: "medium", timeZone: "Africa/Casablanca" });

const ERROR_MESSAGES: Record<string, string> = {
  forbidden: "Action non autorisée pour ce rôle.",
  invalid: "Formulaire invalide.",
  expiry: "L'échéance doit être une date future.",
  no_such_user: "Aucun compte mou7asib n'existe pour cette adresse — le comptable doit d'abord créer le sien.",
  self_grant: "Impossible de s'accorder un accès à soi-même.",
};

// CLAUDE.md §8.1 / ADR 0004 (R1) — the accountant surface. AccountantAccess is
// deliberately not RLS'd (see its schema.prisma comment), so tenantId is an explicit
// filter here rather than a withTenant() context, matching how tenant_memberships is
// already queried in layout.tsx.
export default async function ComptablesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const errorMessage = params.error !== undefined ? (ERROR_MESSAGES[params.error] ?? null) : null;
  const canManage = can(session.role, "accountant:manage");

  const rows = await prisma.accountantAccess.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      scope: true,
      expiresAt: true,
      revokedAt: true,
      accountant: { select: { email: true } },
      grantedBy: { select: { email: true } },
    },
  });

  const now = new Date();
  const grants: AccountantAccessRow[] = rows.map((row) => ({
    id: row.id,
    accountantEmail: row.accountant.email,
    scope: row.scope,
    grantedByEmail: row.grantedBy.email,
    expiresAt: dateFormatter.format(row.expiresAt),
    status: row.revokedAt !== null ? "revoked" : row.expiresAt < now ? "expired" : "active",
    revokedAt: row.revokedAt !== null ? dateFormatter.format(row.revokedAt) : null,
  }));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="rounded-xl border border-dashed border-border-2 bg-surface-3 p-3.5 text-[12.5px] text-fg-2">
        <strong className="font-semibold text-fg">Comptables</strong> — accès scopé et daté pour un
        expert-comptable / fiduciaire externe (ADR 0004, phase 14). Aucun connecteur Sage/Cegid
        n&apos;existe encore (discovery non faite, voir l&apos;ADR) : cet écran couvre uniquement
        l&apos;accès direct dans mou7asib.
      </div>

      {errorMessage !== null && (
        <p role="alert" className="rounded-xl border border-neg bg-neg-bg p-3 text-sm text-neg">{errorMessage}</p>
      )}

      <ComptablesPanel canManage={canManage} grants={grants} />
    </div>
  );
}
