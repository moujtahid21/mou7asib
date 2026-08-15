import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv.ts";
import { buildImportGroups, type ColumnMapping } from "./journalImport.ts";

const MAPPING: ColumnMapping = {
  Piece: "entryRef",
  Date: "date",
  Compte: "accountCode",
  Libelle: "lineLabel",
  Debit: "debit",
  Credit: "credit",
  Journal: "journalCode",
};

describe("buildImportGroups", () => {
  it("groups lines by entryRef into balanced entries", () => {
    const csv = "Piece,Date,Compte,Libelle,Debit,Credit,Journal\n" +
      "F001,2026-01-05,6111,Achat marchandises,1000,0,ACH\n" +
      "F001,2026-01-05,4411,Fournisseur,0,1000,ACH\n" +
      "F002,2026-01-06,5141,Banque,500,0,BQ\n" +
      "F002,2026-01-06,7111,Vente,0,500,BQ\n";
    const parsed = parseCsv(csv);
    const result = buildImportGroups(parsed, MAPPING);

    expect(result.issues).toEqual([]);
    expect(result.groups).toHaveLength(2);
    expect(result.groups[0]?.entryRef).toBe("F001");
    expect(result.groups[0]?.lines).toHaveLength(2);
    expect(result.groups[0]?.total.toString()).toBe("1000");
  });

  it("flags an unbalanced entry as an issue instead of throwing", () => {
    const csv = "Piece,Date,Compte,Libelle,Debit,Credit,Journal\n" +
      "F001,2026-01-05,6111,Achat,1000,0,ACH\n" +
      "F001,2026-01-05,4411,Fournisseur,0,900,ACH\n";
    const parsed = parseCsv(csv);
    const result = buildImportGroups(parsed, MAPPING);

    expect(result.groups).toEqual([]);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.message).toContain("F001");
  });

  it("accepts a comma decimal separator (quoted, so it isn't split as a CSV field)", () => {
    const csv = "Piece,Date,Compte,Libelle,Debit,Credit,Journal\n" +
      'F001,2026-01-05,6111,Achat,"1234,50",0,ACH\n' +
      'F001,2026-01-05,4411,Fournisseur,0,"1234,50",ACH\n';
    const parsed = parseCsv(csv);
    const result = buildImportGroups(parsed, MAPPING);
    expect(result.issues).toEqual([]);
    expect(result.groups[0]?.total.toString()).toBe("1234.5");
  });

  it("skips blank rows and reports rows missing a required field", () => {
    const csv = "Piece,Date,Compte,Libelle,Debit,Credit,Journal\n" +
      "\n" +
      ",2026-01-05,6111,Achat,1000,0,ACH\n" +
      "F001,2026-01-05,6111,Achat,1000,0,ACH\n" +
      "F001,2026-01-05,4411,Fournisseur,0,1000,ACH\n";
    const parsed = parseCsv(csv);
    const result = buildImportGroups(parsed, MAPPING);

    // parseCsv drops fully blank lines before rows are numbered, so the row number is
    // among non-blank rows, not a literal file line number.
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.rowNumber).toBe(2);
    expect(result.groups).toHaveLength(1);
  });

  it("reports an incomplete mapping instead of guessing", () => {
    const csv = "Piece,Date,Compte,Debit,Credit\nF001,2026-01-05,6111,1000,0\n";
    const parsed = parseCsv(csv);
    const result = buildImportGroups(parsed, { Piece: "entryRef", Date: "date" });

    expect(result.mappingComplete).toBe(false);
    expect(result.groups).toEqual([]);
  });
});
