"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@mou7asib/db";
import { verifyPassword, normalizeEmail, verifyTotp, createSession } from "@/lib/auth";

export type LoginState = { error: string } | null;

const loginSchema = z.object({
  email: z.string().trim().email("Adresse e-mail invalide."),
  password: z.string().min(1, "Mot de passe requis."),
  code: z.string().trim().optional(),
});

// Single-step login: the TOTP field is always present in the form (LoginForm.tsx) and
// only enforced when the account actually has MFA enabled — CLAUDE.md §8.2 doesn't
// require a separate step, just that the code is checked, and a fixed generic error for
// both "wrong password" and "unknown email" avoids confirming which emails exist.
export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    code: formData.get("code"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }
  const email = normalizeEmail(parsed.data.email);

  const genericError = { error: "Identifiants incorrects." };

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, totpSecret: true, totpEnabled: true },
  });
  if (user === null) {
    return genericError;
  }

  const passwordOk = await verifyPassword(user.passwordHash, parsed.data.password);
  if (!passwordOk) {
    return genericError;
  }

  if (user.totpEnabled) {
    const code = parsed.data.code ?? "";
    if (!/^\d{6}$/.test(code) || user.totpSecret === null || !verifyTotp(user.totpSecret, code)) {
      return { error: "Code d'authentification incorrect ou manquant." };
    }
  }

  // Most recently created membership first — a reasonable default for "which org did they
  // most likely mean" until phase 15's org picker replaces this with an explicit choice
  // when a user has more than one.
  const membership = await prisma.tenantMembership.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { tenantId: true },
  });
  if (membership === null) {
    return { error: "Aucune organisation associée à ce compte." };
  }

  await createSession(user.id, membership.tenantId);
  redirect("/documents");
}
