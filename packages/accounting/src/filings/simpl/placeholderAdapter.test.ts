import { describe, expect, it } from "vitest";
import { Decimal } from "../../money.ts";
import { renderPlaceholderDeclaration, ADAPTER_VERSION } from "./placeholderAdapter.ts";
import type { TvaDeclarationFigures } from "./types.ts";

const FIGURES: TvaDeclarationFigures = {
  tenantName: "Test SARL",
  periodStart: new Date("2026-01-01"),
  periodEnd: new Date("2026-01-31"),
  regime: "encaissement",
  totalCollectee: new Decimal(1000),
  totalDeductible: new Decimal(400),
  totalDue: new Decimal(600),
};

describe("renderPlaceholderDeclaration", () => {
  it("always states it is not an official DGI/SIMPL file", () => {
    const output = renderPlaceholderDeclaration(FIGURES);
    expect(output).toContain("NON OFFICIEL");
    expect(output).toContain("L-22");
  });

  it("includes the tenant, period, regime, and figures", () => {
    const output = renderPlaceholderDeclaration(FIGURES);
    expect(output).toContain("Test SARL");
    expect(output).toContain("2026-01-01");
    expect(output).toContain("2026-01-31");
    expect(output).toContain("encaissement");
    expect(output).toContain("1000.00");
    expect(output).toContain("400.00");
    expect(output).toContain("600.00");
    expect(output).toContain(ADAPTER_VERSION);
  });

  it("shows 'non défini' when the regime hasn't been chosen", () => {
    const output = renderPlaceholderDeclaration({ ...FIGURES, regime: null });
    expect(output).toContain("non défini");
  });
});
