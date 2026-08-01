"use client";

import type { BoundingBox } from "@/lib/boundingBox";

export interface ReviewField {
  key: string;
  label: string;
  displayValue: string | null;
  confidence: number | null;
  boundingBox: BoundingBox | null;
  isLowConfidence: boolean;
}

interface ReviewScreenProps {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  fields: ReviewField[];
  arithmeticOk: boolean | null;
}

// D2: read-only, per the confirmed scope decision — "see the correct fields
// extracted... flagged," not "correct." Edit-and-save belongs to W3's real
// review queue with proper acceptance tracking.
export default function ReviewScreen({
  imageUrl,
  imageWidth,
  imageHeight,
  fields,
  arithmeticOk,
}: ReviewScreenProps) {
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

      <div
        className="relative mt-4 w-full overflow-hidden rounded"
        style={{ aspectRatio: `${imageWidth} / ${imageHeight}` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- locally stored file served via an authorized route handler, not a next/image-optimizable remote asset */}
        <img
          src={imageUrl}
          alt="Document scanné"
          className="absolute inset-0 h-full w-full object-contain"
        />
        {fields.map((field) =>
          field.boundingBox === null ? null : (
            <div
              key={field.key}
              className={`absolute border-2 ${
                field.isLowConfidence ? "border-amber-500" : "border-emerald-500"
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

      <dl className="mt-4 space-y-3 px-2">
        {fields.map((field) => (
          <div key={field.key} className="border-b border-slate-200 pb-2">
            <dt className="text-xs text-slate-500">{field.label}</dt>
            <dd className="text-sm font-medium">
              {field.displayValue ?? (
                <span className="text-slate-400">Non extrait</span>
              )}
              {field.isLowConfidence && field.displayValue !== null && (
                <span className="ms-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-normal text-amber-800">
                  Faible confiance — à vérifier
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </main>
  );
}
