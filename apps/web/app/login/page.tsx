import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center p-6">
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 flex-none items-center justify-center rounded-lg bg-fg text-[14px] font-bold text-bg">
          m7
        </div>
        <span className="text-lg font-semibold text-fg">mou7asib</span>
      </div>
      <h1 className="mt-6 text-xl font-semibold text-fg">Connexion</h1>
      <LoginForm />
    </main>
  );
}
