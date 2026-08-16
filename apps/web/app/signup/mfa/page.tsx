import { redirect } from "next/navigation";
import QRCode from "qrcode";
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
  const qrCodeDataUrl = await QRCode.toDataURL(provisioningUri, { margin: 1, width: 220 });

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center p-6">
      <h1 className="text-xl font-semibold text-fg">Configurer l&apos;authentification à deux facteurs</h1>
      <p className="mt-1.5 text-sm text-fg-2">
        Obligatoire pour le rôle owner (CLAUDE.md §8.2). Scannez ce code avec une application
        d&apos;authentification (Google Authenticator, 1Password, Authy…), puis saisissez le
        code généré.
      </p>

      <img
        src={qrCodeDataUrl}
        alt="Code QR de configuration de l'authentification à deux facteurs"
        width={220}
        height={220}
        className="mx-auto mt-5 rounded-lg border border-border bg-white p-2"
      />

      <details className="mt-4 rounded-lg border border-border bg-surface-2 p-3">
        <summary className="cursor-pointer text-xs font-medium text-fg-2">
          Impossible de scanner ? Saisir la clé manuellement
        </summary>
        <p className="mt-2 break-all font-mono text-sm text-fg">{user.totpSecret}</p>
      </details>

      <ConfirmMfaForm />
    </main>
  );
}
