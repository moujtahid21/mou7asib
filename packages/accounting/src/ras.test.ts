import { describe, expect, it } from "vitest";
import { Decimal } from "./money.ts";
import { resolveRasRule, evaluateRasWithholding, type RasRuleConfig } from "./ras.ts";

// Fictional payment natures/rates/dates — this file tests the resolution engine's logic,
// not any real Moroccan RAS fact. The real rule table ships empty (see packages/db) since
// CLAUDE.md §5.4 gives no rate to seed even as a placeholder, unlike TVA.
const RULES: RasRuleConfig[] = [
  {
    paymentNature: "TEST_HONORAIRES",
    payeeType: "profession_liberale",
    residentStatus: "resident",
    rate: new Decimal(0.1),
    liabilityTrigger: "invoice_date",
    effectiveFrom: new Date("2020-01-01"),
    effectiveTo: null,
  },
  {
    paymentNature: "TEST_NON_RESIDENT",
    payeeType: "entreprise",
    residentStatus: "non_resident",
    rate: new Decimal(0.15),
    liabilityTrigger: "payment_date",
    effectiveFrom: new Date("2024-01-01"),
    effectiveTo: null,
  },
];

describe("resolveRasRule", () => {
  it("matches on the full (nature, payeeType, residentStatus) key", () => {
    const rule = resolveRasRule(
      RULES,
      { paymentNature: "TEST_HONORAIRES", payeeType: "profession_liberale", residentStatus: "resident" },
      new Date("2026-01-01"),
      new Date("2026-01-10"),
    );
    expect(rule?.rate.toString()).toBe("0.1");
  });

  it("returns null for an unconfigured payment nature — never guesses", () => {
    const rule = resolveRasRule(
      RULES,
      { paymentNature: "UNKNOWN_NATURE", payeeType: "profession_liberale", residentStatus: "resident" },
      new Date("2026-01-01"),
      new Date("2026-01-10"),
    );
    expect(rule).toBeNull();
  });

  it("checks effectiveness against the invoice date when liabilityTrigger is invoice_date", () => {
    const before = resolveRasRule(
      RULES,
      { paymentNature: "TEST_HONORAIRES", payeeType: "profession_liberale", residentStatus: "resident" },
      new Date("2019-01-01"), // invoice date before effectiveFrom
      new Date("2026-01-01"), // payment date irrelevant for this rule
    );
    expect(before).toBeNull();
  });

  it("checks effectiveness against the payment date when liabilityTrigger is payment_date", () => {
    const rule = resolveRasRule(
      RULES,
      { paymentNature: "TEST_NON_RESIDENT", payeeType: "entreprise", residentStatus: "non_resident" },
      new Date("2019-01-01"), // invoice date irrelevant for this rule
      new Date("2026-01-01"), // payment date after effectiveFrom
    );
    expect(rule?.rate.toString()).toBe("0.15");
  });

  it("returns null against an entirely empty rule table (the real shipped state)", () => {
    const rule = resolveRasRule(
      [],
      { paymentNature: "TEST_HONORAIRES", payeeType: "profession_liberale", residentStatus: "resident" },
      new Date("2026-01-01"),
      new Date("2026-01-01"),
    );
    expect(rule).toBeNull();
  });
});

describe("evaluateRasWithholding", () => {
  it("computes the withheld amount and net payable when a rule matches", () => {
    const result = evaluateRasWithholding(
      RULES,
      { paymentNature: "TEST_HONORAIRES", payeeType: "profession_liberale", residentStatus: "resident" },
      new Decimal(1000),
      new Date("2026-01-01"),
      new Date("2026-01-10"),
    );
    expect(result.matched).toBe(true);
    expect(result.rasAmount?.toString()).toBe("100");
    expect(result.netPayable?.toString()).toBe("900");
  });

  it("flags rather than defaulting to zero withholding when nothing matches", () => {
    const result = evaluateRasWithholding(
      [],
      { paymentNature: "TEST_HONORAIRES", payeeType: "profession_liberale", residentStatus: "resident" },
      new Decimal(1000),
      new Date("2026-01-01"),
      new Date("2026-01-10"),
    );
    expect(result.matched).toBe(false);
    expect(result.rasAmount).toBeNull();
    expect(result.netPayable).toBeNull();
  });
});
