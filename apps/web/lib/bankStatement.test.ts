import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv.ts";
import { buildTransactions, type ColumnMapping } from "./bankStatement.ts";

const MAPPING_SIGNED: ColumnMapping = { Date: "date", Libelle: "label", Montant: "amount", Ref: "externalId" };
const MAPPING_TWO_COL: ColumnMapping = { Date: "date", Libelle: "label", Debit: "debit", Credit: "credit" };

describe("buildTransactions", () => {
  it("parses a signed single-amount-column statement", () => {
    const csv = "Date,Libelle,Montant,Ref\n2026-08-05,Virement client,1140.00,REF001\n2026-08-06,Prelevement EDM,-320.50,\n";
    const parsed = parseCsv(csv);
    const result = buildTransactions(parsed, MAPPING_SIGNED);
    expect(result.issues).toEqual([]);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]?.amount.toString()).toBe("1140");
    expect(result.transactions[0]?.externalId).toBe("REF001");
    expect(result.transactions[1]?.amount.toString()).toBe("-320.5");
    expect(result.transactions[1]?.externalId).toBeUndefined();
  });

  it("parses a two-column debit/credit statement", () => {
    const csv = "Date,Libelle,Debit,Credit\n2026-08-05,Virement client,0,1140.00\n2026-08-06,Prelevement EDM,320.50,0\n";
    const parsed = parseCsv(csv);
    const result = buildTransactions(parsed, MAPPING_TWO_COL);
    expect(result.issues).toEqual([]);
    expect(result.transactions[0]?.amount.toString()).toBe("1140");
    expect(result.transactions[1]?.amount.toString()).toBe("-320.5");
  });

  it("flags a zero-amount row as an issue instead of silently dropping it", () => {
    const csv = "Date,Libelle,Montant\n2026-08-05,Ligne vide,0\n";
    const parsed = parseCsv(csv);
    const result = buildTransactions(parsed, MAPPING_SIGNED);
    expect(result.transactions).toEqual([]);
    expect(result.issues).toHaveLength(1);
  });

  it("reports an incomplete mapping instead of guessing", () => {
    const csv = "Date,Libelle\n2026-08-05,x\n";
    const parsed = parseCsv(csv);
    const result = buildTransactions(parsed, { Date: "date", Libelle: "label" });
    expect(result.mappingComplete).toBe(false);
    expect(result.transactions).toEqual([]);
  });
});
