"use client";

import { useRef, useState, useTransition } from "react";
import {
  previewBankStatement,
  confirmBankStatement,
  type ImportPreviewState,
  type ImportConfirmState,
} from "@/app/actions/importBankStatement";
import { CANONICAL_FIELDS, type MappingValue } from "@/lib/bankStatement";

export interface BankAccountOption {
  code: string;
  label: string;
}

// Same two-step wizard shape as tva/ImportWizard.tsx (S4) — see that file's comment for
// why the File is held in client state across two server-action calls instead of two
// <form> submissions.
export default function StatementImportWizard({ bankAccounts }: { bankAccounts: BankAccountOption[] }) {
  const [bankAccountCode, setBankAccountCode] = useState(bankAccounts[0]?.code ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewState>(null);
  const [confirmResult, setConfirmResult] = useState<ImportConfirmState>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const headers = preview !== null && !("error" in preview) ? preview.headers : [];
  const mapping = preview !== null && !("error" in preview) ? preview.mapping : {};

  function runPreview(nextFile: File, mappingOverride?: Record<string, string>) {
    const formData = new FormData();
    formData.set("file", nextFile);
    if (mappingOverride !== undefined) {
      for (const [header, value] of Object.entries(mappingOverride)) {
        formData.set(`map_${header}`, value);
      }
    }
    startTransition(async () => {
      const result = await previewBankStatement(null, formData);
      setPreview(result);
      setConfirmResult(null);
    });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected === undefined) return;
    setFile(selected);
    setConfirmResult(null);
    runPreview(selected);
  }

  function handleMappingChange(header: string, value: MappingValue) {
    if (file === null || preview === null || "error" in preview) return;
    runPreview(file, { ...preview.mapping, [header]: value });
  }

  function handleConfirm() {
    if (file === null || preview === null || "error" in preview) return;
    const formData = new FormData();
    formData.set("file", file);
    formData.set("bankAccountCode", bankAccountCode);
    for (const [header, value] of Object.entries(preview.mapping)) {
      formData.set(`map_${header}`, value);
    }
    startTransition(async () => {
      const result = await confirmBankStatement(null, formData);
      setConfirmResult(result);
      if (result !== null && !("error" in result)) {
        setFile(null);
        setPreview(null);
        if (fileInputRef.current !== null) fileInputRef.current.value = "";
      }
    });
  }

  if (bankAccounts.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface p-4 shadow-card text-sm text-fg-2">
        Aucun compte de trésorerie (5141/5161) dans le plan comptable de ce tenant — rien à
        rapprocher pour l&apos;instant.
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-4 shadow-card">
      <h2 className="m-0 text-[13.5px] font-semibold text-fg">Import d&apos;un relevé bancaire</h2>
      <p className="mt-1 text-[12.5px] text-fg-2">
        CSV uniquement pour l&apos;instant (MT940/CAMT.053 arrivent plus tard — voir la feuille de route). L&apos;import
        est idempotent ligne par ligne : ré-importer un relevé qui chevauche une période déjà importée n&apos;ajoute
        que les lignes réellement nouvelles.
      </p>

      <div className="mt-3">
        <label htmlFor="bank-account" className="block text-xs font-medium text-fg-2">
          Compte bancaire (compte du plan comptable)
        </label>
        <select
          id="bank-account"
          value={bankAccountCode}
          onChange={(e) => setBankAccountCode(e.target.value)}
          className="mt-1 w-full max-w-xs rounded-lg border border-border-2 px-2 py-1.5 text-sm"
        >
          {bankAccounts.map((a) => (
            <option key={a.code} value={a.code}>
              {a.code} — {a.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3">
        <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFileChange} className="text-sm" />
      </div>

      {isPending && <p className="mt-2 text-xs text-fg-2">Analyse en cours…</p>}

      {preview !== null && "error" in preview && (
        <p role="alert" className="mt-3 rounded-lg border border-neg bg-neg-bg p-2.5 text-sm text-neg">
          {preview.error}
        </p>
      )}

      {preview !== null && !("error" in preview) && (
        <div className="mt-4">
          <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-fg-2">Mapping des colonnes</h3>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {headers.map((header) => (
              <label key={header} className="flex items-center justify-between gap-2 text-xs text-fg-2">
                <span className="truncate font-mono">{header}</span>
                <select
                  value={mapping[header] ?? "ignore"}
                  onChange={(e) => handleMappingChange(header, e.target.value as MappingValue)}
                  className="rounded border border-border-2 px-1.5 py-1 text-xs"
                >
                  <option value="ignore">Ignorer</option>
                  {CANONICAL_FIELDS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                      {f.required ? " *" : ""}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <div className="mt-3 text-[12.5px] text-fg-2">
            {preview.totalDataRows} ligne(s) lue(s) → {preview.transactionCount} transaction(s) valide(s)
            {preview.issues.length > 0 && `, ${preview.issues.length} problème(s)`}.
          </div>

          {preview.issues.length > 0 && (
            <ul className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-neg/30 bg-neg-bg p-2 text-xs text-neg">
              {preview.issues.map((issue, i) => (
                <li key={i}>
                  ligne {issue.rowNumber} : {issue.message}
                </li>
              ))}
            </ul>
          )}

          {preview.transactions.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-xs">
                <thead>
                  <tr className="text-fg-2">
                    <th scope="col" className="p-1 text-start font-medium">Date</th>
                    <th scope="col" className="p-1 text-start font-medium">Libellé</th>
                    <th scope="col" className="p-1 text-end font-medium">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.transactions.map((t, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="p-1">{t.date}</td>
                      <td className="p-1">{t.label}</td>
                      <td className="p-1 text-end font-mono tabular-nums">{t.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.transactionCount > preview.transactions.length && (
                <p className="mt-1 text-[11px] text-fg-2">
                  …et {preview.transactionCount - preview.transactions.length} autre(s) transaction(s).
                </p>
              )}
            </div>
          )}

          <button
            type="button"
            disabled={isPending || !preview.mappingComplete || preview.issues.length > 0 || preview.transactionCount === 0}
            onClick={handleConfirm}
            className="mt-3 rounded-lg bg-fg px-4 py-2 text-sm font-medium text-bg disabled:opacity-60"
          >
            {isPending ? "Import en cours…" : `Importer ${preview.transactionCount} transaction(s)`}
          </button>
        </div>
      )}

      {confirmResult !== null && "error" in confirmResult && (
        <p role="alert" className="mt-3 rounded-lg border border-neg bg-neg-bg p-2.5 text-sm text-neg">
          {confirmResult.error}
        </p>
      )}
      {confirmResult !== null && !("error" in confirmResult) && (
        <p className="mt-3 rounded-lg border border-pos/30 bg-pos-bg p-2.5 text-sm text-pos">
          {confirmResult.importedCount} nouvelle(s) transaction(s) importée(s) sur {confirmResult.rowCount} ligne(s)
          {confirmResult.skippedCount > 0 && ` (${confirmResult.skippedCount} déjà connue(s), ignorée(s))`}.
        </p>
      )}
    </section>
  );
}
