import RequestResetForm from "./RequestResetForm";

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center p-6">
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 flex-none items-center justify-center rounded-lg bg-fg text-[14px] font-bold text-bg">
          m7
        </div>
        <span className="text-lg font-semibold text-fg">mou7asib</span>
      </div>
      <h1 className="mt-6 text-xl font-semibold text-fg">Mot de passe oublié</h1>
      <p className="mt-1.5 text-sm text-fg-2">
        Indiquez l&apos;adresse e-mail de votre compte. Si elle correspond à un compte
        existant, vous recevrez un lien de réinitialisation valable 30 minutes.
      </p>
      <RequestResetForm />
    </main>
  );
}
