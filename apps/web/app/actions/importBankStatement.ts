"use server";

import crypto from "node:crypto";
import { Prisma, withTenant } from "@mou7asib/db";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/policy";
import { parseCsv } from "@/lib/csv";
import { buildTransactions, readMappingFromFormData, type ColumnMapping, type ParsedTransaction } from "@/lib/bankStatement";

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

function sourceHashFor(bankAccountCode: string, txn: ParsedTransaction): string {
  const normalized = [
    bankAccountCode,
    txn.date.toISOString().slice(0, 10),
    txn.label.trim().toLowerCase(),
    txn.amount.toFixed(2),
    txn.externalId?.trim() ?? "",
  ].join("|");
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

interface TxnSummary {
  date: string;
  label: string;
  amount: string;
}

export type ImportPreviewState =
  | null
  | { error: string }
  | {
      headers: string[];
      mapping: Record<string, string>;
      totalDataRows: number;
      transactionCount: number;
      transactions: TxnSummary[];
      issues: { rowNumber: number; message: string }[];
      mappingComplete: boolean;
    };

function guessMapping(headers: readonly string[]): ColumnMapping {
  const guess = (header: string): ColumnMapping[string] => {
    const h = header.toLowerCase();
    if (h.includes("date")) return "date";
    if (h.includes("libell") || h.includes("label") || h.includes("desc")) return "label";
    if (h.includes("débit") || h.includes("debit")) return "debit";
    if (h.includes("crédit") || h.includes("credit")) return "credit";
    if (h.includes("montant") || h.includes("amount")) return "amount";
    if (h.includes("réf") || h.includes("ref")) return "externalId";
    return "ignore";
  };
  const mapping: ColumnMapping = {};
  for (const header of headers) {
    mapping[header] = guess(header);
  }
  return mapping;
}

export async function previewBankStatement(_prevState: ImportPreviewState, formData: FormData): Promise<ImportPreviewState> {
  const session = await requireSession();
  if (!can(session.role, "bank:reconcile")) {
    return { error: "Action non autorisée pour ce rôle." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Fichier CSV requis." };
  }
  if (file.size > MAX_IMPORT_BYTES) {
    return { error: "Fichier trop volumineux (5 Mo max)." };
  }
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return { error: "Seul le format CSV est pris en charge pour l'instant (MT940/CAMT.053 arrivent plus tard)." };
  }

  const text = await file.text();
  const parsed = parseCsv(text);
  if (parsed.headers.length === 0) {
    return { error: "Fichier CSV vide ou illisible." };
  }

  const hasExplicitMapping = parsed.headers.some((h) => formData.has(`map_${h}`));
  const mapping = hasExplicitMapping ? readMappingFromFormData(formData, parsed.headers) : guessMapping(parsed.headers);

  const result = buildTransactions(parsed, mapping);
  return {
    headers: parsed.headers,
    mapping,
    totalDataRows: result.totalDataRows,
    transactionCount: result.transactions.length,
    transactions: result.transactions
      .slice(0, 50)
      .map((t) => ({ date: t.date.toISOString().slice(0, 10), label: t.label, amount: t.amount.toFixed(2) })),
    issues: result.issues,
    mappingComplete: result.mappingComplete,
  };
}

export type ImportConfirmState =
  | null
  | { error: string }
  | { importId: string; importedCount: number; skippedCount: number; rowCount: number };

export async function confirmBankStatement(_prevState: ImportConfirmState, formData: FormData): Promise<ImportConfirmState> {
  const session = await requireSession();
  if (!can(session.role, "bank:reconcile")) {
    return { error: "Action non autorisée pour ce rôle." };
  }

  const bankAccountCodeField = formData.get("bankAccountCode");
  if (typeof bankAccountCodeField !== "string" || bankAccountCodeField.trim().length === 0) {
    return { error: "Compte bancaire requis." };
  }
  const bankAccountCode = bankAccountCodeField.trim();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Fichier CSV requis." };
  }
  if (file.size > MAX_IMPORT_BYTES) {
    return { error: "Fichier trop volumineux (5 Mo max)." };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const parsed = parseCsv(bytes.toString("utf-8"));
  if (parsed.headers.length === 0) {
    return { error: "Fichier CSV vide ou illisible." };
  }
  const mapping = readMappingFromFormData(formData, parsed.headers);
  const result = buildTransactions(parsed, mapping);

  if (!result.mappingComplete) {
    return { error: "Mapping incomplet — retournez à l'aperçu et associez toutes les colonnes obligatoires." };
  }
  if (result.issues.length > 0) {
    return {
      error: `${result.issues.length} ligne(s) invalide(s) — corrigez le fichier ou le mapping avant d'importer (rien n'a été importé).`,
    };
  }
  if (result.transactions.length === 0) {
    return { error: "Aucune transaction valide à importer." };
  }

  const outcome = await withTenant(session.tenantId, async (tx) => {
    const account = await tx.account.findUnique({
      where: { tenantId_code: { tenantId: session.tenantId, code: bankAccountCode } },
      select: { code: true },
    });
    if (account === null) {
      throw new Error(`Compte inconnu : ${bankAccountCode}`);
    }

    const importRow = await tx.bankStatementImport.create({
      data: {
        tenantId: session.tenantId,
        bankAccountCode,
        filename: file.name,
        mapping: mapping as Prisma.InputJsonValue,
        rowCount: result.totalDataRows,
        importedCount: 0,
        skippedCount: 0,
        createdById: session.userId,
      },
    });

    const created = await tx.bankTransaction.createMany({
      data: result.transactions.map((t) => ({
        tenantId: session.tenantId,
        importId: importRow.id,
        bankAccountCode,
        valueDate: t.date,
        label: t.label,
        amount: new Prisma.Decimal(t.amount.toString()),
        sourceHash: sourceHashFor(bankAccountCode, t),
      })),
      skipDuplicates: true,
    });

    const importedCount = created.count;
    const skippedCount = result.transactions.length - importedCount;
    await tx.bankStatementImport.update({
      where: { id: importRow.id },
      data: { importedCount, skippedCount },
    });

    return { importId: importRow.id, importedCount, skippedCount, rowCount: result.totalDataRows };
  });

  return outcome;
}
