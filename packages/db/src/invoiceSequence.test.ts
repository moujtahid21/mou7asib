import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, withTenant } from "./index.ts";

// CLAUDE.md §5.6 — "per-tenant, per-series database sequence... No gaps, no reuse."
// Exercises the exact allocation pattern apps/web/app/actions/finalizeInvoice.ts and
// createAvoir.ts use (an upsert compiling to INSERT ... ON CONFLICT DO UPDATE, which
// Postgres serializes on the counter row's lock) under real concurrency against a real
// Postgres, not a mocked/sequential simulation.
async function allocateInvoiceNumber(tenantId: string, seriesCode: string): Promise<number> {
  return withTenant(tenantId, async (tx) => {
    const counter = await tx.invoiceSeriesCounter.upsert({
      where: { tenantId_seriesCode: { tenantId, seriesCode } },
      create: { tenantId, seriesCode, nextNumber: 2 },
      update: { nextNumber: { increment: 1 } },
    });
    return counter.nextNumber - 1;
  });
}

describe("invoice sequence allocation under concurrency", () => {
  let tenantId: string;

  beforeAll(async () => {
    const tenant = await prisma.tenant.create({ data: { name: `Test invoice-sequence tenant ${randomUUID()}` } });
    tenantId = tenant.id;
  });

  afterAll(async () => {
    await withTenant(tenantId, (tx) => tx.invoiceSeriesCounter.deleteMany({ where: { tenantId } }));
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
  });

  it("produces exactly {1..N} with no gap and no reuse under N concurrent allocations", async () => {
    const N = 20;
    const numbers = await Promise.all(Array.from({ length: N }, () => allocateInvoiceNumber(tenantId, "FA")));

    const sorted = [...numbers].sort((a, b) => a - b);
    expect(new Set(numbers).size).toBe(N); // no reuse
    expect(sorted).toEqual(Array.from({ length: N }, (_, i) => i + 1)); // no gap, starts at 1

    const counter = await withTenant(tenantId, (tx) =>
      tx.invoiceSeriesCounter.findUnique({ where: { tenantId_seriesCode: { tenantId, seriesCode: "FA" } } }),
    );
    expect(counter?.nextNumber).toBe(N + 1);
  });

  it("keeps series independent — a different series starts its own count at 1", async () => {
    const number = await allocateInvoiceNumber(tenantId, "AV");
    expect(number).toBe(1);
  });
});
