"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@mou7asib/db";
import { hashPassword, hashToken } from "@/lib/auth";

export type ResetPasswordState = { error: string } | null;

const resetSchema = z.object({
  token: z.string().trim().min(1),
  password: z.string().min(10, "Le mot de passe doit contenir au moins 10 caractères."),
});

export async function resetPassword(_prevState: ResetPasswordState, formData: FormData): Promise<ResetPasswordState> {
  const parsed = resetSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const tokenHash = hashToken(parsed.data.token);
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });

  // Same message for "no such token", "expired", and "already used" — none of these
  // should tell an attacker which case they hit, only that this link no longer works.
  const invalidTokenError = { error: "Ce lien de réinitialisation est invalide ou a expiré." };
  if (
    resetToken === null ||
    resetToken.usedAt !== null ||
    resetToken.expiresAt < new Date()
  ) {
    return invalidTokenError;
  }

  const passwordHash = await hashPassword(parsed.data.password);

  await prisma.$transaction([
    prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
    // A password reset is exactly the moment a session might be attacker-held (the whole
    // reason a reset is happening) — revoke every existing session for this account rather
    // than leaving old ones valid. MFA (if enabled) is untouched and still required on the
    // next login, same as any other login (CLAUDE.md §8.2) — this table has no way to turn
    // that off.
    prisma.session.updateMany({
      where: { userId: resetToken.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  redirect("/login?reset=success");
}
