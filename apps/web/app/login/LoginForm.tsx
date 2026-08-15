"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login, type LoginState } from "@/app/actions/login";

const initialState: LoginState = null;

export default function LoginForm() {
  const [state, formAction, isPending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-fg">
          Adresse e-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1.5 block w-full rounded-lg border border-border-2 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-fg">
          Mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mt-1.5 block w-full rounded-lg border border-border-2 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="code" className="block text-sm font-medium text-fg">
          Code d&apos;authentification à deux facteurs
        </label>
        <input
          id="code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="Si activé pour ce compte"
          className="mt-1.5 block w-full rounded-lg border border-border-2 px-3 py-2 text-sm font-mono"
        />
      </div>

      {state?.error !== undefined && (
        <p role="alert" className="rounded-lg border border-neg bg-neg-bg p-3 text-sm text-neg">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-fg px-4 py-2.5 text-sm font-medium text-bg disabled:opacity-60"
      >
        {isPending ? "Connexion…" : "Se connecter"}
      </button>

      <p className="text-center text-sm text-fg-2">
        Pas encore de compte ?{" "}
        <Link href="/signup" className="font-medium text-ai">
          Créer une organisation
        </Link>
      </p>
    </form>
  );
}
