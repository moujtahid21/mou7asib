import { describe, expect, it } from "vitest";
import { Decimal } from "@mou7asib/accounting";
import { netAmountForAccount, formatSignedAmount } from "./drilldown.ts";

describe("netAmountForAccount", () => {
  it("sums every matching line in an entry, not just the first", () => {
    const lines = [
      { accountCode: "34552", debit: new Decimal(200), credit: new Decimal(0) },
      { accountCode: "34552", debit: new Decimal(70), credit: new Decimal(0) },
      { accountCode: "6111", debit: new Decimal(1500), credit: new Decimal(0) },
    ];
    expect(netAmountForAccount(lines, "34552").toString()).toBe("270");
  });

  it("nets debit against credit for the same account", () => {
    const lines = [
      { accountCode: "5141", debit: new Decimal(1000), credit: new Decimal(0) },
      { accountCode: "5141", debit: new Decimal(0), credit: new Decimal(300) },
    ];
    expect(netAmountForAccount(lines, "5141").toString()).toBe("700");
  });

  it("returns zero when the account doesn't appear", () => {
    const lines = [{ accountCode: "6111", debit: new Decimal(100), credit: new Decimal(0) }];
    expect(netAmountForAccount(lines, "5141").toString()).toBe("0");
  });
});

describe("formatSignedAmount", () => {
  it("formats a positive amount without a sign", () => {
    expect(formatSignedAmount(new Decimal(270))).toBe("270.00");
  });

  it("prefixes a negative amount with a minus, using abs for the digits", () => {
    expect(formatSignedAmount(new Decimal(-270))).toBe("-270.00");
  });

  it("formats zero without a sign", () => {
    expect(formatSignedAmount(new Decimal(0))).toBe("0.00");
  });
});
