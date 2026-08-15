"use server";

import crypto from "node:crypto";
import { Prisma, withTenant } from "@mou7asib/db";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/policy";
import { findOrCreatePeriod } from "@/lib/ledger";
import {
  buildImportGroups,
  readMappingFromFormData,
  type CanonicalField,
  type ColumnMapping,
  type ImportEntryGroup,
  type ImportIssue,
} from "@/lib/journalImport";
import { parseCsv } from "@/lib/csv";

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

interface GroupSummary {
  entryRef: string;
  date: string;
  journalCode: string;
  label: string;
  lineCount: number;
  total: string;
}

function summarizeGroups(groups: readonly ImportEntryGroup[]): GroupSummary[] {
  return groups.map((g) => ({
    entryRef: g.entryRef,
    date: g.date.toISOString().slice(0, 10),
    journalCode: g.journalCode,
    label: g.label,
    lineCount: g.lines.length,
    total: g.total.toString(),
  }));
}

// Cheap keyword heuristic to pre-fill the mapping selects on first upload — never trusted
// as-is, always shown to the user for confirmation before anything is parsed for real
// (CLAUDE.md §7.3's spirit applies here too: a column header is untrusted input, treated
// as a hint, not as an instruction).
function guessMapping(headers: readonly string[]): ColumnMapping {
  const guess = (header: string): CanonicalField | "ignore" => {
    const h = header.toLowerCase();
    if (h.includes("pièce") || h.includes("piece") || h.includes("référence") || h.includes("reference") || h === "ref") {
      return "entryRef";
    }
    if (h.includes("date")) return "date";
    if (h.includes("compte") || h.includes("account")) return "accountCode";
    if (h.includes("débit") || h.includes("debit")) return "debit";
    if (h.includes("crédit") || h.includes("credit")) return "credit";
    if (h.includes("journal")) return "journalCode";
    if (h.includes("libell")) return "entryLabel";
    return "ignore";
  };
  const mapping: ColumnMapping = {};
  for (const header of headers) {
    mapping[header] = guess(header);
  }
  return mapping;
}

export type ImportPreviewState =
  | null
  | { error: string }
  | {
      headers: string[];
      mapping: ColumnMapping;
      totalDataRows: number;
      entryCount: number;
      groups: GroupSummary[];
      issues: ImportIssue[];
      mappingComplete: boolean;
    };

export async function previewJournalImport(_prevState: ImportPreviewState, formData: FormData): Promise<ImportPreviewState> {
  const session = await requireSession();
  if (!can(session.role, "ledger:write")) {
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
    return { error: "Seul le format CSV est pris en charge pour l'instant (Excel arrive dans une phase ultérieure)." };
  }

  const text = await file.text();
  const parsed = parseCsv(text);
  if (parsed.headers.length === 0) {
    return { error: "Fichier CSV vide ou illisible." };
  }

  const hasExplicitMapping = parsed.headers.some((h) => formData.has(`map_${h}`));
  const mapping = hasExplicitMapping ? readMappingFromFormData(formData, parsed.headers) : guessMapping(parsed.headers);

  const result = buildImportGroups(parsed, mapping);
  return {
    headers: parsed.headers,
    mapping,
    totalDataRows: result.totalDataRows,
    entryCount: result.groups.length,
    groups: summarizeGroups(result.groups),
    issues: result.issues,
    mappingComplete: result.mappingComplete,
  };
}

export type ImportConfirmState =
  | null
  | { error: string }
  | { alreadyImported: true; importId: string; entryCount: number }
  | { alreadyImported: false; importId: string; entryCount: number; rowCount: number };

export async function confirmJournalImport(_prevState: ImportConfirmState, formData: FormData): Promise<ImportConfirmState> {
  const session = await requireSession();
  if (!can(session.role, "ledger:write")) {
    return { error: "Action non autorisée pour ce rôle." };
  }

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
  const result = buildImportGroups(parsed, mapping);

  if (!result.mappingComplete) {
    return { error: "Mapping incomplet — retournez à l'aperçu et associez toutes les colonnes obligatoires." };
  }
  if (result.issues.length > 0) {
    return {
      error: `${result.issues.length} ligne(s) ou écriture(s) invalide(s) — corrigez le fichier ou le mapping avant d'importer (rien n'a été importé).`,
    };
  }
  if (result.groups.length === 0) {
    return { error: "Aucune écriture valide à importer." };
  }

  const contentHash = crypto.createHash("sha256").update(bytes).digest("hex");

  const outcome = await withTenant(session.tenantId, async (tx) => {
    const existing = await tx.journalImport.findUnique({
      where: { tenantId_contentHash: { tenantId: session.tenantId, contentHash } },
      select: { id: true, entryCount: true },
    });
    if (existing !== null) {
      return { alreadyImported: true as const, importId: existing.id, entryCount: existing.entryCount };
    }

    const allCodes = new Set(result.groups.flatMap((g) => g.lines.map((l) => l.accountCode)));
    const accounts = await tx.account.findMany({
      where: { tenantId: session.tenantId, code: { in: Array.from(allCodes) } },
      select: { id: true, code: true },
    });
    const accountIdByCode = new Map(accounts.map((a) => [a.code, a.id]));
    const unknownCodes = Array.from(allCodes).filter((code) => !accountIdByCode.has(code));
    if (unknownCodes.length > 0) {
      throw new Error(`Compte(s) inconnu(s) dans le plan comptable du tenant : ${unknownCodes.join(", ")}`);
    }

    // Whole file imports atomically: a locked period anywhere in the file aborts the
    // entire import (the surrounding $transaction rolls back on throw) rather than
    // leaving a partially-imported ledger.
    for (const group of result.groups) {
      const period = await findOrCreatePeriod(tx, session.tenantId, group.date);
      if (period.status === "locked") {
        throw new Error(
          `La période couvrant l'écriture "${group.entryRef}" (${group.date.toISOString().slice(0, 10)}) est verrouillée — import annulé, rien n'a été enregistré.`,
        );
      }

      // journal_lines' immutability trigger fires on INSERT too (not just UPDATE/DELETE —
      // see the phase2 migration), so lines can only be inserted while the entry is still
      // a draft. Same create-draft -> add-lines -> flip-to-posted order as
      // createJournalEntry.ts + postJournalEntry.ts, just done in one transaction here
      // instead of two separate actions.
      const entry = await tx.journalEntry.create({
        data: { tenantId: session.tenantId, date: group.date, journalCode: group.journalCode, label: group.label, status: "draft" },
      });

      let lineOrder = 0;
      for (const line of group.lines) {
        const accountId = accountIdByCode.get(line.accountCode);
        if (accountId === undefined) {
          throw new Error(`Compte inconnu : ${line.accountCode}`);
        }
        await tx.journalLine.create({
          data: {
            tenantId: session.tenantId,
            entryId: entry.id,
            accountId,
            debit: new Prisma.Decimal(line.debit.toString()),
            credit: new Prisma.Decimal(line.credit.toString()),
            label: line.label ?? null,
            lineOrder,
          },
        });
        lineOrder += 1;
      }

      await tx.journalEntry.update({
        where: { id: entry.id },
        data: { status: "posted", periodId: period.id, postedAt: new Date() },
      });
    }

    const importRow = await tx.journalImport.create({
      data: {
        tenantId: session.tenantId,
        filename: file.name,
        contentHash,
        mapping: mapping as Prisma.InputJsonValue,
        rowCount: result.totalDataRows,
        entryCount: result.groups.length,
        createdById: session.userId,
      },
    });

    return { alreadyImported: false as const, importId: importRow.id, entryCount: result.groups.length, rowCount: result.totalDataRows };
  });

  return outcome;
}
