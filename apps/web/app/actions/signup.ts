"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma, seedTenantAccounts } from "@mou7asib/db";
import { hashPassword, normalizeEmail, generateTotpSecret, setPendingSetupUser } from "@/lib/auth";

export type SignupState = { error: string } | null;

const signupSchema = z.object({
  businessName: z.string().trim().min(1, "Raison sociale requise."),
  email: z.string().trim().email("Adresse e-mail invalide."),
  password: z.string().min(10, "Le mot de passe doit contenir au moins 10 caractères."),
});

// Owner is the only role self-signup can create — accountant_internal/external and
// employee/readonly memberships are granted by an owner later (phase 15/16), not chosen
// here. MFA is mandatory for owner (CLAUDE.md §8.2): this creates the user with a TOTP
// secret but totpEnabled=false, and defers session creation until confirmMfa.ts verifies
// a real code — nobody gets a working session with MFA merely "set up," only "confirmed."
export async function signup(_prevState: SignupState, formData: FormData): Promise<SignupState> {
  const parsed = signupSchema.safeParse({
    businessName: formData.get("businessName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }
  const email = normalizeEmail(parsed.data.email);

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing !== null) {
    return { error: "Un compte existe déjà avec cette adresse e-mail." };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const totpSecret = generateTotpSecret();

  const userId = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({ data: { name: parsed.data.businessName } });
    const user = await tx.user.create({
      data: { email, passwordHash, totpSecret, totpEnabled: false },
    });
    await tx.tenantMembership.create({
      data: { tenantId: tenant.id, userId: user.id, role: "owner" },
    });
    // accounts is RLS'd (phase 2) — set the context inline rather than nesting a second
    // withTenant() transaction inside this one. Same transaction as the tenant/user/
    // membership creation above: if seeding the chart fails, nothing here commits either.
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenant.id}, true)`;
    await seedTenantAccounts(tx, tenant.id);
    return user.id;
  });

  await setPendingSetupUser(userId);
  redirect("/signup/mfa");
}
