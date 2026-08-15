import { redirect } from "next/navigation";

// ADR 0007: the sidebar (packages/ui AppShell) is the app's real entry point now.
// Réception (/documents) is the only live nav destination — send "/" straight there
// instead of keeping a separate bare landing screen.
export default function HomePage(): never {
  redirect("/documents");
}
