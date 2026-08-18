import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import argon2 from "argon2";
import * as OTPAuth from "otpauth";
import { prisma, type Role } from "@mou7asib/db";
import { resolveGrantedRole } from "@/lib/accountantAccess";

const SESSION_COOKIE = "m7_session";
const PENDING_SETUP_COOKIE = "m7_pending_setup";
// Short-lived per CLAUDE.md §8.2, absolute (not sliding) — a real usability
// tradeoff worth revisiting once there's a refresh flow, not deferred silently:
// this comment is that flag.
const SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000;

const ROLES_REQUIRING_MFA: readonly Role[] = ["owner", "accountant_internal", "accountant_external"];

export function requiresMfa(role: Role): boolean {
  return ROLES_REQUIRING_MFA.includes(role);
}

// ── Passwords ────────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    // Malformed hash (shouldn't happen) — fail closed, not throw into the caller.
    return false;
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// ── TOTP (mandatory MFA for owner/accountant_* — CLAUDE.md §8.2) ─────────

export function generateTotpSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

export function totpProvisioningUri(email: string, secret: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: "mou7asib",
    label: email,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  return totp.toString();
}

export function verifyTotp(secret: string, token: string): boolean {
  const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) });
  // One-step window of drift tolerance either side — the standard allowance for clock skew.
  return totp.validate({ token, window: 1 }) !== null;
}

// ── Sessions ─────────────────────────────────────────────────────────────

// Exported: the password-reset flow (actions/requestPasswordReset.ts,
// actions/resetPassword.ts) hashes its own bearer token the same way, for the same
// reason — never persist a reversible form of a credential that grants access.
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export interface AuthenticatedSession {
  userId: string;
  email: string;
  tenantId: string;
  tenantName: string;
  role: Role;
}

/** Creates a Session row scoped to one tenant membership and sets the cookie. Switching
 * org (phase 1's org switcher) calls this again for a different tenant rather than
 * mutating the existing row — see the Session model's comment in schema.prisma. */
export async function createSession(userId: string, tenantId: string): Promise<void> {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);

  await prisma.session.create({
    data: { userId, tenantId, tokenHash: hashToken(token), expiresAt },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Revokes the current session (server-side, effective immediately for every request
 * using it — CLAUDE.md §8.2) and clears the cookie. */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token !== undefined) {
    await prisma.session.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  cookieStore.delete(SESSION_COOKIE);
}

/** Reads and validates the session cookie against the Session table — never trusts the
 * cookie's mere presence, always re-checks expiry/revocation server-side. Returns null
 * for "not authenticated," the only signal callers need (redirect to /login). */
export async function getSession(): Promise<AuthenticatedSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token === undefined) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      expiresAt: true,
      revokedAt: true,
      userId: true,
      tenantId: true,
      user: { select: { email: true } },
      tenant: { select: { name: true } },
    },
  });

  if (session === null || session.revokedAt !== null || session.expiresAt < new Date()) {
    return null;
  }

  const membership = await prisma.tenantMembership.findUnique({
    where: { tenantId_userId: { tenantId: session.tenantId, userId: session.userId } },
    select: { role: true },
  });

  const role = membership?.role ?? (await grantedRole(session.tenantId, session.userId));
  if (role === null) {
    // Membership revoked, or the AccountantAccess grant expired/was revoked, after the
    // session was issued — fail closed rather than trust the stale session's implicit
    // role (CLAUDE.md §8.1: scope and expiry are enforced on every request, not just at
    // switch time).
    return null;
  }

  return {
    userId: session.userId,
    email: session.user.email,
    tenantId: session.tenantId,
    tenantName: session.tenant.name,
    role,
  };
}

/** CLAUDE.md §8.1 — the cross-tenant path for an external accountant with no
 * TenantMembership row in this tenant at all: an active AccountantAccess grant. Shared by
 * getSession (per-request re-check) and switchTenant (initial grant to create a session
 * for). */
export async function grantedRole(tenantId: string, accountantUserId: string): Promise<Role | null> {
  const grant = await prisma.accountantAccess.findUnique({
    where: { tenantId_accountantId: { tenantId, accountantId: accountantUserId } },
    select: { scope: true, expiresAt: true, revokedAt: true },
  });
  if (grant === null) {
    return null;
  }
  return resolveGrantedRole(grant, new Date());
}

/** For Server Components/Actions that require a session — throws rather than returning
 * null so a forgotten check fails loudly (CLAUDE.md §13) instead of silently leaking a
 * page. Route protection itself lives in proxy.ts; this is the defense-in-depth
 * check at the data layer, matching CLAUDE.md §8.2's "checked server-side on every
 * request, not in middleware alone." */
export async function requireSession(): Promise<AuthenticatedSession> {
  const session = await getSession();
  if (session === null) {
    throw new Error("No authenticated session — this should be unreachable past proxy.ts.");
  }
  return session;
}

// ── Signup → mandatory MFA setup handoff ──────────────────────────────────
//
// A brand-new owner account has no session yet (none is issued until TOTP is confirmed —
// see signup.ts/confirmMfa.ts), so /signup/mfa can't use getSession() to know who it's
// setting up. This short-lived, single-purpose cookie carries only a user id — not a
// credential, grants no access by itself — for exactly that ten-minute handoff.

export async function setPendingSetupUser(userId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(PENDING_SETUP_COOKIE, userId, {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });
}

export async function getPendingSetupUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(PENDING_SETUP_COOKIE)?.value ?? null;
}

export async function clearPendingSetupUser(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(PENDING_SETUP_COOKIE);
}
