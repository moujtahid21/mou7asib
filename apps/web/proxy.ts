import { NextResponse, type NextRequest } from "next/server";

// Coarse, cookie-presence-only gate — CLAUDE.md §8.2 is explicit that this is not the
// authority: every Server Component/Action still calls requireSession() (lib/auth.ts),
// which re-validates against the Session table (expiry, revocation, membership still
// existing). Middleware exists so an unauthenticated request never even reaches a page
// that would otherwise have to remember to check.
const SESSION_COOKIE = "m7_session";
// Prefix match, not exact — "/signup" must also cover "/signup/mfa" (the mandatory-MFA
// step between account creation and a real session existing, see actions/signup.ts).
const PUBLIC_PATH_PREFIXES = ["/login", "/signup"];

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const isPublicPath = PUBLIC_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (!hasSession && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (hasSession && isPublicPath) {
    return NextResponse.redirect(new URL("/documents", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Deliberately does NOT exempt the document image/preview API routes — those serve
  // per-tenant file bytes and must stay behind the same session check as everything
  // else, not become an unauthenticated hole once auth exists.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
