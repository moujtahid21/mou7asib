import { createIsPassageWorksheet } from "@/app/actions/createIsPassageWorksheet";
import { addIsPassageLine } from "@/app/actions/addIsPassageLine";
import { validateIsPassageWorksheet } from "@/app/actions/validateIsPassageWorksheet";

export interface IsWorksheetRow {
  id: string;
  periodStart: string;
  periodEnd: string;
  resultatComptable: string;
  resultatFiscal: string;
  status: "draft" | "validated";
  validatedAt: string | null;
  isDue: string | null;
  lines: { kind: "reintegration" | "deduction"; label: string; amount: string; explanation: string }[];
}

// CLAUDE.md §5.5 — the tableau de passage. résultatComptable is a real snapshot of
// phase 10's CPC; résultatFiscal/isDue are computed by packages/accounting's computeIs,
// which returns null wherever a bracket or cotisation minimale isn't configured — both
// tables ship empty (see build-order.md's S12 entry), so isDue is honestly null today,
// never a guessed figure.
export default function IsPanel({
  canManage,
  periodStart,
  periodEnd,
  resultatComptable,
  worksheets,
  bracketsConfigured,
  cotisationConfigured,
}: {
  canManage: boolean;
  periodStart: string;
  periodEnd: string;
  resultatComptable: string;
  worksheets: IsWorksheetRow[];
  bracketsConfigured: boolean;
  cotisationConfigured: boolean;
}) {
  const draftWorksheet = worksheets.find((w) => w.status === "draft") ?? null;

  return (
    <section className="rounded-xl border border-border bg-surface p-4 shadow-card">
      <h2 className="m-0 text-[13.5px] font-semibold text-fg">Impôt sur les Sociétés — non officiel</h2>
      <p className="mt-1 text-[11.5px] text-fg-2">
        Barèmes IS et cotisation minimale TODO(legal) L-27–L-37 —{" "}
        {bracketsConfigured ? "barème configuré" : "aucun barème configuré"},{" "}
        {cotisationConfigured ? "cotisation minimale configurée" : "cotisation minimale non configurée"}. Le
        résultat comptable ci-dessous vient du CPC réel (période sélectionnée plus haut) ; l&apos;impôt dû
        reste non calculable tant que les barèmes ne le sont pas.
      </p>

      {canManage && (
        <form action={createIsPassageWorksheet} className="mt-3 flex flex-wrap items-center gap-2 text-xs text-fg-2">
          <input type="hidden" name="periodStart" value={periodStart} />
          <input type="hidden" name="periodEnd" value={periodEnd} />
          <input type="hidden" name="resultatComptable" value={resultatComptable} />
          <span>
            Créer un tableau de passage pour {periodStart} → {periodEnd} (résultat comptable {resultatComptable} MAD)
          </span>
          <button type="submit" className="rounded-lg border border-border-2 px-3 py-1.5 text-xs font-medium text-fg">
            Créer
          </button>
        </form>
      )}

      {worksheets.length === 0 ? (
        <p className="mt-3 text-[12px] text-fg-3">Aucun tableau de passage pour l&apos;instant.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {worksheets.map((w) => {
            const boundValidate = validateIsPassageWorksheet.bind(null, w.id);
            const boundAddLine = addIsPassageLine.bind(null, w.id);
            return (
              <li key={w.id} className="rounded-lg border border-border-2 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[11px] text-fg-3">
                    {w.periodStart} → {w.periodEnd}
                  </span>
                  <span
                    className={`rounded-md border px-1.5 py-0.5 font-mono text-[10.5px] font-semibold ${
                      w.status === "validated" ? "border-pos/30 bg-pos-bg text-pos" : "border-ai-border bg-ai-bg text-ai"
                    }`}
                  >
                    {w.status === "validated" ? `Validé — ${w.validatedAt ?? ""}` : "Brouillon"}
                  </span>
                </div>

                <table className="mt-2 w-full border-collapse text-xs">
                  <tbody>
                    <tr className="border-b border-border">
                      <td className="p-1">Résultat comptable</td>
                      <td className="p-1 text-end font-mono tabular-nums">{w.resultatComptable} MAD</td>
                    </tr>
                    {w.lines.map((line, i) => (
                      <tr key={i} className="border-b border-border">
                        <td className="p-1">
                          <span className={line.kind === "reintegration" ? "text-neg" : "text-pos"}>
                            {line.kind === "reintegration" ? "+ " : "− "}
                            {line.label}
                          </span>
                          <p className="m-0 mt-0.5 text-[10.5px] text-fg-3">{line.explanation}</p>
                        </td>
                        <td className="p-1 text-end font-mono tabular-nums">{line.amount} MAD</td>
                      </tr>
                    ))}
                    <tr className="border-b border-border font-semibold text-fg">
                      <td className="p-1">Résultat fiscal</td>
                      <td className="p-1 text-end font-mono tabular-nums">{w.resultatFiscal} MAD</td>
                    </tr>
                    <tr className="font-semibold text-fg">
                      <td className="p-1">IS dû</td>
                      <td className="p-1 text-end font-mono tabular-nums">
                        {w.isDue ?? <span className="text-warn">non calculable</span>}
                        {w.isDue !== null && " MAD"}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {canManage && w.status === "draft" && (
                  <>
                    <form action={boundAddLine} className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-4">
                      <select name="kind" className="rounded border border-border-2 px-1.5 py-1 text-xs">
                        <option value="reintegration">Réintégration</option>
                        <option value="deduction">Déduction</option>
                      </select>
                      <input name="label" placeholder="Libellé" required className="rounded border border-border-2 px-1.5 py-1 text-xs sm:col-span-1" />
                      <input name="amount" inputMode="decimal" placeholder="0.00" required className="rounded border border-border-2 px-1.5 py-1 text-xs font-mono" />
                      <input name="explanation" placeholder="Explication (obligatoire)" required className="rounded border border-border-2 px-1.5 py-1 text-xs" />
                      <button type="submit" className="rounded-lg border border-border-2 px-3 py-1.5 text-xs font-medium text-fg sm:col-span-4">
                        Ajouter la ligne
                      </button>
                    </form>
                    <form action={boundValidate} className="mt-2">
                      <button type="submit" className="rounded-lg bg-fg px-3 py-1.5 text-xs font-medium text-bg">
                        Marquer comme validé
                      </button>
                    </form>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {draftWorksheet === null && worksheets.length > 0 && (
        <p className="mt-2 text-[11px] text-fg-3">Tous les tableaux existants sont validés.</p>
      )}
    </section>
  );
}
