import type { ShellStrings } from "@mou7asib/ui";
import type { Locale } from "@/lib/locale";

const SHELL_STRINGS: Record<Locale, ShellStrings> = {
  fr: {
    themeToDark: "Thème sombre",
    themeToLight: "Thème clair",
    collapseMenu: "Réduire le menu",
    switchToArabic: "العربية",
    switchToFrench: "Français",
    logout: "Se déconnecter",
  },
  ar: {
    themeToDark: "الوضع الداكن",
    themeToLight: "الوضع الفاتح",
    collapseMenu: "طي القائمة",
    switchToArabic: "العربية",
    switchToFrench: "Français",
    logout: "تسجيل الخروج",
  },
};

export function getShellStrings(locale: Locale): ShellStrings {
  return SHELL_STRINGS[locale];
}
