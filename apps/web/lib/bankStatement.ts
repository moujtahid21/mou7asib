import { Decimal as AccountingDecimal, type Money } from "@mou7asib/accounting";
import { parseCsv, type ParsedCsv } from "./csv";

// CSV only for v1 (ADR 0003 recommends MT940/CAMT.053 as the real target, but those need
// sample files from actual Moroccan banks as test fixtures — CLAUDE.md §12 requires real
// fixtures, and none exist yet. CSV is the documented fallback, not silently substituted
// scope — see build-order.md.

export type CanonicalField = "date" | "label" | "amount" | "debit" | "credit" | "externalId";

export const CANONICAL_FIELDS: ReadonlyArray<{ value: CanonicalField; label: string; required: boolean }> = [
  { value: "date", label: "Date de valeur", required: true },
  { value: "label", label: "Libellé", required: true },
  { value: "amount", label: "Montant (signé : + entrée, - sortie)", required: false },
  { value: "debit", label: "Débit (sortie — colonne séparée)", required: false },
  { value: "credit", label: "Crédit (entrée — colonne séparée)", required: false },
  { value: "externalId", label: "Référence bancaire (si disponible)", required: false },
];

export type MappingValue = CanonicalField | "ignore";
export type ColumnMapping = Record<string, MappingValue>;

function isCanonicalField(value: string): value is CanonicalField {
  return CANONICAL_FIELDS.some((f) => f.value === value);
}

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

export interface ParsedTransaction {
  date: Date;
  label: string;
  /** Signed: positive = money in, negative = money out. */
  amount: Money;
  externalId: string | undefined;
}

export interface ImportIssue {
  rowNumber: number;
  message: string;
}

export interface ParseResult {
  totalDataRows: number;
  transactions: ParsedTransaction[];
  issues: ImportIssue[];
  mappingComplete: boolean;
}

/** Parses and validates rows — never grouped (unlike journalImport.ts), each CSV row is
 * independently one bank transaction. */
export function buildTransactions(parsed: ParsedCsv, mapping: ColumnMapping): ParseResult {
  const dateCol = columnIndexFor(parsed.headers, mapping, "date");
  const labelCol = columnIndexFor(parsed.headers, mapping, "label");
  const amountCol = columnIndexFor(parsed.headers, mapping, "amount");
  const debitCol = columnIndexFor(parsed.headers, mapping, "debit");
  const creditCol = columnIndexFor(parsed.headers, mapping, "credit");
  const externalIdCol = columnIndexFor(parsed.headers, mapping, "externalId");

  const hasAmountShape = amountCol !== undefined || debitCol !== undefined || creditCol !== undefined;
  const mappingComplete = dateCol !== undefined && labelCol !== undefined && hasAmountShape;

  if (!mappingComplete) {
    return {
      totalDataRows: parsed.rows.length,
      transactions: [],
      issues: [
        {
          rowNumber: 0,
          message:
            "Mapping incomplet : date, libellé, et (montant signé) ou (débit/crédit) doivent être associés à une colonne.",
        },
      ],
      mappingComplete: false,
    };
  }

  const cell = (row: readonly string[], col: number | undefined): string => (col === undefined ? "" : (row[col] ?? "").trim());

  const issues: ImportIssue[] = [];
  const transactions: ParsedTransaction[] = [];

  parsed.rows.forEach((row, i) => {
    const rowNumber = i + 2;
    if (row.every((c) => c.trim().length === 0)) {
      return;
    }
    const dateRaw = cell(row, dateCol);
    const label = cell(row, labelCol);
    if (dateRaw.length === 0 || label.length === 0) {
      issues.push({ rowNumber, message: "date et libellé sont obligatoires" });
      return;
    }
    const date = new Date(dateRaw);
    if (Number.isNaN(date.getTime())) {
      issues.push({ rowNumber, message: `date invalide : "${dateRaw}"` });
      return;
    }

    let amount: Money;
    try {
      if (amountCol !== undefined) {
        const raw = cell(row, amountCol);
        if (raw.length === 0) {
          issues.push({ rowNumber, message: "montant manquant" });
          return;
        }
        amount = new AccountingDecimal(raw.replace(",", "."));
      } else {
        const debitRaw = cell(row, debitCol) || "0";
        const creditRaw = cell(row, creditCol) || "0";
        const debit = new AccountingDecimal(debitRaw.replace(",", "."));
        const credit = new AccountingDecimal(creditRaw.replace(",", "."));
        // Bank-statement convention, not ledger convention: "Crédit" is money added to the
        // account (incoming), "Débit" is money removed (outgoing) — the opposite of a
        // double-entry asset account, where a debit increases the balance. Flipping this
        // by treating it as ledger debit/credit was caught by this file's own test.
        amount = credit.minus(debit);
      }
    } catch {
      issues.push({ rowNumber, message: "montant invalide" });
      return;
    }
    if (amount.isZero()) {
      issues.push({ rowNumber, message: "montant nul — ni entrée ni sortie" });
      return;
    }

    const externalIdRaw = cell(row, externalIdCol);
    transactions.push({
      date,
      label,
      amount,
      externalId: externalIdRaw.length > 0 ? externalIdRaw : undefined,
    });
  });

  return { totalDataRows: parsed.rows.length, transactions, issues, mappingComplete: true };
}

export function parseAndBuildTransactions(csvText: string, mapping: ColumnMapping): { parsed: ParsedCsv; result: ParseResult } {
  const parsed = parseCsv(csvText);
  return { parsed, result: buildTransactions(parsed, mapping) };
}
