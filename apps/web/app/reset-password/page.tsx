import Link from "next/link";
import ResetPasswordForm from "./ResetPasswordForm";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center p-6">
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 flex-none items-center justify-center rounded-lg bg-fg text-[14px] font-bold text-bg">
          m7
        </div>
        <span className="text-lg font-semibold text-fg">mou7asib</span>
      </div>
      <h1 className="mt-6 text-xl font-semibold text-fg">Nouveau mot de passe</h1>

      {token === undefined || token.length === 0 ? (
        <>
          <p className="mt-1.5 text-sm text-fg-2">
            Ce lien de réinitialisation est incomplet.
          </p>
          <p className="mt-4 text-center text-sm text-fg-2">
            <Link href="/forgot-password" className="font-medium text-ai">
              Demander un nouveau lien
            </Link>
          </p>
        </>
      ) : (
        <ResetPasswordForm token={token} />
      )}
    </main>
  );
}
