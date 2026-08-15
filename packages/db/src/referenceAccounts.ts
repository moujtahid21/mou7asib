/**
 * The shared CGNC reference plan, seeded as a structural skeleton (all ten classes,
 * 0-9 — CLAUDE.md §5.1) plus a small, uncontroversial subset of leaf accounts covering
 * the day-to-day bookkeeping a TPE actually needs (bank, cash, clients, fournisseurs,
 * TVA control accounts, common charge/produit lines).
 *
 * **This is NOT the official CGNC chart.** L-61 (`docs/legal-inputs.md`) — the
 * authoritative, machine-readable chart of accounts — is still `TODO(legal)`. Every
 * account below is either already referenced elsewhere in this codebase (CLAUDE.md
 * itself, the design mockup) or is a code taught in every standard Moroccan comptabilité
 * générale reference; none of it is invented, but it is far from exhaustive and every
 * sub-account here is filed directly under its one-digit class rather than the
 * intermediate rubrique codes (e.g. "34", "345") this file is not confident enough about
 * to assert. Extend this file once L-61 lands — do not treat its current contents as
 * complete or ship it to a real customer as "the chart of accounts."
 */
export interface ReferenceAccountSeed {
  code: string;
  label: string;
  labelAr: string;
  classDigit: number;
  parentCode: string | null;
}

const CLASS_HEADERS: ReferenceAccountSeed[] = [
  { code: "0", label: "Comptes spéciaux (hors bilan)", labelAr: "حسابات خاصة (خارج الميزانية)", classDigit: 0, parentCode: null },
  { code: "1", label: "Comptes de financement permanent", labelAr: "حسابات التمويل الدائم", classDigit: 1, parentCode: null },
  { code: "2", label: "Comptes d'actif immobilisé", labelAr: "حسابات الأصول الثابتة", classDigit: 2, parentCode: null },
  { code: "3", label: "Comptes d'actif circulant (hors trésorerie)", labelAr: "حسابات الأصول المتداولة (باستثناء الخزينة)", classDigit: 3, parentCode: null },
  { code: "4", label: "Comptes de passif circulant (hors trésorerie)", labelAr: "حسابات الخصوم المتداولة (باستثناء الخزينة)", classDigit: 4, parentCode: null },
  { code: "5", label: "Comptes de trésorerie", labelAr: "حسابات الخزينة", classDigit: 5, parentCode: null },
  { code: "6", label: "Comptes de charges", labelAr: "حسابات الأعباء", classDigit: 6, parentCode: null },
  { code: "7", label: "Comptes de produits", labelAr: "حسابات المنتوجات", classDigit: 7, parentCode: null },
  { code: "8", label: "Comptes de résultats", labelAr: "حسابات النتائج", classDigit: 8, parentCode: null },
  { code: "9", label: "Comptabilité analytique", labelAr: "المحاسبة التحليلية", classDigit: 9, parentCode: null },
];

const LEAF_ACCOUNTS: ReferenceAccountSeed[] = [
  // Class 1 — Financement permanent
  { code: "1111", label: "Capital social", labelAr: "رأس المال الاجتماعي", classDigit: 1, parentCode: "1" },
  { code: "1169", label: "Report à nouveau", labelAr: "الأرباح أو الخسائر المؤجلة", classDigit: 1, parentCode: "1" },

  // Class 2 — Actif immobilisé
  { code: "2355", label: "Matériel informatique", labelAr: "معدات إعلامية", classDigit: 2, parentCode: "2" },

  // Class 3 — Actif circulant (hors trésorerie)
  { code: "3421", label: "Clients", labelAr: "الزبناء", classDigit: 3, parentCode: "3" },
  { code: "34552", label: "État — TVA récupérable", labelAr: "الدولة — الضريبة على القيمة المضافة القابلة للاسترداد", classDigit: 3, parentCode: "3" },

  // Class 4 — Passif circulant (hors trésorerie)
  { code: "4411", label: "Fournisseurs", labelAr: "الموردون", classDigit: 4, parentCode: "4" },
  { code: "4455", label: "État — TVA facturée", labelAr: "الدولة — الضريبة على القيمة المضافة المفوترة", classDigit: 4, parentCode: "4" },
  { code: "4456", label: "État — TVA due", labelAr: "الدولة — الضريبة على القيمة المضافة المستحقة", classDigit: 4, parentCode: "4" },

  // Class 5 — Trésorerie
  { code: "5141", label: "Banques", labelAr: "البنوك", classDigit: 5, parentCode: "5" },
  { code: "5161", label: "Caisse", labelAr: "الصندوق", classDigit: 5, parentCode: "5" },

  // Class 6 — Charges
  { code: "6111", label: "Achats de marchandises", labelAr: "مشتريات البضائع", classDigit: 6, parentCode: "6" },
  { code: "6125", label: "Achats non stockés de matières et fournitures", labelAr: "مشتريات غير مخزنة من المواد واللوازم", classDigit: 6, parentCode: "6" },
  { code: "6134", label: "Locations et charges locatives", labelAr: "الكراء والتكاليف الإيجارية", classDigit: 6, parentCode: "6" },
  { code: "6147", label: "Services bancaires", labelAr: "الخدمات البنكية", classDigit: 6, parentCode: "6" },
  { code: "61426", label: "Transports", labelAr: "النقل", classDigit: 6, parentCode: "6" },
  { code: "6171", label: "Rémunérations du personnel", labelAr: "أجور المستخدمين", classDigit: 6, parentCode: "6" },

  // Class 7 — Produits
  { code: "7111", label: "Ventes de marchandises", labelAr: "مبيعات البضائع", classDigit: 7, parentCode: "7" },
];

export const REFERENCE_ACCOUNT_SEEDS: readonly ReferenceAccountSeed[] = [...CLASS_HEADERS, ...LEAF_ACCOUNTS];
