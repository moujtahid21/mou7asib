import "server-only";
import { cookies } from "next/headers";

// CLAUDE.md §10 — i18n from day one, FR/AR with RTL. This is the phase 1 scaffold: the
// mechanism (storage, dir flip, translated nav data) is real and works end to end, but
// only the shell chrome's data-driven strings (packages/ui's own hardcoded button/label
// text, and every page's content) are translated so far — that's the deliberate scope
// boundary, not something silently declared "done." Widening it is follow-up work, not
// a phase-1 blocker.
export type Locale = "fr" | "ar";

const LOCALE_COOKIE = "m7_locale";
const DEFAULT_LOCALE: Locale = "fr";

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const value = cookieStore.get(LOCALE_COOKIE)?.value;
  return value === "ar" ? "ar" : DEFAULT_LOCALE;
}

export function dirForLocale(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

export async function setLocaleCookie(locale: Locale): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    // Not sensitive, no need for httpOnly — a locale preference is fine for the client
    // to read too if a future client component wants it directly.
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
