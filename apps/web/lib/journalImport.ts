import {
  assertValidEntry,
  Decimal as AccountingDecimal,
  InvalidLineError,
  UnbalancedEntryError,
  type JournalLineInput,
  type Money,
} from "@mou7asib/accounting";
import { parseCsv, type ParsedCsv } from "./csv";

// CSV only for now — Excel (.xlsx) needs a binary-format parsing dependency, which
// CLAUDE.md §4 says to add deliberately and call out, not slip in; deferred rather than
// pulled in silently to hit build-order.md S4's "CSV/Excel" scope. Flagged in the phase
// summary and in build-order.md.

export type CanonicalField =
  | "entryRef"
  | "date"
  | "journalCode"
  | "entryLabel"
  | "accountCode"
  | "lineLabel"
  | "debit"
  | "credit";

export const CANONICAL_FIELDS: ReadonlyArray<{ value: CanonicalField; label: string; required: boolean }> = [
  { value: "entryRef", label: "Référence de pièce (regroupe les lignes d'une écriture)", required: true },
  { value: "date", label: "Date", required: true },
  { value: "accountCode", label: "Compte", required: true },
  { value: "debit", label: "Débit", required: true },
  { value: "credit", label: "Crédit", required: true },
  { value: "journalCode", label: "Code journal", required: false },
  { value: "entryLabel", label: "Libellé de l'écriture", required: false },
  { value: "lineLabel", label: "Libellé de la ligne", required: false },
];

export type MappingValue = CanonicalField | "ignore";
export type ColumnMapping = Record<string, MappingValue>;

function isCanonicalField(value: string): value is CanonicalField {
  return CANONICAL_FIELDS.some((f) => f.value === value);
}

/** Reads `map_<header>` fields off a submitted FormData into a validated mapping. */
export function readMappingFromFormData(formData: FormData, headers: readonly string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  for (const header of headers) {
    const raw = formData.get(`map_${header}`);
    mapping[header] = typeof raw === "string" && isCanonicalField(raw) ? raw : "ignore";
  }
  return mapping;
}

function columnIndexFor(headers: readonly string[], mapping: ColumnMapping, field: CanonicalField): number | undefined {
  const header = headers.find((h) => mapping[h] === field);
  return header === undefined ? undefined : headers.indexOf(header);
}

export interface ImportEntryGroup {
  entryRef: string;
  date: Date;
  journalCode: string;
  label: string;
  lines: JournalLineInput[];
  total: Money;
}

export interface ImportIssue {
  /** 1-based, counting the header row as row 1 — matches what a spreadsheet shows. */
  rowNumber: number | null;
  message: string;
}

export interface ImportParseResult {
  totalDataRows: number;
  groups: ImportEntryGroup[];
  issues: ImportIssue[];
  mappingComplete: boolean;
}

const REQUIRED_FIELDS: readonly CanonicalField[] = ["entryRef", "date", "accountCode"];

/**
 * Groups CSV rows into balanced journal entries by their mapped entryRef column, running
 * each group through the same assertValidEntry() the manual-entry and reversal actions use
 * (packages/accounting) — an imported entry is held to exactly the same balance/shape rules
 * as a hand-typed one, not a relaxed variant.
 */
export function buildImportGroups(parsed: ParsedCsv, mapping: ColumnMapping): ImportParseResult {
  const entryRefCol = columnIndexFor(parsed.headers, mapping, "entryRef");
  const dateCol = columnIndexFor(parsed.headers, mapping, "date");
  const accountCol = columnIndexFor(parsed.headers, mapping, "accountCode");
  const debitCol = columnIndexFor(parsed.headers, mapping, "debit");
  const creditCol = columnIndexFor(parsed.headers, mapping, "credit");
  const journalCodeCol = columnIndexFor(parsed.headers, mapping, "journalCode");
  const entryLabelCol = columnIndexFor(parsed.headers, mapping, "entryLabel");
  const lineLabelCol = columnIndexFor(parsed.headers, mapping, "lineLabel");

  const mappingComplete =
    entryRefCol !== undefined && dateCol !== undefined && accountCol !== undefined && (debitCol !== undefined || creditCol !== undefined);

  if (!mappingComplete) {
    return {
      totalDataRows: parsed.rows.length,
      groups: [],
      issues: [
        {
          rowNumber: null,
          message:
            "Mapping incomplet : référence de pièce, date, compte, et débit ou crédit doivent être associés à une colonne.",
        },
      ],
      mappingComplete: false,
    };
  }

  const cell = (row: readonly string[], col: number | undefined): string => (col === undefined ? "" : (row[col] ?? "").trim());

  interface Draft {
    entryRef: string;
    date: Date | undefined;
    journalCode: string;
    label: string;
    lines: JournalLineInput[];
  }

  const drafts = new Map<string, Draft>();
  const order: string[] = [];
  const issues: ImportIssue[] = [];

  parsed.rows.forEach((row, i) => {
    const rowNumber = i + 2;
    if (row.every((c) => c.trim().length === 0)) {
      return;
    }
    const entryRef = cell(row, entryRefCol);
    const accountCode = cell(row, accountCol);
    if (entryRef.length === 0 || accountCode.length === 0) {
      issues.push({ rowNumber, message: "référence de pièce et compte sont obligatoires" });
      return;
    }

    const dateRaw = cell(row, dateCol);
    let date: Date | undefined;
    if (dateRaw.length > 0) {
      const parsed2 = new Date(dateRaw);
      if (Number.isNaN(parsed2.getTime())) {
        issues.push({ rowNumber, message: `date invalide : "${dateRaw}"` });
        return;
      }
      date = parsed2;
    }

    const debitRaw = cell(row, debitCol);
    const creditRaw = cell(row, creditCol);
    let debit: Money;
    let credit: Money;
    try {
      debit = new AccountingDecimal((debitRaw || "0").replace(",", "."));
      credit = new AccountingDecimal((creditRaw || "0").replace(",", "."));
    } catch {
      issues.push({ rowNumber, message: `montant invalide (débit="${debitRaw}", crédit="${creditRaw}")` });
      return;
    }

    const lineLabelRaw = cell(row, lineLabelCol);
    let draft = drafts.get(entryRef);
    if (draft === undefined) {
      const journalCodeRaw = cell(row, journalCodeCol);
      const entryLabelRaw = cell(row, entryLabelCol);
      draft = {
        entryRef,
        date,
        journalCode: journalCodeRaw.length > 0 ? journalCodeRaw : "OD",
        label: entryLabelRaw.length > 0 ? entryLabelRaw : `Import ${entryRef}`,
        lines: [],
      };
      drafts.set(entryRef, draft);
      order.push(entryRef);
    } else if (draft.date === undefined && date !== undefined) {
      draft.date = date;
    }
    draft.lines.push({ accountCode, debit, credit, label: lineLabelRaw.length > 0 ? lineLabelRaw : undefined });
  });

  const groups: ImportEntryGroup[] = [];
  for (const entryRef of order) {
    const draft = drafts.get(entryRef);
    if (draft === undefined) {
      continue;
    }
    if (draft.date === undefined) {
      issues.push({ rowNumber: null, message: `écriture "${entryRef}" : aucune date sur ses lignes` });
      continue;
    }
    try {
      assertValidEntry({ date: draft.date, journalCode: draft.journalCode, label: draft.label, lines: draft.lines });
    } catch (error) {
      const message =
        error instanceof InvalidLineError || error instanceof UnbalancedEntryError
          ? error.message
          : "écriture invalide";
      issues.push({ rowNumber: null, message: `écriture "${entryRef}" : ${message}` });
      continue;
    }
    const total = draft.lines.reduce((acc, line) => acc.plus(line.debit), new AccountingDecimal(0));
    groups.push({ entryRef, date: draft.date, journalCode: draft.journalCode, label: draft.label, lines: draft.lines, total });
  }

  return { totalDataRows: parsed.rows.length, groups, issues, mappingComplete: true };
}

export function parseAndGroupCsv(csvText: string, mapping: ColumnMapping): { parsed: ParsedCsv; result: ImportParseResult } {
  const parsed = parseCsv(csvText);
  return { parsed, result: buildImportGroups(parsed, mapping) };
}

export const REQUIRED_CANONICAL_FIELDS = REQUIRED_FIELDS;
