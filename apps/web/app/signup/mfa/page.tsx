import { redirect } from "next/navigation";
import { prisma } from "@mou7asib/db";
import { getPendingSetupUserId, totpProvisioningUri } from "@/lib/auth";
import ConfirmMfaForm from "./ConfirmMfaForm";

export const dynamic = "force-dynamic";

export default async function SignupMfaPage() {
  const userId = await getPendingSetupUserId();
  if (userId === null) {
    redirect("/signup");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, totpSecret: true, totpEnabled: true },
  });
  if (user === null || user.totpSecret === null || user.totpEnabled) {
    redirect("/signup");
  }

  const provisioningUri = totpProvisioningUri(user.email, user.totpSecret);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center p-6">
      <h1 className="text-xl font-semibold text-fg">Configurer l&apos;authentification à deux facteurs</h1>
      <p className="mt-1.5 text-sm text-fg-2">
        Obligatoire pour le rôle owner (CLAUDE.md §8.2). Ajoutez ce compte dans une
        application d&apos;authentification (Google Authenticator, 1Password, Authy…), puis
        saisissez le code généré.
      </p>

      <div className="mt-5 rounded-lg border border-border bg-surface-2 p-3">
        <p className="text-xs font-medium text-fg-2">Clé de configuration manuelle</p>
        <p className="mt-1 break-all font-mono text-sm text-fg">{user.totpSecret}</p>
        <p className="mt-2 text-xs text-fg-3">
          Ou collez cette URI dans une application compatible :{" "}
          <span className="break-all font-mono">{provisioningUri}</span>
        </p>
      </div>

      <ConfirmMfaForm />
    </main>
  );
}
