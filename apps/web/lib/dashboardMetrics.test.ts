import { describe, expect, it } from "vitest";
import { Decimal } from "@mou7asib/accounting";
import { bucketAgingByAge, buildMonthlyCashTrend, netDebitBalance } from "./dashboardMetrics.ts";

const asOf = new Date("2026-08-15T00:00:00Z");

describe("bucketAgingByAge", () => {
  it("buckets by age in days relative to asOf", () => {
    const lines = [
      { date: new Date("2026-08-10T00:00:00Z"), amount: new Decimal(100) }, // 5 days
      { date: new Date("2026-07-01T00:00:00Z"), amount: new Decimal(200) }, // 45 days
      { date: new Date("2026-06-01T00:00:00Z"), amount: new Decimal(300) }, // 75 days
      { date: new Date("2026-01-01T00:00:00Z"), amount: new Decimal(400) }, // >90 days
    ];
    const buckets = bucketAgingByAge(lines, asOf);
    expect(buckets.d0to30.toString()).toBe("100");
    expect(buckets.d31to60.toString()).toBe("200");
    expect(buckets.d61to90.toString()).toBe("300");
    expect(buckets.d90plus.toString()).toBe("400");
  });

  it("sums multiple lines landing in the same bucket", () => {
    const lines = [
      { date: new Date("2026-08-14T00:00:00Z"), amount: new Decimal(50) },
      { date: new Date("2026-08-01T00:00:00Z"), amount: new Decimal(25) },
    ];
    expect(bucketAgingByAge(lines, asOf).d0to30.toString()).toBe("75");
  });
});

describe("buildMonthlyCashTrend", () => {
  it("reconstructs a cumulative balance per month, ending at the running total", () => {
    const movements = [
      { date: new Date("2026-06-15T00:00:00Z"), delta: new Decimal(1000) },
      { date: new Date("2026-07-10T00:00:00Z"), delta: new Decimal(-300) },
      { date: new Date("2026-08-05T00:00:00Z"), delta: new Decimal(500) },
    ];
    const points = buildMonthlyCashTrend(movements, 3, asOf);
    expect(points).toHaveLength(3);
    expect(points[0]!.balance.toString()).toBe("1000"); // June
    expect(points[1]!.balance.toString()).toBe("700"); // July
    expect(points[2]!.balance.toString()).toBe("1200"); // August (partial, up to asOf)
  });

  it("excludes movements dated after asOf even within the current month", () => {
    const movements = [
      { date: new Date("2026-08-01T00:00:00Z"), delta: new Decimal(100) },
      { date: new Date("2026-08-20T00:00:00Z"), delta: new Decimal(9999) }, // after asOf
    ];
    const points = buildMonthlyCashTrend(movements, 1, asOf);
    expect(points[0]!.balance.toString()).toBe("100");
  });

  it("starts from a supplied opening balance", () => {
    const points = buildMonthlyCashTrend([], 1, asOf, new Decimal(500));
    expect(points[0]!.balance.toString()).toBe("500");
  });
});

describe("netDebitBalance", () => {
  it("computes debit minus credit across lines", () => {
    const lines = [
      { debit: new Decimal(100), credit: new Decimal(0) },
      { debit: new Decimal(0), credit: new Decimal(40) },
    ];
    expect(netDebitBalance(lines).toString()).toBe("60");
  });
});
