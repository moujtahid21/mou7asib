import { grantAccountantAccess } from "@/app/actions/grantAccountantAccess";
import { revokeAccountantAccess } from "@/app/actions/revokeAccountantAccess";

export interface AccountantAccessRow {
  id: string;
  accountantEmail: string;
  scope: "read_only" | "read_write";
  grantedByEmail: string;
  expiresAt: string;
  status: "active" | "expired" | "revoked";
  revokedAt: string | null;
}

const SCOPE_LABEL: Record<AccountantAccessRow["scope"], string> = {
  read_only: "Lecture seule",
  read_write: "Lecture-écriture",
};

const STATUS_STYLE: Record<AccountantAccessRow["status"], string> = {
  active: "border-pos/30 bg-pos-bg text-pos",
  expired: "border-border-2 bg-surface-2 text-fg-3",
  revoked: "border-neg/30 bg-neg-bg text-neg",
};

const STATUS_LABEL: Record<AccountantAccessRow["status"], string> = {
  active: "Actif",
  expired: "Expiré",
  revoked: "Révoqué",
};

// CLAUDE.md §8.1 — the whole UI surface for R1 of ADR 0004's accountant interface: an
// owner grants a scoped, expiring AccountantAccess row to an accountant who already has
// their own mou7asib login (no account creation happens here), and can revoke it
// immediately. Every grant/revoke is server-side audit-logged (see the two actions).
export default function ComptablesPanel({
  canManage,
  grants,
}: {
  canManage: boolean;
  grants: AccountantAccessRow[];
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4 shadow-card">
      <h2 className="m-0 text-[13.5px] font-semibold text-fg">Accès comptable externe</h2>
      <p className="mt-1 text-[11.5px] text-fg-2">
        Un accès donne à un comptable externe une session dans vos livres, avec la portée et
        l&apos;échéance choisies ici — jamais un accès permanent implicite (CLAUDE.md §8.1). Le
        comptable doit déjà avoir son propre compte mou7asib ; cet écran n&apos;en crée aucun.
      </p>

      {!canManage && (
        <p className="mt-3 text-[12px] text-fg-3">Réservé au propriétaire du tenant.</p>
      )}

      {canManage && (
        <form action={grantAccountantAccess} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
          <input
            name="accountantEmail"
            type="email"
            placeholder="email@comptable.ma"
            required
            className="rounded border border-border-2 px-1.5 py-1 text-xs sm:col-span-2"
          />
          <select name="scope" className="rounded border border-border-2 px-1.5 py-1 text-xs" defaultValue="read_only">
            <option value="read_only">Lecture seule</option>
            <option value="read_write">Lecture-écriture</option>
          </select>
          <input name="expiresAt" type="date" required className="rounded border border-border-2 px-1.5 py-1 text-xs" />
          <button
            type="submit"
            className="rounded-lg border border-border-2 px-3 py-1.5 text-xs font-medium text-fg sm:col-span-4"
          >
            Accorder l&apos;accès
          </button>
        </form>
      )}

      {grants.length === 0 ? (
        <p className="mt-3 text-[12px] text-fg-3">Aucun accès comptable pour l&apos;instant.</p>
      ) : (
        <table className="mt-3 w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-border text-start text-fg-3">
              <th className="p-1 text-start font-medium">Comptable</th>
              <th className="p-1 text-start font-medium">Portée</th>
              <th className="p-1 text-start font-medium">Accordé par</th>
              <th className="p-1 text-start font-medium">Échéance</th>
              <th className="p-1 text-start font-medium">Statut</th>
              {canManage && <th className="p-1" />}
            </tr>
          </thead>
          <tbody>
            {grants.map((grant) => {
              const boundRevoke = revokeAccountantAccess.bind(null, grant.id);
              return (
                <tr key={grant.id} className="border-b border-border">
                  <td className="p-1 font-mono">{grant.accountantEmail}</td>
                  <td className="p-1">{SCOPE_LABEL[grant.scope]}</td>
                  <td className="p-1 font-mono text-fg-3">{grant.grantedByEmail}</td>
                  <td className="p-1 font-mono tabular-nums">{grant.expiresAt}</td>
                  <td className="p-1">
                    <span
                      className={`rounded-md border px-1.5 py-0.5 font-mono text-[10.5px] font-semibold ${STATUS_STYLE[grant.status]}`}
                    >
                      {STATUS_LABEL[grant.status]}
                    </span>
                  </td>
                  {canManage && (
                    <td className="p-1 text-end">
                      {grant.status === "active" && (
                        <form action={boundRevoke}>
                          <button type="submit" className="rounded-lg border border-border-2 px-2 py-1 text-[11px] font-medium text-fg">
                            Révoquer
                          </button>
                        </form>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
