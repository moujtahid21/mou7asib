import type { NavItem } from "@mou7asib/ui";
import type { Locale } from "@/lib/locale";

// ADR 0007: the full navigation ships from phase 0. isLive marks the destinations with
// real functionality behind them today; the rest render <UnderConstruction> until their
// phase (see the implementation roadmap) lands — never fabricated data in the meantime.
//
// Data-driven per CLAUDE.md §10's i18n mandate: labels/subtitles keyed by locale rather
// than hardcoded French, so the sidebar is genuinely bilingual today even though the
// pages behind each link mostly aren't yet (see lib/locale.ts's scope note).
interface NavContent {
  readonly id: string;
  readonly href: string;
  readonly iconPath: string;
  readonly isLive: boolean;
  readonly label: Record<Locale, string>;
  readonly subtitle: Record<Locale, string>;
}

const NAV_CONTENT: readonly NavContent[] = [
  {
    id: "dashboard",
    href: "/dashboard",
    iconPath: "M4 13h6V4H4zM14 20h6V4h-6zM4 20h6v-4H4z",
    isLive: true,
    label: { fr: "Tableau de bord", ar: "لوحة التحكم" },
    subtitle: {
      fr: "Trésorerie, créances et alertes réelles du grand livre",
      ar: "الخزينة والذمم والتنبيهات الحقيقية من دفتر الأستاذ",
    },
  },
  {
    id: "rapprochement",
    href: "/rapprochement",
    iconPath: "M4 8h13l-3-3M20 16H7l3 3",
    isLive: true,
    label: { fr: "Rapprochement", ar: "التسوية البنكية" },
    subtitle: {
      fr: "Import de relevé et suggestions de lettrage",
      ar: "استيراد الكشف واقتراحات المطابقة",
    },
  },
  {
    id: "reception",
    href: "/documents",
    iconPath: "M4 13l2-7h12l2 7v5H4zM4 13h5l1 2h4l1-2h5",
    isLive: true,
    label: { fr: "Réception", ar: "الاستلام" },
    subtitle: {
      fr: "Réception & vérification des pièces",
      ar: "استلام المستندات والتحقق منها",
    },
  },
  {
    id: "facturation",
    href: "/facturation",
    iconPath: "M6 3h9l3 3v15l-3-2-3 2-3-2-3 2zM9 9h6M9 13h6",
    isLive: true,
    label: { fr: "Facturation", ar: "الفوترة" },
    subtitle: {
      fr: "Factures sortantes, numérotation séquentielle réelle",
      ar: "فواتير صادرة، ترقيم متسلسل حقيقي",
    },
  },
  {
    id: "tva",
    href: "/tva",
    iconPath: "M6 3h12v18H6zM9 8h6M9 12h6M9 16h3",
    isLive: true,
    label: { fr: "TVA & états", ar: "الضريبة والبيانات" },
    subtitle: {
      fr: "Grand livre, TVA, RAS et tableau de passage IS",
      ar: "دفتر الأستاذ، الضريبة، الاقتطاع والجدول الانتقالي للضريبة على الشركات",
    },
  },
  {
    id: "comptables",
    href: "/comptables",
    iconPath: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 20c0-4 3.5-6 8-6s8 2 8 6",
    isLive: true,
    label: { fr: "Comptables", ar: "المحاسبون" },
    subtitle: {
      fr: "Accès scopé et daté pour votre fiduciaire externe",
      ar: "وصول محدد النطاق والمدة لمحاسبكم الخارجي",
    },
  },
  {
    id: "parametres",
    href: "/parametres",
    iconPath:
      "M12 9a3 3 0 100 6 3 3 0 000-6M4.5 12l-1-2 1.6-2.8 2.2.3 1.7-1.5L9.5 4h5l.5 2 1.7 1.5 2.2-.3L20.5 10l-1 2 1 2-1.6 2.8-2.2-.3-1.7 1.5-.5 2h-5l-.5-2-1.7-1.5-2.2.3L3.5 14z",
    isLive: false,
    label: { fr: "Paramètres", ar: "الإعدادات" },
    subtitle: {
      fr: "Plan comptable, taux, utilisateurs — arrive en phase 16",
      ar: "مخطط الحسابات، النسب، المستخدمون — قادمة في المرحلة 16",
    },
  },
];

export function getNav(locale: Locale): NavItem[] {
  return NAV_CONTENT.map((item) => ({
    id: item.id,
    href: item.href,
    iconPath: item.iconPath,
    isLive: item.isLive,
    label: item.label[locale],
    subtitle: item.subtitle[locale],
  }));
}
