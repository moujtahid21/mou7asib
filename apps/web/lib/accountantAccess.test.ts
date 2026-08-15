import { describe, expect, it } from "vitest";
import { resolveGrantedRole } from "./accountantAccess.ts";

const NOW = new Date("2026-08-15T12:00:00Z");

describe("resolveGrantedRole", () => {
  it("maps an active read_write grant to accountant_external", () => {
    const role = resolveGrantedRole(
      { scope: "read_write", expiresAt: new Date("2026-09-01T00:00:00Z"), revokedAt: null },
      NOW,
    );
    expect(role).toBe("accountant_external");
  });

  it("maps an active read_only grant to readonly", () => {
    const role = resolveGrantedRole(
      { scope: "read_only", expiresAt: new Date("2026-09-01T00:00:00Z"), revokedAt: null },
      NOW,
    );
    expect(role).toBe("readonly");
  });

  it("is still active at the exact expiry instant — inclusive end", () => {
    const role = resolveGrantedRole({ scope: "read_write", expiresAt: NOW, revokedAt: null }, NOW);
    expect(role).toBe("accountant_external");
  });

  it("denies access the instant after expiry — CLAUDE.md §8.1's 'scope and expiry both enforced'", () => {
    const role = resolveGrantedRole(
      { scope: "read_write", expiresAt: new Date("2026-08-15T11:59:59Z"), revokedAt: null },
      NOW,
    );
    expect(role).toBeNull();
  });

  it("denies access once revoked, even if not yet expired", () => {
    const role = resolveGrantedRole(
      {
        scope: "read_write",
        expiresAt: new Date("2026-09-01T00:00:00Z"),
        revokedAt: new Date("2026-08-15T09:00:00Z"),
      },
      NOW,
    );
    expect(role).toBeNull();
  });
});
