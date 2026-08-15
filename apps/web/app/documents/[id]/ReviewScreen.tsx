"use client";

import { useActionState } from "react";
import { updateExtractedField, type UpdateFieldState } from "@/app/actions/updateExtractedField";
import type { BoundingBox } from "@/lib/boundingBox";
import PostingPanel, { type AccountOption, type PostedEntrySummary, type PostingSuggestionSummary } from "./PostingPanel";
import type { TvaBreakdown } from "@/lib/tvaResolution";

export interface ReviewField {
  key: string;
  fieldName: string;
  groupName: string | null;
  groupIndex: number | null;
  label: string;
  /** override ?? original — the value actually shown/edited. */
  displayValue: string | null;
  confidence: number | null;
  boundingBox: BoundingBox | null;
  isLowConfidence: boolean;
  isCorrected: boolean;
}

interface ReviewScreenProps {
  documentId: string;
  imageWidth: number | null;
  imageHeight: number | null;
  fields: ReviewField[];
  arithmeticOk: boolean | null;
  accounts: AccountOption[];
  postedEntry: PostedEntrySummary | null;
  suggestion: PostingSuggestionSummary | null;
  tvaBreakdown: TvaBreakdown | null;
  tvaRegime: "encaissement" | "debit" | null;
  cashThreshold: string | null;
  postingDefaults: { date: string | null; label: string; amount: string | null };
}

const initialFieldState: UpdateFieldState = null;

function FieldValueCell({ documentId, field }: { documentId: string; field: ReviewField }) {
  const boundAction = updateExtractedField.bind(null, {
    documentId,
    fieldName: field.fieldName,
    groupName: field.groupName,
    groupIndex: field.groupIndex,
  });
  const [state, formAction, isPending] = useActionState(boundAction, initialFieldState);

  return (
    <div>
      <form action={formAction} className="flex items-center gap-2">
        <input type="hidden" name="action" value="update" />
        <input
          type="text"
          name="value"
          defaultValue={field.displayValue ?? ""}
          placeholder={field.displayValue === null ? "Non extrait — saisir la valeur" : undefined}
          className="w-full rounded-lg border border-border-2 bg-surface px-2 py-1 text-sm text-fg"
        />
        <button
          type="submit"
          disabled={isPending}
          className="shrink-0 rounded-lg border border-border-2 px-2 py-1 text-xs font-medium text-fg disabled:opacity-60"
        >
          Enregistrer
        </button>
      </form>

      <div className="mt-1 flex items-center gap-2">
        {field.isCorrected ? (
          <>
            <span className="rounded-md border border-ai-border bg-ai-bg px-1.5 py-0.5 text-xs font-normal text-ai">
              Modifié
            </span>
            <form action={formAction}>
              <input type="hidden" name="action" value="revert" />
              <button type="submit" disabled={isPending} className="text-xs text-fg-3 underline">
                Annuler la correction
              </button>
            </form>
          </>
        ) : (
          field.isLowConfidence &&
          field.displayValue !== null && (
            <span className="rounded-md border border-warn/30 bg-warn-bg px-1.5 py-0.5 text-xs font-normal text-warn">
              Faible confiance — à vérifier
            </span>
          )
        )}
      </div>

      {state?.error !== undefined && (
        <p role="alert" className="mt-1 text-xs text-neg">
          {state.error}
        </p>
      )}
    </div>
  );
}

// Editable per field (adds override columns, never overwrites the model's
// original output — see updateExtractedField.ts). Confidence/bounding box
// stay untouched on a corrected field (still reflect the model's original
// grounding); a fourth visual state ("corrected") is layered on top of the
// existing confident/low-confidence/not-found states.
export default function ReviewScreen({
  documentId,
  imageWidth,
  imageHeight,
  fields,
  arithmeticOk,
  accounts,
  postedEntry,
  suggestion,
  tvaBreakdown,
  tvaRegime,
  cashThreshold,
  postingDefaults,
}: ReviewScreenProps) {
  const previewUrl = `/api/documents/${documentId}/preview`;
  const rawFileUrl = `/api/documents/${documentId}/image`;
  const hasPreview = imageWidth !== null && imageHeight !== null;

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-1 items-start gap-3 lg:grid-cols-2">
      {/* document preview */}
      <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-2.5">
          <h1 className="m-0 text-[13.5px] font-semibold text-fg">Facture extraite</h1>
        </div>

        {arithmeticOk === false && (
          <p role="alert" className="mx-3.5 mt-3 rounded-lg border border-neg bg-neg-bg p-2.5 text-sm text-neg">
            HT + TVA ≠ TTC sur ce document — à vérifier avant toute utilisation.
          </p>
        )}

        {hasPreview ? (
          <div
            className="relative m-3.5 overflow-hidden rounded-lg border border-border bg-surface-2"
            style={{ aspectRatio: `${imageWidth} / ${imageHeight}` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- locally stored file served via an authorized route handler, not a next/image-optimizable remote asset */}
            <img
              src={previewUrl}
              alt="Document scanné"
              className="absolute inset-0 h-full w-full object-contain"
            />
            {fields.map((field) =>
              field.boundingBox === null ? null : (
                <div
                  key={field.key}
                  className={`absolute border-2 ${
                    field.isCorrected ? "border-ai" : field.isLowConfidence ? "border-warn" : "border-pos"
                  }`}
                  style={{
                    left: `${field.boundingBox.x * 100}%`,
                    top: `${field.boundingBox.y * 100}%`,
                    width: `${field.boundingBox.width * 100}%`,
                    height: `${field.boundingBox.height * 100}%`,
                  }}
                />
              ),
            )}
          </div>
        ) : (
          <p className="mx-3.5 mt-3 rounded-lg border border-border-2 p-4 text-sm text-fg-2">
            Aperçu indisponible.{" "}
            <a href={rawFileUrl} className="underline">
              Télécharger le document original
            </a>
            .
          </p>
        )}

        <div className="flex flex-wrap gap-3.5 px-3.5 pb-3.5 text-[11px] text-fg-2">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 border-2 border-pos" />
            Confiant
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 border-2 border-warn" />
            Faible confiance
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 border-2 border-ai" />
            Corrigé
          </span>
        </div>
      </section>

      {/* extracted fields + posting */}
      <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-2.5">
          <h2 className="m-0 text-[13.5px] font-semibold text-fg">Champs extraits</h2>
          <span className="rounded-md border border-ai-border bg-ai-bg px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-ai">
            Brouillon — non comptabilisé
          </span>
        </div>

        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Champs extraits de la facture</caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="p-2 text-start text-xs font-medium text-fg-2">
                Champ
              </th>
              <th scope="col" className="p-2 text-start text-xs font-medium text-fg-2">
                Valeur
              </th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => (
              <tr key={field.key} className="border-b border-border align-top">
                <th scope="row" className="w-1/3 p-2 text-start text-xs font-normal text-fg-2">
                  {field.label}
                </th>
                <td className="p-2">
                  <FieldValueCell documentId={documentId} field={field} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="p-3.5 pt-0">
          <PostingPanel
            documentId={documentId}
            accounts={accounts}
            postedEntry={postedEntry}
            tvaBreakdown={tvaBreakdown}
            tvaRegime={tvaRegime}
            cashThreshold={cashThreshold}
            suggestion={suggestion}
            defaultDate={postingDefaults.date}
            defaultLabel={postingDefaults.label}
            defaultAmount={postingDefaults.amount}
          />
        </div>
      </section>
    </div>
  );
}
