import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, withTenant } from "./index.ts";

// CLAUDE.md §8.1 — "write a test for each new tenant-owned model that asserts tenant A
// cannot read tenant B's rows. This test is not optional." Against a real Postgres
// (§12), not mocked: mocking withTenant would only prove the mock is right, not that the
// RLS policies from the phase 1 migration actually hold in the database itself.
describe("tenant isolation (RLS + withTenant)", () => {
  let tenantAId: string;
  let tenantBId: string;
  let documentId: string;

  beforeAll(async () => {
    const tenantA = await prisma.tenant.create({ data: { name: `Test tenant A ${randomUUID()}` } });
    const tenantB = await prisma.tenant.create({ data: { name: `Test tenant B ${randomUUID()}` } });
    tenantAId = tenantA.id;
    tenantBId = tenantB.id;

    const document = await withTenant(tenantAId, (tx) =>
      tx.document.create({
        data: {
          tenantId: tenantAId,
          contentHash: randomUUID().slice(0, 16),
          originalFilename: "isolation-test.pdf",
          mimeType: "application/pdf",
          byteSize: 1,
          storagePath: "uploads/documents/does-not-exist.pdf",
          status: "uploaded",
        },
      }),
    );
    documentId = document.id;
  });

  afterAll(async () => {
    // RLS applies even to this cleanup (FORCE ROW LEVEL SECURITY) — must go through the
    // owning tenant's context, a plain prisma.document.delete() would affect 0 rows.
    await withTenant(tenantAId, (tx) => tx.document.deleteMany({ where: { id: documentId } }));
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
  });

  it("is visible within its own tenant's context, without needing an app-level filter", async () => {
    const found = await withTenant(tenantAId, (tx) => tx.document.findFirst({ where: { id: documentId } }));
    expect(found?.id).toBe(documentId);
  });

  it("is invisible from another tenant's context, even without an app-level filter — the RLS backstop", async () => {
    const found = await withTenant(tenantBId, (tx) => tx.document.findFirst({ where: { id: documentId } }));
    expect(found).toBeNull();
  });

  it("cannot be updated from another tenant's context", async () => {
    const result = await withTenant(tenantBId, (tx) =>
      tx.document.updateMany({ where: { id: documentId }, data: { status: "failed" } }),
    );
    expect(result.count).toBe(0);

    const stillQueued = await withTenant(tenantAId, (tx) =>
      tx.document.findFirst({ where: { id: documentId }, select: { status: true } }),
    );
    expect(stillQueued?.status).toBe("uploaded");
  });

  it("is invisible outside any withTenant context — fails closed by default", async () => {
    const found = await prisma.document.findFirst({ where: { id: documentId } });
    expect(found).toBeNull();
  });
});
