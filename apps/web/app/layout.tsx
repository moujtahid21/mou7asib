import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell, type OrgMembership } from "@mou7asib/ui";
import { prisma } from "@mou7asib/db";
import { getNav } from "@/lib/nav";
import { getLocale, dirForLocale } from "@/lib/locale";
import { getShellStrings } from "@/lib/shellStrings";
import { roleLabel } from "@/lib/policy";
import { getSession } from "@/lib/auth";
import { switchTenant } from "@/app/actions/switchTenant";
import { toggleLocale } from "@/app/actions/toggleLocale";
import { logout } from "@/app/actions/logout";
import "./globals.css";

export const metadata: Metadata = {
  title: "mou7asib",
  description: "Comptabilité pour les TPE marocaines",
};

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

// Fixed, non-interpolated script — no user data ever flows into it, so there's no
// injection surface despite dangerouslySetInnerHTML (CLAUDE.md §10). It has to run
// inline and before hydration: reading the persisted theme in a client component would
// paint the wrong theme for one frame first.
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('m7-theme');document.documentElement.setAttribute('data-m7-theme',t==='dark'?'dark':'light');}catch(e){}})();`;

// Phase 1: this layout wraps every route, including /login and /signup and the
// error/not-found boundaries, and now reads the session cookie (getSession) — Next
// treats that as a signal to render dynamically rather than statically, which is the
// correct behaviour for a per-user shell, not a regression from phase 0's "no DB call"
// stance (that was about an *unconditional* query; a cookie-driven, nullable session
// lookup is the normal cost of real auth). If Postgres is unreachable this throws and
// the user sees Next's error boundary — an honest failure, not a silently wrong shell
// (CLAUDE.md §13).
export default async function RootLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  const locale = await getLocale();
  const session = await getSession();

  // CLAUDE.md §8.1 — the switcher lists both ordinary memberships and active
  // AccountantAccess grants (an external accountant's own tenant plus every client they
  // currently have live access to), each re-validated on the next request by
  // getSession/switchTenant regardless of what's shown here.
  const memberships: OrgMembership[] = session
    ? [
        ...(
          await prisma.tenantMembership.findMany({
            where: { userId: session.userId },
            orderBy: { createdAt: "asc" },
            select: { tenantId: true, role: true, tenant: { select: { name: true } } },
          })
        ).map((membership) => ({
          tenantId: membership.tenantId,
          tenantName: membership.tenant.name,
          roleLabel: roleLabel(membership.role, locale),
        })),
        ...(
          await prisma.accountantAccess.findMany({
            where: { accountantId: session.userId, revokedAt: null, expiresAt: { gte: new Date() } },
            orderBy: { createdAt: "asc" },
            select: { tenantId: true, scope: true, tenant: { select: { name: true } } },
          })
        ).map((grant) => ({
          tenantId: grant.tenantId,
          tenantName: grant.tenant.name,
          roleLabel: roleLabel(grant.scope === "read_write" ? "accountant_external" : "readonly", locale),
        })),
      ]
    : [];

  return (
    <html
      lang={locale}
      dir={dirForLocale(locale)}
      className={`${geistSans.variable} ${geistMono.variable}`}
      // THEME_INIT_SCRIPT sets data-m7-theme before hydration, deliberately outside
      // React's render — same reason next-themes recommends this, so React doesn't
      // report a mismatch for an attribute it was never going to control.
      suppressHydrationWarning
    >
      <head>
        {/* eslint-disable-next-line react/no-danger -- static string, see THEME_INIT_SCRIPT comment */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="antialiased">
        <AppShell
          orgName={session?.tenantName ?? "mou7asib"}
          nav={getNav(locale)}
          memberships={memberships}
          currentTenantId={session?.tenantId ?? null}
          onSwitchTenant={switchTenant}
          locale={locale}
          onToggleLocale={toggleLocale}
          onLogout={logout}
          strings={getShellStrings(locale)}
          chromelessPrefixes={["/login", "/signup"]}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
