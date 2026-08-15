import { describe, expect, it } from "vitest";
import { Decimal } from "./money.ts";
import { validateMentions, hasBlockingIssues, type InvoiceMentionInput } from "./invoiceMentions.ts";

const COMPLETE: InvoiceMentionInput = {
  issuerName: "Mou7asib Demo SARL",
  issuerIce: "001234567000012",
  issuerIf: "12345678",
  issuerRc: "RC12345",
  issuerPatente: "PAT123",
  issuerCnss: "CNSS123",
  customerName: "Client Test",
  customerIce: "009876543000099",
  invoiceDate: new Date("2026-08-15"),
  paymentTerms: "30 jours net",
  lines: [{ description: "Prestation", quantity: new Decimal(1), unitPriceHt: new Decimal(1000), rateCode: "NORMAL_20" }],
  unresolvedRateCodes: [],
};

describe("validateMentions", () => {
  it("produces no issues for a fully complete invoice", () => {
    expect(validateMentions(COMPLETE)).toEqual([]);
  });

  it("blocks on missing issuer ICE/IF but only warns on missing RC/patente/CNSS", () => {
    const issues = validateMentions({ ...COMPLETE, issuerIce: null, issuerIf: null, issuerRc: null, issuerPatente: null, issuerCnss: null });
    const blocking = issues.filter((i) => i.blocking).map((i) => i.field);
    const nonBlocking = issues.filter((i) => !i.blocking).map((i) => i.field);
    expect(blocking).toEqual(expect.arrayContaining(["issuerIce", "issuerIf"]));
    expect(nonBlocking).toEqual(expect.arrayContaining(["issuerRc", "issuerPatente", "issuerCnss"]));
    expect(hasBlockingIssues(issues)).toBe(true);
  });

  it("blocks on a missing customer ICE", () => {
    const issues = validateMentions({ ...COMPLETE, customerIce: null });
    expect(issues.some((i) => i.field === "customerIce" && i.blocking)).toBe(true);
  });

  it("blocks when there are no lines", () => {
    const issues = validateMentions({ ...COMPLETE, lines: [] });
    expect(issues.some((i) => i.field === "lines" && i.blocking)).toBe(true);
  });

  it("blocks on an invalid line quantity", () => {
    const issues = validateMentions({
      ...COMPLETE,
      lines: [{ description: "x", quantity: new Decimal(0), unitPriceHt: new Decimal(10), rateCode: "NORMAL_20" }],
    });
    expect(issues.some((i) => i.field === "lines[0].quantity")).toBe(true);
  });

  it("blocks on an unresolved TVA rate code", () => {
    const issues = validateMentions({ ...COMPLETE, unresolvedRateCodes: ["GHOST"] });
    expect(issues.some((i) => i.message.includes("GHOST") && i.blocking)).toBe(true);
  });

  it("blocks a negative quantity by default, but allows it for an avoir (allowNegativeQuantity)", () => {
    const negatedLines = [{ description: "x", quantity: new Decimal(-2), unitPriceHt: new Decimal(10), rateCode: "NORMAL_20" }];
    const blockedByDefault = validateMentions({ ...COMPLETE, lines: negatedLines });
    expect(blockedByDefault.some((i) => i.field === "lines[0].quantity" && i.blocking)).toBe(true);

    const allowedForAvoir = validateMentions({ ...COMPLETE, lines: negatedLines, allowNegativeQuantity: true });
    expect(allowedForAvoir.some((i) => i.field === "lines[0].quantity")).toBe(false);
  });

  it("still blocks a zero quantity even with allowNegativeQuantity", () => {
    const zeroLines = [{ description: "x", quantity: new Decimal(0), unitPriceHt: new Decimal(10), rateCode: "NORMAL_20" }];
    const issues = validateMentions({ ...COMPLETE, lines: zeroLines, allowNegativeQuantity: true });
    expect(issues.some((i) => i.field === "lines[0].quantity" && i.blocking)).toBe(true);
  });
});
