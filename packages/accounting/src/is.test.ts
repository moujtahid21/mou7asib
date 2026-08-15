import { describe, expect, it } from "vitest";
import { Decimal } from "./money.ts";
import { resolveIsBracket, resolveCotisationMinimale, computeResultatFiscal, computeIs, type IsBracketConfig, type IsCotisationMinimaleConfig } from "./is.ts";

// Fictional brackets/rates — this file tests the resolution/computation mechanism, not any
// real Moroccan IS fact. The real tables ship empty (see packages/db); every real
// computation returns null until they're configured.
const BRACKETS: IsBracketConfig[] = [
  { minIncome: new Decimal(0), maxIncome: new Decimal(100000), rate: new Decimal(0.1), effectiveFrom: new Date("2020-01-01"), effectiveTo: null },
  { minIncome: new Decimal(100000), maxIncome: null, rate: new Decimal(0.2), effectiveFrom: new Date("2020-01-01"), effectiveTo: null },
];
const COTISATION: IsCotisationMinimaleConfig[] = [
  { rate: new Decimal(0.005), minimumAmount: new Decimal(3000), effectiveFrom: new Date("2020-01-01"), effectiveTo: null },
];

describe("resolveIsBracket", () => {
  it("picks the bracket containing the taxable income", () => {
    expect(resolveIsBracket(BRACKETS, new Decimal(50000), new Date("2026-01-01"))?.rate.toString()).toBe("0.1");
    expect(resolveIsBracket(BRACKETS, new Decimal(500000), new Date("2026-01-01"))?.rate.toString()).toBe("0.2");
  });

  it("returns null against an empty table (the real shipped state)", () => {
    expect(resolveIsBracket([], new Decimal(50000), new Date("2026-01-01"))).toBeNull();
  });
});

describe("resolveCotisationMinimale", () => {
  it("resolves the config in force on the given date", () => {
    expect(resolveCotisationMinimale(COTISATION, new Date("2026-01-01"))?.rate.toString()).toBe("0.005");
  });

  it("returns null against an empty table", () => {
    expect(resolveCotisationMinimale([], new Date("2026-01-01"))).toBeNull();
  });
});

describe("computeResultatFiscal", () => {
  it("adds réintégrations and subtracts déductions from résultat comptable", () => {
    const result = computeResultatFiscal(new Decimal(1000), [
      { kind: "reintegration", amount: new Decimal(200) },
      { kind: "deduction", amount: new Decimal(50) },
    ]);
    expect(result.toString()).toBe("1150");
  });
});

describe("computeIs", () => {
  it("returns isDue as max(calculatedIs, cotisationMinimale) when both resolve", () => {
    const result = computeIs(new Decimal(50000), [], BRACKETS, COTISATION, new Decimal(2000000), new Date("2026-01-01"));
    // calculatedIs = 50000 * 0.1 = 5000; cotisation = max(2000000*0.005, 3000) = 10000
    expect(result.calculatedIs?.toString()).toBe("5000");
    expect(result.cotisationMinimale?.amount.toString()).toBe("10000");
    expect(result.isDue?.toString()).toBe("10000");
  });

  it("applies the cotisation minimale floor even on a fiscal loss — CLAUDE.md §5.5", () => {
    const result = computeIs(new Decimal(-50000), [], BRACKETS, COTISATION, new Decimal(2000000), new Date("2026-01-01"));
    expect(result.resultatFiscal.toString()).toBe("-50000");
    expect(result.bracket).toBeNull(); // no bracket applies to a loss, not "unresolved"
    expect(result.calculatedIs?.toString()).toBe("0"); // known zero, not null
    expect(result.cotisationMinimale?.amount.toString()).toBe("10000");
    expect(result.isDue?.toString()).toBe("10000"); // the floor wins, computed, not skipped
  });

  it("returns null isDue when brackets aren't configured — never guesses", () => {
    const result = computeIs(new Decimal(50000), [], [], COTISATION, new Decimal(2000000), new Date("2026-01-01"));
    expect(result.bracket).toBeNull();
    expect(result.calculatedIs).toBeNull();
    expect(result.isDue).toBeNull();
  });

  it("returns null isDue when cotisation minimale isn't configured either", () => {
    const result = computeIs(new Decimal(50000), [], BRACKETS, [], new Decimal(2000000), new Date("2026-01-01"));
    expect(result.cotisationMinimale).toBeNull();
    expect(result.isDue).toBeNull();
  });

  it("uses the minimum amount floor when the turnover-based cotisation is smaller", () => {
    const result = computeIs(new Decimal(50000), [], BRACKETS, COTISATION, new Decimal(100000), new Date("2026-01-01"));
    // 100000 * 0.005 = 500, below the 3000 floor
    expect(result.cotisationMinimale?.amount.toString()).toBe("3000");
  });
});
