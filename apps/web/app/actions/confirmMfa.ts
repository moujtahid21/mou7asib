"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@mou7asib/db";
import { verifyTotp, getPendingSetupUserId, clearPendingSetupUser, createSession } from "@/lib/auth";

export type ConfirmMfaState = { error: string } | null;

const codeSchema = z.string().trim().regex(/^\d{6}$/, "Code à 6 chiffres requis.");

export async function confirmMfa(_prevState: ConfirmMfaState, formData: FormData): Promise<ConfirmMfaState> {
  const userId = await getPendingSetupUserId();
  if (userId === null) {
    return { error: "Session d'inscription expirée. Recommencez l'inscription." };
  }

  const parsed = codeSchema.safeParse(formData.get("code"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Code invalide." };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpSecret: true },
  });
  if (user === null || user.totpSecret === null) {
    return { error: "Compte introuvable." };
  }

  if (!verifyTotp(user.totpSecret, parsed.data)) {
    return { error: "Code incorrect." };
  }

  const membership = await prisma.tenantMembership.findFirst({
    where: { userId },
    select: { tenantId: true },
  });
  if (membership === null) {
    return { error: "Aucune organisation associée à ce compte." };
  }

  await prisma.user.update({ where: { id: userId }, data: { totpEnabled: true } });
  await clearPendingSetupUser();
  await createSession(userId, membership.tenantId);

  redirect("/documents");
}
