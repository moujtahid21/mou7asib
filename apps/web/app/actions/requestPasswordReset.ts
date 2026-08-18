"use server";

import crypto from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@mou7asib/db";
import { normalizeEmail, hashToken } from "@/lib/auth";
import { sendPasswordResetEmail } from "@/lib/email";

export type RequestPasswordResetState = { message: string } | null;

const requestSchema = z.object({
  email: z.string().trim().email("Adresse e-mail invalide."),
});

const TOKEN_LIFETIME_MS = 30 * 60 * 1000;

// Same email regardless of whether the address has an account — CLAUDE.md §8.2's spirit
// for login ("a fixed generic error... avoids confirming which emails exist") applies
// just as much here; a distinguishable response on this form is an account-enumeration
// oracle. The one thing that legitimately varies is failure of the whole request (a
// malformed email address), which is a form-validation error, not an enumeration signal.
export async function requestPasswordReset(
  _prevState: RequestPasswordResetState,
  formData: FormData,
): Promise<RequestPasswordResetState> {
  const parsed = requestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { message: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }
  const email = normalizeEmail(parsed.data.email);
  const genericMessage = "Si un compte existe avec cette adresse, un e-mail de réinitialisation a été envoyé.";

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (user === null) {
    return { message: genericMessage };
  }

  const token = crypto.randomBytes(32).toString("base64url");
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + TOKEN_LIFETIME_MS),
    },
  });

  const headerList = await headers();
  const host = headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? (process.env["NODE_ENV"] === "production" ? "https" : "http");
  const resetUrl = `${proto}://${host}/reset-password?token=${token}`;

  try {
    await sendPasswordResetEmail(email, resetUrl);
  } catch (error: unknown) {
    // CLAUDE.md §13 — fail loudly server-side (this is a real delivery failure worth
    // knowing about), but the response to the caller stays generic regardless, same as
    // the "user doesn't exist" case above — an unauthenticated caller must not be able to
    // distinguish "no such account" from "the email provider is down."
    console.error("password reset email failed to send", error);
  }

  return { message: genericMessage };
}
