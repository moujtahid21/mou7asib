import { describe, expect, it } from "vitest";
import { Decimal } from "@mou7asib/accounting";
import { buildTvaBreakdown } from "./tvaResolution.ts";

const RATES = [
  { rateCode: "NORMAL_20", rate: new Decimal(0.2), effectiveFrom: new Date("2015-01-01"), effectiveTo: null },
  { rateCode: "REDUIT_14", rate: new Decimal(0.14), effectiveFrom: new Date("2015-01-01"), effectiveTo: null },
];

describe("buildTvaBreakdown", () => {
  it("returns null when there are no tva_lines", () => {
    expect(buildTvaBreakdown([], RATES, new Date("2026-01-01"))).toBeNull();
  });

  it("matches extracted percentages to configured rate codes and computes totals", () => {
    const breakdown = buildTvaBreakdown(
      [
        { groupIndex: 0, ratePercent: new Decimal(20), baseHt: new Decimal(1000) },
        { groupIndex: 1, ratePercent: new Decimal(14), baseHt: new Decimal(500) },
      ],
      RATES,
      new Date("2026-01-01"),
    );
    expect(breakdown).not.toBeNull();
    expect(breakdown!.unresolvedCount).toBe(0);
    expect(breakdown!.totalHt).toBe("1500.00");
    expect(breakdown!.totalTva).toBe("270.00"); // 200 + 70
    expect(breakdown!.totalTtc).toBe("1770.00");
    expect(breakdown!.postingLines).toHaveLength(2);
    expect(breakdown!.postingLines.find((l) => l.label.includes("NORMAL_20"))?.amount).toBe("200.00");
  });

  it("flags a line whose percentage matches no configured rate and produces no posting lines", () => {
    const breakdown = buildTvaBreakdown(
      [{ groupIndex: 0, ratePercent: new Decimal(99), baseHt: new Decimal(1000) }],
      RATES,
      new Date("2026-01-01"),
    );
    expect(breakdown!.unresolvedCount).toBe(1);
    expect(breakdown!.postingLines).toEqual([]);
    expect(breakdown!.rows[0]?.rateCode).toBeNull();
  });

  it("groups multiple lines at the same rate into one posting line", () => {
    const breakdown = buildTvaBreakdown(
      [
        { groupIndex: 0, ratePercent: new Decimal(20), baseHt: new Decimal(100) },
        { groupIndex: 1, ratePercent: new Decimal(20), baseHt: new Decimal(200) },
      ],
      RATES,
      new Date("2026-01-01"),
    );
    expect(breakdown!.postingLines).toHaveLength(1);
    expect(breakdown!.postingLines[0]?.amount).toBe("60.00");
  });
});
