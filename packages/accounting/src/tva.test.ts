import { describe, expect, it } from "vitest";
import { Decimal } from "./money.ts";
import { resolveTvaRate, computeTvaLines, sumTvaTotals, groupByRate, resolveCashThreshold, type TvaRateConfig } from "./tva.ts";

// Fictional rate codes/values/dates — this file tests the resolution engine's logic, not
// any real Moroccan tax fact. Real seeded rates live in packages/db and are marked
// isPlaceholder pending docs/legal-inputs.md L-01.
const RATES: TvaRateConfig[] = [
  { rateCode: "A", rate: new Decimal(0.1), effectiveFrom: new Date("2020-01-01"), effectiveTo: new Date("2023-12-31") },
  { rateCode: "A", rate: new Decimal(0.12), effectiveFrom: new Date("2024-01-01"), effectiveTo: null },
  { rateCode: "B", rate: new Decimal(0.2), effectiveFrom: new Date("2020-01-01"), effectiveTo: null },
  { rateCode: "EXEMPT", rate: new Decimal(0), effectiveFrom: new Date("2020-01-01"), effectiveTo: null },
];

describe("resolveTvaRate", () => {
  it("resolves the rate in force at the transaction date, not today's", () => {
    const past = resolveTvaRate(RATES, "A", new Date("2022-06-01"));
    expect(past?.rate.toString()).toBe("0.1");
    const current = resolveTvaRate(RATES, "A", new Date("2025-06-01"));
    expect(current?.rate.toString()).toBe("0.12");
  });

  it("returns null for a code/date with no configured rate", () => {
    expect(resolveTvaRate(RATES, "UNKNOWN", new Date("2025-01-01"))).toBeNull();
    expect(resolveTvaRate(RATES, "A", new Date("2019-01-01"))).toBeNull();
  });
});

describe("computeTvaLines", () => {
  it("computes rounded TVA per line and separates unresolved lines", () => {
    const result = computeTvaLines(
      [
        { baseHt: new Decimal(1000), rateCode: "B" },
        { baseHt: new Decimal(500), rateCode: "A" },
        { baseHt: new Decimal(100), rateCode: "GHOST" },
      ],
      RATES,
      new Date("2025-06-01"),
    );
    expect(result.resolved).toHaveLength(2);
    expect(result.unresolved).toEqual([{ baseHt: new Decimal(100), rateCode: "GHOST" }]);
    const line0 = result.resolved.find((l) => l.rateCode === "B")!;
    expect(line0.tvaAmount.toString()).toBe("200");
    const line1 = result.resolved.find((l) => l.rateCode === "A")!;
    expect(line1.tvaAmount.toString()).toBe("60"); // 500 * 0.12
  });

  it("handles an exempt (0%) line", () => {
    const result = computeTvaLines([{ baseHt: new Decimal(300), rateCode: "EXEMPT" }], RATES, new Date("2025-01-01"));
    expect(result.resolved[0]?.tvaAmount.toString()).toBe("0");
  });
});

describe("sumTvaTotals", () => {
  it("sums HT/TVA/TTC across resolved lines", () => {
    const result = computeTvaLines(
      [
        { baseHt: new Decimal(1000), rateCode: "B" },
        { baseHt: new Decimal(500), rateCode: "A" },
      ],
      RATES,
      new Date("2025-01-01"),
    );
    const totals = sumTvaTotals(result.resolved);
    expect(totals.totalHt.toString()).toBe("1500");
    expect(totals.totalTva.toString()).toBe("260"); // 200 + 60
    expect(totals.totalTtc.toString()).toBe("1760");
  });
});

describe("groupByRate", () => {
  it("aggregates multiple lines sharing the same rate into one group", () => {
    const result = computeTvaLines(
      [
        { baseHt: new Decimal(100), rateCode: "B" },
        { baseHt: new Decimal(200), rateCode: "B" },
      ],
      RATES,
      new Date("2025-01-01"),
    );
    const groups = groupByRate(result.resolved);
    expect(groups.size).toBe(1);
    expect(groups.get("B")?.baseHt.toString()).toBe("300");
    expect(groups.get("B")?.tvaAmount.toString()).toBe("60");
  });
});

describe("resolveCashThreshold", () => {
  it("resolves the threshold in force on the given date", () => {
    const configs = [
      { thresholdAmount: new Decimal(20000), effectiveFrom: new Date("2020-01-01"), effectiveTo: new Date("2023-12-31") },
      { thresholdAmount: new Decimal(5000), effectiveFrom: new Date("2024-01-01"), effectiveTo: null },
    ];
    expect(resolveCashThreshold(configs, new Date("2022-01-01"))?.toString()).toBe("20000");
    expect(resolveCashThreshold(configs, new Date("2025-01-01"))?.toString()).toBe("5000");
  });

  it("returns null when nothing is configured for the date", () => {
    expect(resolveCashThreshold([], new Date("2025-01-01"))).toBeNull();
  });
});
