"use client";

import { useActionState } from "react";
import { updateExtractedField, type UpdateFieldState } from "@/app/actions/updateExtractedField";
import type { BoundingBox } from "@/lib/boundingBox";

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
          className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
        />
        <button
          type="submit"
          disabled={isPending}
          className="shrink-0 rounded border border-slate-300 px-2 py-1 text-xs font-medium disabled:opacity-60"
        >
          Enregistrer
        </button>
      </form>

      <div className="mt-1 flex items-center gap-2">
        {field.isCorrected ? (
          <>
            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-normal text-blue-800">
              Modifié
            </span>
            <form action={formAction}>
              <input type="hidden" name="action" value="revert" />
              <button type="submit" disabled={isPending} className="text-xs text-slate-500 underline">
                Annuler la correction
              </button>
            </form>
          </>
        ) : (
          field.isLowConfidence &&
          field.displayValue !== null && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-normal text-amber-800">
              Faible confiance — à vérifier
            </span>
          )
        )}
      </div>

      {state?.error !== undefined && (
        <p role="alert" className="mt-1 text-xs text-red-700">
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
}: ReviewScreenProps) {
  const previewUrl = `/api/documents/${documentId}/preview`;
  const rawFileUrl = `/api/documents/${documentId}/image`;
  const hasPreview = imageWidth !== null && imageHeight !== null;

  return (
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="px-2 text-xl font-semibold">Facture extraite</h1>

      {arithmeticOk === false && (
        <p
          role="alert"
          className="mx-2 mt-3 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800"
        >
          HT + TVA ≠ TTC sur ce document — à vérifier avant toute utilisation.
        </p>
      )}

      {hasPreview ? (
        <div
          className="relative mt-4 w-full overflow-hidden rounded"
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
                  field.isCorrected
                    ? "border-blue-500"
                    : field.isLowConfidence
                      ? "border-amber-500"
                      : "border-emerald-500"
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
        <p className="mx-2 mt-4 rounded border border-slate-300 p-4 text-sm text-slate-600">
          Aperçu indisponible.{" "}
          <a href={rawFileUrl} className="underline">
            Télécharger le document original
          </a>
          .
        </p>
      )}

      <table className="mt-4 w-full border-collapse text-sm">
        <caption className="sr-only">Champs extraits de la facture</caption>
        <thead>
          <tr className="border-b border-slate-300">
            <th scope="col" className="p-2 text-start font-medium text-slate-600">
              Champ
            </th>
            <th scope="col" className="p-2 text-start font-medium text-slate-600">
              Valeur
            </th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => (
            <tr key={field.key} className="border-b border-slate-200 align-top">
              <th scope="row" className="w-1/3 p-2 text-start text-xs font-normal text-slate-500">
                {field.label}
              </th>
              <td className="p-2">
                <FieldValueCell documentId={documentId} field={field} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
