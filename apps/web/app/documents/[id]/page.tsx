import { notFound } from "next/navigation";
import { Prisma, prisma, withTenant } from "@mou7asib/db";
import { Decimal as AccountingDecimal, resolveCashThreshold } from "@mou7asib/accounting";
import invoiceFields from "@mou7asib/contracts/invoice-fields.json";
import { visibleDocumentWhere } from "@/lib/documents";
import { requireSession } from "@/lib/auth";
import { LOW_CONFIDENCE_THRESHOLD } from "@/lib/confidence";
import { parseBoundingBox } from "@/lib/boundingBox";
import { deleteDocument } from "@/app/actions/deleteDocument";
import { retryDocument } from "@/app/actions/retryDocument";
import { findPostingSuggestion } from "@/lib/postingSuggestion";
import { buildTvaBreakdown, type RawTvaLine } from "@/lib/tvaResolution";
import ProcessingStatus from "./ProcessingStatus";
import ReviewScreen, { type ReviewField } from "./ReviewScreen";
import type { PostedEntrySummary, PostingSuggestionSummary } from "./PostingPanel";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("fr-MA", { dateStyle: "medium", timeZone: "Africa/Casablanca" });

function DocumentActions({ documentId, canRetry }: { documentId: string; canRetry: boolean }) {
  const boundDelete = deleteDocument.bind(null, documentId);
  const boundRetry = retryDocument.bind(null, documentId);
  return (
    <div className="flex gap-2">
      {canRetry && (
        <form action={boundRetry}>
          <button type="submit" className="rounded-lg border border-border-2 px-3 py-1.5 text-xs font-medium text-fg">
            Réessayer
          </button>
        </form>
      )}
      <form action={boundDelete}>
        <button type="submit" className="rounded-lg border border-neg/30 px-3 py-1.5 text-xs font-medium text-neg">
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
  const session = await requireSession();
  const { id } = await params;

  // CLAUDE.md §10 — never leak server data into client props: select
  // explicitly, never pass a whole Prisma record onward.
  const document = await withTenant(session.tenantId, (tx) =>
    tx.document.findFirst({
      where: { id, ...visibleDocumentWhere(session.tenantId) },
      select: {
        id: true,
        status: true,
        storedImageWidth: true,
        storedImageHeight: true,
        currentAttemptId: true,
        uploadedAt: true,
      },
    }),
  );

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
      <main className="mx-auto max-w-md rounded-xl border border-border bg-surface p-6 shadow-card">
        <h1 className="m-0 text-xl font-semibold text-fg">Extraction impossible</h1>
        <p className="mt-2 text-sm text-fg-2">
          L&apos;extraction a échoué après plusieurs tentatives. Une saisie
          manuelle est nécessaire.
        </p>
        <div className="mt-4">
          <DocumentActions documentId={document.id} canRetry={true} />
        </div>
      </main>
    );
  }

  const { currentAttempt, extractedFields, accounts, postedEntry } = await withTenant(session.tenantId, async (tx) => {
    const attempt =
      document.currentAttemptId === null
        ? null
        : await tx.extractionAttempt.findUnique({
            where: { id: document.currentAttemptId },
            select: { arithmeticOk: true },
          });

    const fields =
      document.currentAttemptId === null
        ? []
        : await tx.extractedField.findMany({
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

    const accountRows = await tx.account.findMany({
      where: { tenantId: session.tenantId },
      select: { code: true, label: true },
      orderBy: { code: "asc" },
    });

    const linkedEntry = await tx.journalEntry.findUnique({
      where: { sourceDocumentId: document.id },
      select: { status: true, date: true, journalCode: true, label: true },
    });

    return {
      currentAttempt: attempt,
      extractedFields: fields,
      accounts: accountRows,
      postedEntry:
        linkedEntry === null
          ? null
          : ({
              status: linkedEntry.status,
              date: dateFormatter.format(linkedEntry.date),
              journalCode: linkedEntry.journalCode,
              label: linkedEntry.label,
            } satisfies PostedEntrySummary),
    };
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

  const displayValueFor = (fieldName: string): string | null =>
    scalarFields.find((field) => field.fieldName === fieldName)?.displayValue ?? null;

  const rawInvoiceDate = displayValueFor("invoice_date");
  const parsedInvoiceDate = rawInvoiceDate !== null ? new Date(rawInvoiceDate) : null;
  const postingDefaultDate =
    parsedInvoiceDate !== null && !Number.isNaN(parsedInvoiceDate.getTime())
      ? parsedInvoiceDate.toISOString().slice(0, 10)
      : null;
  const supplierName = displayValueFor("supplier_name");
  const invoiceNumber = displayValueFor("invoice_number");
  const postingDefaultLabel = [supplierName, invoiceNumber].filter((v) => v !== null).join(" — ") || "Facture";

  // Second round trip: needs supplierName, which only exists once extractedFields (fetched
  // above) are parsed — see lib/postingSuggestion.ts for why this is a plain tenant-scoped
  // query over the tenant's own posted history, not a model call.
  const suggestion = await withTenant(session.tenantId, (tx) =>
    findPostingSuggestion(tx, session.tenantId, document.id, supplierName),
  );
  const postingSuggestion: PostingSuggestionSummary | null =
    suggestion === null
      ? null
      : {
          supplierName: suggestion.supplierName,
          matchCount: suggestion.matchCount,
          earliestDate: dateFormatter.format(suggestion.earliestDate),
          debitAccount: suggestion.debitAccount,
          creditAccount: suggestion.creditAccount,
        };

  // TvaRate/TvaCashThreshold are global reference data (CLAUDE.md §5.1's "shared, never
  // mutated per tenant" — the same status as ReferenceAccount), not tenant-owned, so no
  // RLS/withTenant here — same as any other lookup against reference_accounts.
  const tvaDate = parsedInvoiceDate !== null && !Number.isNaN(parsedInvoiceDate.getTime()) ? parsedInvoiceDate : new Date();
  const [tenant, tvaRateRows, cashThresholdRows] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: session.tenantId }, select: { tvaRegime: true } }),
    prisma.tvaRate.findMany({ select: { rateCode: true, rate: true, effectiveFrom: true, effectiveTo: true } }),
    prisma.tvaCashThreshold.findMany({ select: { thresholdAmount: true, effectiveFrom: true, effectiveTo: true } }),
  ]);

  const rawDecimalFor = (fieldName: string, groupIndex: number): InstanceType<typeof AccountingDecimal> | null => {
    const row = tvaRows.find((r) => r.fieldName === fieldName && r.groupIndex === groupIndex);
    if (row === undefined) return null;
    const value = row.correctedAt !== null ? (row.overrideValueDecimal ?? row.valueDecimal) : row.valueDecimal;
    return value === null ? null : new AccountingDecimal(value.toString());
  };
  const rawTvaLines: RawTvaLine[] = tvaGroupIndices.map((groupIndex) => ({
    groupIndex,
    ratePercent: rawDecimalFor("rate", groupIndex),
    baseHt: rawDecimalFor("base_ht", groupIndex),
  }));
  const tvaBreakdown = buildTvaBreakdown(
    rawTvaLines,
    tvaRateRows.map((r) => ({ rateCode: r.rateCode, rate: new AccountingDecimal(r.rate.toString()), effectiveFrom: r.effectiveFrom, effectiveTo: r.effectiveTo })),
    tvaDate,
  );
  const cashThreshold = resolveCashThreshold(
    cashThresholdRows.map((c) => ({
      thresholdAmount: new AccountingDecimal(c.thresholdAmount.toString()),
      effectiveFrom: c.effectiveFrom,
      effectiveTo: c.effectiveTo,
    })),
    tvaDate,
  );

  return (
    <>
      <div className="mx-auto max-w-5xl px-4 pt-4">
        <DocumentActions documentId={document.id} canRetry={false} />
      </div>
      <div className="px-4 pb-4">
        <ReviewScreen
          documentId={document.id}
          imageWidth={document.storedImageWidth}
          imageHeight={document.storedImageHeight}
          fields={[...scalarFields, ...tvaFields]}
          arithmeticOk={currentAttempt?.arithmeticOk ?? null}
          accounts={accounts}
          postedEntry={postedEntry}
          suggestion={postingSuggestion}
          tvaBreakdown={tvaBreakdown}
          tvaRegime={tenant?.tvaRegime ?? null}
          cashThreshold={cashThreshold === null ? null : cashThreshold.toFixed(2)}
          postingDefaults={{
            date: postingDefaultDate,
            label: postingDefaultLabel,
            amount: displayValueFor("total_ttc"),
          }}
        />
      </div>
    </>
  );
}
