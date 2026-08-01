import { notFound } from "next/navigation";
import { prisma } from "@mou7asib/db";
import invoiceFields from "@mou7asib/contracts/invoice-fields.json";
import { DEMO_TENANT_ID } from "@/lib/tenant";
import { LOW_CONFIDENCE_THRESHOLD } from "@/lib/confidence";
import { parseBoundingBox } from "@/lib/boundingBox";
import ProcessingStatus from "./ProcessingStatus";
import ReviewScreen, { type ReviewField } from "./ReviewScreen";

export const dynamic = "force-dynamic";

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // CLAUDE.md §10 — never leak server data into client props: select
  // explicitly, never pass a whole Prisma record onward.
  const document = await prisma.document.findFirst({
    where: { id, tenantId: DEMO_TENANT_ID },
    select: {
      id: true,
      status: true,
      storedImageWidth: true,
      storedImageHeight: true,
      currentAttemptId: true,
    },
  });

  if (!document) {
    notFound();
  }

  if (document.status !== "extracted" && document.status !== "failed") {
    return <ProcessingStatus documentId={document.id} initialStatus={document.status} />;
  }

  if (document.status === "failed") {
    return (
      <main className="mx-auto max-w-md p-6">
        <h1 className="text-xl font-semibold">Extraction impossible</h1>
        <p className="mt-2 text-sm text-slate-600">
          L&apos;extraction a échoué après plusieurs tentatives. Une saisie
          manuelle est nécessaire.
        </p>
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
            confidence: true,
            boundingBox: true,
          },
        });
  const scalarByName = new Map(
    extractedFields
      .filter((field) => field.groupName === null)
      .map((field) => [field.fieldName, field]),
  );

  const scalarFields: ReviewField[] = invoiceFields.scalarFields.map((meta) => {
    const row = scalarByName.get(meta.name);
    if (row === undefined) {
      return {
        key: meta.name,
        label: meta.labelFr,
        displayValue: null,
        confidence: null,
        boundingBox: null,
        isLowConfidence: false,
      };
    }
    // Prisma.Decimal has its own .toFixed — never convert through a JS
    // number first (CLAUDE.md §6).
    const displayValue = row.valueDecimal !== null ? row.valueDecimal.toFixed(2) : row.valueText;
    return {
      key: meta.name,
      label: meta.labelFr,
      displayValue,
      confidence: row.confidence,
      boundingBox: parseBoundingBox(row.boundingBox),
      isLowConfidence: row.confidence < LOW_CONFIDENCE_THRESHOLD,
    };
  });

  const tvaRows = extractedFields.filter((field) => field.groupName === "tva_lines");
  const tvaGroupIndices = [...new Set(tvaRows.map((row) => row.groupIndex))]
    .filter((index): index is number => index !== null)
    .sort((a, b) => a - b);

  const tvaFields: ReviewField[] = tvaGroupIndices.flatMap((groupIndex) =>
    invoiceFields.groupFields.tva_lines.map((meta) => {
      const row = tvaRows.find(
        (candidate) => candidate.groupIndex === groupIndex && candidate.fieldName === meta.name,
      );
      const key = `tva_lines[${groupIndex}].${meta.name}`;
      const label = `${meta.labelFr} (ligne ${groupIndex + 1})`;
      if (row === undefined) {
        return {
          key,
          label,
          displayValue: null,
          confidence: null,
          boundingBox: null,
          isLowConfidence: false,
        };
      }
      const displayValue = row.valueDecimal !== null ? row.valueDecimal.toFixed(2) : row.valueText;
      return {
        key,
        label,
        displayValue,
        confidence: row.confidence,
        boundingBox: parseBoundingBox(row.boundingBox),
        isLowConfidence: row.confidence < LOW_CONFIDENCE_THRESHOLD,
      };
    }),
  );

  return (
    <ReviewScreen
      imageUrl={`/api/documents/${document.id}/image`}
      imageWidth={document.storedImageWidth}
      imageHeight={document.storedImageHeight}
      fields={[...scalarFields, ...tvaFields]}
      arithmeticOk={currentAttempt?.arithmeticOk ?? null}
    />
  );
}
