import { describe, expect, it } from "vitest";
import { Decimal } from "@mou7asib/accounting";
import { suggestMatches } from "./bankMatching.ts";

describe("suggestMatches", () => {
  it("matches a transaction to the open line with the exact same amount and closest date", () => {
    const transactions = [{ id: "t1", valueDate: new Date("2026-08-10"), amount: new Decimal(1140) }];
    const openLines = [
      { id: "l1", date: new Date("2026-08-05"), debit: new Decimal(1140), credit: new Decimal(0) },
      { id: "l2", date: new Date("2026-08-09"), debit: new Decimal(1140), credit: new Decimal(0) },
    ];
    const result = suggestMatches(transactions, openLines);
    expect(result.get("t1")?.lineId).toBe("l2");
  });

  it("matches negative (outgoing) amounts against the credit side", () => {
    const transactions = [{ id: "t1", valueDate: new Date("2026-08-10"), amount: new Decimal(-500) }];
    const openLines = [{ id: "l1", date: new Date("2026-08-10"), debit: new Decimal(0), credit: new Decimal(500) }];
    const result = suggestMatches(transactions, openLines);
    expect(result.get("t1")?.lineId).toBe("l1");
  });

  it("does not suggest a line whose amount doesn't match exactly", () => {
    const transactions = [{ id: "t1", valueDate: new Date("2026-08-10"), amount: new Decimal(1140) }];
    const openLines = [{ id: "l1", date: new Date("2026-08-10"), debit: new Decimal(1139.99), credit: new Decimal(0) }];
    const result = suggestMatches(transactions, openLines);
    expect(result.has("t1")).toBe(false);
  });

  it("does not suggest a line outside the date-diff tolerance", () => {
    const transactions = [{ id: "t1", valueDate: new Date("2026-08-10"), amount: new Decimal(1140) }];
    const openLines = [{ id: "l1", date: new Date("2026-01-01"), debit: new Decimal(1140), credit: new Decimal(0) }];
    const result = suggestMatches(transactions, openLines, 15);
    expect(result.has("t1")).toBe(false);
  });

  it("never suggests the same line for two different transactions", () => {
    const transactions = [
      { id: "t1", valueDate: new Date("2026-08-10"), amount: new Decimal(1140) },
      { id: "t2", valueDate: new Date("2026-08-11"), amount: new Decimal(1140) },
    ];
    const openLines = [{ id: "l1", date: new Date("2026-08-10"), debit: new Decimal(1140), credit: new Decimal(0) }];
    const result = suggestMatches(transactions, openLines);
    const matchedLineIds = [result.get("t1")?.lineId, result.get("t2")?.lineId].filter((v) => v !== undefined);
    expect(matchedLineIds).toHaveLength(1);
    expect(result.get("t1")?.lineId).toBe("l1");
    expect(result.has("t2")).toBe(false);
  });
});
