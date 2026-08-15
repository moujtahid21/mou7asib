import SignupForm from "./SignupForm";

export default function SignupPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center p-6">
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 flex-none items-center justify-center rounded-lg bg-fg text-[14px] font-bold text-bg">
          m7
        </div>
        <span className="text-lg font-semibold text-fg">mou7asib</span>
      </div>
      <h1 className="mt-6 text-xl font-semibold text-fg">Créer votre organisation</h1>
      <p className="mt-1.5 text-sm text-fg-2">
        Vous serez propriétaire (rôle owner) de cette organisation — l&apos;authentification à
        deux facteurs sera requise à l&apos;étape suivante (CLAUDE.md §8.2).
      </p>
      <SignupForm />
    </main>
  );
}
