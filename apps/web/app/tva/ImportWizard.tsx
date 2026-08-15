"use client";

import { useRef, useState, useTransition } from "react";
import { previewJournalImport, confirmJournalImport, type ImportPreviewState, type ImportConfirmState } from "@/app/actions/importJournal";
import { CANONICAL_FIELDS, type MappingValue } from "@/lib/journalImport";

// Two-step wizard (aperçu -> import) held in client state, not two separate <form>
// submissions — a native <input type="file"> can't be refilled programmatically, so the
// selected File is kept in React state and resubmitted (as a fresh FormData) to the
// confirm action once the user has reviewed and adjusted the column mapping. Every parse
// and every validation still runs server-side (see lib/journalImport.ts) — the client only
// carries the raw bytes across the two steps.
export default function ImportWizard() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewState>(null);
  const [confirmResult, setConfirmResult] = useState<ImportConfirmState>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const headers = preview !== null && !("error" in preview) ? preview.headers : [];
  const mapping = preview !== null && !("error" in preview) ? preview.mapping : {};

  function runPreview(nextFile: File, mappingOverride?: Record<string, MappingValue>) {
    const formData = new FormData();
    formData.set("file", nextFile);
    if (mappingOverride !== undefined) {
      for (const [header, value] of Object.entries(mappingOverride)) {
        formData.set(`map_${header}`, value);
      }
    }
    startTransition(async () => {
      const result = await previewJournalImport(null, formData);
      setPreview(result);
      setConfirmResult(null);
    });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected === undefined) {
      return;
    }
    setFile(selected);
    setConfirmResult(null);
    runPreview(selected);
  }

  function handleMappingChange(header: string, value: MappingValue) {
    if (file === null || preview === null || "error" in preview) {
      return;
    }
    runPreview(file, { ...preview.mapping, [header]: value });
  }

  function handleConfirm() {
    if (file === null || preview === null || "error" in preview) {
      return;
    }
    const formData = new FormData();
    formData.set("file", file);
    for (const [header, value] of Object.entries(preview.mapping)) {
      formData.set(`map_${header}`, value);
    }
    startTransition(async () => {
      const result = await confirmJournalImport(null, formData);
      setConfirmResult(result);
      if (result !== null && !("error" in result)) {
        setFile(null);
        setPreview(null);
        if (fileInputRef.current !== null) {
          fileInputRef.current.value = "";
        }
      }
    });
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-4 shadow-card">
      <h2 className="m-0 text-[13.5px] font-semibold text-fg">Import d&apos;un journal historique</h2>
      <p className="mt-1 text-[12.5px] text-fg-2">
        CSV uniquement pour l&apos;instant (Excel arrive dans une phase ultérieure). Une colonne doit identifier la
        pièce (regroupe les lignes d&apos;une même écriture) ; les écritures déséquilibrées ou comptes inconnus
        bloquent tout l&apos;import — rien n&apos;est écrit tant que l&apos;aperçu n&apos;est pas propre.
      </p>

      <div className="mt-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          className="text-sm"
        />
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
            {preview.totalDataRows} ligne(s) lue(s) → {preview.entryCount} écriture(s) valide(s)
            {preview.issues.length > 0 && `, ${preview.issues.length} problème(s)`}.
          </div>

          {preview.issues.length > 0 && (
            <ul className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-neg/30 bg-neg-bg p-2 text-xs text-neg">
              {preview.issues.map((issue, i) => (
                <li key={i}>
                  {issue.rowNumber !== null ? `ligne ${issue.rowNumber} : ` : ""}
                  {issue.message}
                </li>
              ))}
            </ul>
          )}

          {preview.groups.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[480px] border-collapse text-xs">
                <thead>
                  <tr className="text-fg-2">
                    <th scope="col" className="p-1 text-start font-medium">Pièce</th>
                    <th scope="col" className="p-1 text-start font-medium">Date</th>
                    <th scope="col" className="p-1 text-start font-medium">Libellé</th>
                    <th scope="col" className="p-1 text-end font-medium">Lignes</th>
                    <th scope="col" className="p-1 text-end font-medium">Total débit</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.groups.slice(0, 20).map((g) => (
                    <tr key={g.entryRef} className="border-t border-border">
                      <td className="p-1 font-mono">{g.entryRef}</td>
                      <td className="p-1">{g.date}</td>
                      <td className="p-1">{g.label}</td>
                      <td className="p-1 text-end">{g.lineCount}</td>
                      <td className="p-1 text-end font-mono tabular-nums">{g.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.groups.length > 20 && (
                <p className="mt-1 text-[11px] text-fg-2">…et {preview.groups.length - 20} autre(s) écriture(s).</p>
              )}
            </div>
          )}

          <button
            type="button"
            disabled={isPending || !preview.mappingComplete || preview.issues.length > 0 || preview.groups.length === 0}
            onClick={handleConfirm}
            className="mt-3 rounded-lg bg-fg px-4 py-2 text-sm font-medium text-bg disabled:opacity-60"
          >
            {isPending ? "Import en cours…" : `Importer ${preview.entryCount} écriture(s)`}
          </button>
        </div>
      )}

      {confirmResult !== null && "error" in confirmResult && (
        <p role="alert" className="mt-3 rounded-lg border border-neg bg-neg-bg p-2.5 text-sm text-neg">
          {confirmResult.error}
        </p>
      )}
      {confirmResult !== null && !("error" in confirmResult) && confirmResult.alreadyImported && (
        <p className="mt-3 rounded-lg border border-border-2 bg-surface-3 p-2.5 text-sm text-fg-2">
          Ce fichier a déjà été importé ({confirmResult.entryCount} écriture(s)) — ré-import ignoré, rien n&apos;a
          changé.
        </p>
      )}
      {confirmResult !== null && !("error" in confirmResult) && !confirmResult.alreadyImported && (
        <p className="mt-3 rounded-lg border border-pos/30 bg-pos-bg p-2.5 text-sm text-pos">
          {confirmResult.entryCount} écriture(s) importée(s) et comptabilisée(s) à partir de {confirmResult.rowCount}{" "}
          ligne(s).
        </p>
      )}
    </section>
  );
}
