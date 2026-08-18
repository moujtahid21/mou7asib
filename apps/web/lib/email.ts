import "server-only";
import { Resend } from "resend";

// The web app is the only thing that ever sends transactional email — no other module
// should import "resend" directly, mirroring how apps/ai is the only caller of a model
// provider (CLAUDE.md §3). Keeping the provider behind this one function is what makes it
// swappable later without touching the callers.
const RESEND_API_KEY = process.env["RESEND_API_KEY"];

// CLAUDE.md §13 — fail loudly rather than silently dropping an email a user is depending
// on (a reset link that never sends looks, from the outside, identical to "the email
// provider is down" and identical to "nothing happened" — the difference matters).
if (RESEND_API_KEY === undefined || RESEND_API_KEY.length === 0) {
  throw new Error("RESEND_API_KEY is not set. Copy .env.example to .env and fill it in.");
}

const resend = new Resend(RESEND_API_KEY);

// Resend's own onboarding domain — only delivers to the account owner's own verified
// email until a real sending domain is added and verified in the Resend dashboard. Swap
// this once a domain exists; nothing else about this module needs to change.
const FROM_ADDRESS = process.env["RESEND_FROM_ADDRESS"] ?? "mou7asib <onboarding@resend.dev>";

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: "Réinitialisation de votre mot de passe mou7asib",
    text: `Vous avez demandé la réinitialisation de votre mot de passe mou7asib.

Cliquez sur ce lien pour choisir un nouveau mot de passe (valable 30 minutes) :
${resetUrl}

Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail — votre mot de passe reste inchangé.`,
  });

  if (error !== null) {
    // CLAUDE.md §13 — a failed send must not look like a successful one to the caller.
    throw new Error(`Failed to send password reset email: ${error.message}`);
  }
}
