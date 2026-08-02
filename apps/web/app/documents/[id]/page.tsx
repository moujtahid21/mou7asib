import { notFound } from "next/navigation";
import { Prisma, prisma } from "@mou7asib/db";
import invoiceFields from "@mou7asib/contracts/invoice-fields.json";
import { visibleDocumentWhere } from "@/lib/documents";
import { LOW_CONFIDENCE_THRESHOLD } from "@/lib/confidence";
import { parseBoundingBox } from "@/lib/boundingBox";
import { deleteDocument } from "@/app/actions/deleteDocument";
import { retryDocument } from "@/app/actions/retryDocument";
import ProcessingStatus from "./ProcessingStatus";
import ReviewScreen, { type ReviewField } from "./ReviewScreen";

export const dynamic = "force-dynamic";

function DocumentActions({ documentId, canRetry }: { documentId: string; canRetry: boolean }) {
  const boundDelete = deleteDocument.bind(null, documentId);
  const boundRetry = retryDocument.bind(null, documentId);
  return (
    <div className="flex gap-2 px-2">
      {canRetry && (
        <form action={boundRetry}>
          <button type="submit" className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium">
            Réessayer
          </button>
        </form>
      )}
      <form action={boundDelete}>
        <button type="submit" className="rounded border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700">
          Supprimer
        </button>
      </form>
    </div>
  );
}

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // CLAUDE.md §10 — never leak server data into client props: select
  // explicitly, never pass a whole Prisma record onward.
  const document = await prisma.document.findFirst({
    where: { id, ...visibleDocumentWhere() },
    select: {
      id: true,
      status: true,
      storedImageWidth: true,
      storedImageHeight: true,
      currentAttemptId: true,
      uploadedAt: true,
    },
  });

  if (!document) {
    notFound();
  }

  if (document.status !== "extracted" && document.status !== "failed") {
    return (
      <>
        <ProcessingStatus
          documentId={document.id}
          initialStatus={document.status}
          uploadedAt={document.uploadedAt.toISOString()}
        />
        <div className="mx-auto max-w-md px-6 pb-6">
          <DocumentActions documentId={document.id} canRetry={false} />
        </div>
      </>
    );
  }

  if (document.status === "failed") {
    return (
      <main className="mx-auto max-w-md p-6">
        <h1 className="text-xl font-semibold">Extraction impossible</h1>
        <p className="mt-2 text-sm text-slate-600">
          L&apos;extraction a échoué après plusieurs tentatives. Une saisie
          manuelle est nécessaire.
        </p>
        <div className="mt-4">
          <DocumentActions documentId={document.id} canRetry={true} />
        </div>
      </main>
    );
  }

  const currentAttempt =
    document.currentAttemptId === null
      ? null
      : await prisma.extractionAttempt.findUnique({
          where: { id: document.currentAttemptId },
          select: { arithmeticOk: true },
        });

  const extractedFields =
    document.currentAttemptId === null
      ? []
      : await prisma.extractedField.findMany({
          where: { attemptId: document.currentAttemptId },
          select: {
            fieldName: true,
            groupName: true,
            groupIndex: true,
            valueText: true,
            valueDecimal: true,
            overrideValueText: true,
            overrideValueDecimal: true,
            correctedAt: true,
            confidence: true,
            boundingBox: true,
          },
        });
  const scalarByName = new Map(
    extractedFields
      .filter((field) => field.groupName === null)
      .map((field) => [field.fieldName, field]),
  );

  // override ?? original — the model's own output (valueText/valueDecimal)
  // is never overwritten in place, see updateExtractedField.ts.
  function buildReviewField(
    key: string,
    fieldName: string,
    groupName: string | null,
    groupIndex: number | null,
    label: string,
    row:
      | {
          valueText: string | null;
          valueDecimal: Prisma.Decimal | null;
          overrideValueText: string | null;
          overrideValueDecimal: Prisma.Decimal | null;
          correctedAt: Date | null;
          confidence: number;
          boundingBox: unknown;
        }
      | undefined,
  ): ReviewField {
    if (row === undefined) {
      return {
        key,
        fieldName,
        groupName,
        groupIndex,
        label,
        displayValue: null,
        confidence: null,
        boundingBox: null,
        isLowConfidence: false,
        isCorrected: false,
      };
    }
    const originalValue = row.valueDecimal !== null ? row.valueDecimal.toFixed(2) : row.valueText;
    const overrideValue =
      row.overrideValueDecimal !== null ? row.overrideValueDecimal.toFixed(2) : row.overrideValueText;
    const isCorrected = row.correctedAt !== null;
    return {
      key,
      fieldName,
      groupName,
      groupIndex,
      label,
      displayValue: isCorrected ? overrideValue : originalValue,
      confidence: row.confidence,
      boundingBox: parseBoundingBox(row.boundingBox),
      isLowConfidence: row.confidence < LOW_CONFIDENCE_THRESHOLD,
      isCorrected,
    };
  }

  const scalarFields: ReviewField[] = invoiceFields.scalarFields.map((meta) =>
    buildReviewField(meta.name, meta.name, null, null, meta.labelFr, scalarByName.get(meta.name)),
  );

  const tvaRows = extractedFields.filter((field) => field.groupName === "tva_lines");
  const tvaGroupIndices = [...new Set(tvaRows.map((row) => row.groupIndex))]
    .filter((index): index is number => index !== null)
    .sort((a, b) => a - b);

  const tvaFields: ReviewField[] = tvaGroupIndices.flatMap((groupIndex) =>
    invoiceFields.groupFields.tva_lines.map((meta) => {
      const row = tvaRows.find(
        (candidate) => candidate.groupIndex === groupIndex && candidate.fieldName === meta.name,
      );
      return buildReviewField(
        `tva_lines[${groupIndex}].${meta.name}`,
        meta.name,
        "tva_lines",
        groupIndex,
        `${meta.labelFr} (ligne ${groupIndex + 1})`,
        row,
      );
    }),
  );

  return (
    <>
      <div className="mx-auto max-w-2xl px-4 pt-4">
        <DocumentActions documentId={document.id} canRetry={false} />
      </div>
      <ReviewScreen
        documentId={document.id}
        imageWidth={document.storedImageWidth}
        imageHeight={document.storedImageHeight}
        fields={[...scalarFields, ...tvaFields]}
        arithmeticOk={currentAttempt?.arithmeticOk ?? null}
      />
    </>
  );
}
