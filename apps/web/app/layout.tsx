import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "mou7asib",
  description: "Comptabilité pour les TPE marocaines",
};

// CLAUDE.md §10 — lang and dir are set explicitly from the start so that the
// Arabic/RTL locale is a configuration change rather than a rewrite.
export default function RootLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <html lang="fr" dir="ltr">
      <body className="bg-white text-slate-900 antialiased">{children}</body>
    </html>
  );
}
