# @mou7asib/ui

The design system ported from the `Mou7asib Workspace.dc.html` mockup (ADR 0007 phase
0): tokens, the app shell, and shared presentational primitives. Ships TypeScript/TSX
source directly (no build step) — consumers must add it to `transpilePackages` in their
`next.config.ts`, same as `@mou7asib/db`.

## Tokens (`tokens.css`)

CSS custom properties for light/dark, mapped into Tailwind v4 utilities via `@theme`
(`bg-surface`, `text-fg-2`, `border-ai-border`, ...) — see the file for the full token
list. `AppShell` toggles `data-m7-theme="dark"|"light"` on `<html>`; the dark values are
a plain `:root[data-m7-theme="dark"]` override, picked up at runtime because the
generated utilities reference `var(--color-*)`.

**If your consuming app's Tailwind build isn't picking up classes used in this
package's `.tsx` files**, you're missing the `@source "./"` directive `tokens.css`
already declares — Tailwind v4 excludes `node_modules` from automatic content
detection by default, and a workspace package is resolved through a `node_modules`
symlink even though it's logically part of the source tree. This bit us once; see the
comment at the top of `tokens.css`.

## `<AppShell>`

The orchestrator: sidebar (collapsible on desktop, off-canvas drawer below the `lg`
breakpoint — CLAUDE.md §10 wants 320px to work, and the mockup's fixed desktop-only
layout did not), header, main slot, copilot side panel, command palette, toast.

- **`chromelessPrefixes`**: routes that render `{children}` with no shell chrome at all
  (auth pages — no tenant/nav context exists yet). Matched by path prefix against
  `usePathname()`.
- **`memberships`/`currentTenantId`/`onSwitchTenant`**: the org switcher. Only rendered
  as an actual dropdown when there's more than one membership; otherwise a plain label.
- **`locale`/`onToggleLocale`/`strings`**: i18n for the shell chrome. See the scope note
  below — this does not mean the whole app is translated.
- **`onLogout`**: wired to a no-arg Server Action (`apps/web/app/actions/logout.ts`) —
  Server Actions can be passed directly as props from a Server Component into a Client
  Component tree, same pattern as `onSwitchTenant`/`onToggleLocale`.

All of `memberships`, `onSwitchTenant`, `locale`, `onToggleLocale`, `onLogout`,
`strings` are optional with safe defaults, so a consumer that hasn't wired auth yet
(there wasn't one before phase 1) still gets a working shell.

## i18n scope (deliberately partial — not silently incomplete)

`ShellStrings` threads translated strings for the sidebar's theme/locale/collapse/logout
toggles and the nav labels (`apps/web/lib/nav.ts` — data-driven per locale) into
`AppShell`/`Sidebar`. **Nothing else in this package is translated yet**: `Header`'s
search placeholder, `CommandPalette`'s copy, `CopilotPanel`'s copy, `Toast`, `KpiCard`
all still read French string literals. Widening `ShellStrings` (or giving each
component its own strings prop, same pattern) is real follow-up work, not something to
assume is "done" because the sidebar looks bilingual.

## Primitives

`KpiCard`, `Badge`, `DataTableShell`, `UnderConstruction`, `ToastProvider`/`useToast`,
`Icon`/`ICON_PATHS`. All presentational, props-driven, no fetching, no fabricated
placeholder data baked in — `UnderConstruction` in particular exists specifically so an
unbuilt nav destination can say so honestly instead of showing invented numbers (ADR
0007) or being hidden.

Server Components by default; `"use client"` only on the interactive pieces (`AppShell`,
`Sidebar`, `Header`, `CopilotPanel`, `CommandPalette`, `Toast`) per CLAUDE.md §10.
