"use server";

import { revalidatePath } from "next/cache";
import { getLocale, setLocaleCookie } from "@/lib/locale";

// No-argument so it can be passed directly to <AppShell onToggleLocale={...}> — a Server
// Action passed as a prop into a Client Component, same pattern as switchTenant.
export async function toggleLocale(): Promise<void> {
  const current = await getLocale();
  await setLocaleCookie(current === "fr" ? "ar" : "fr");
  revalidatePath("/", "layout");
}
