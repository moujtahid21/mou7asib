# mou7asib — Cahier des charges

> Document source du projet. Les règles techniques et de sécurité qui en découlent
> sont dans `CLAUDE.md`. En cas de contradiction sur la façon de coder, `CLAUDE.md`
> fait foi ; sur *ce qu'il faut construire*, c'est ce document.

---

## 1. Objectif

Mettre à disposition un logiciel de comptabilité accessible via le Web (déployé sur
Vercel), destiné aux Marocains résidant au Maroc.

À l'aide d'un modèle d'IA, le logiciel doit **saisir, classer et comptabiliser
automatiquement les factures**, qu'elles soient au format PDF, Excel, CSV, numérisées
ou sous forme de photo.

### 1.1 Extraction automatique

Le logiciel doit extraire au minimum : numéro de facture, date, montants, TVA.

### 1.2 Comptabilisation intelligente

Le logiciel doit apprendre, à partir des écritures historiques, comment les factures
doivent être comptabilisées.

Les éléments que l'IA ne parvient pas à classer avec certitude doivent être **signalés
et soumis à l'attention de l'utilisateur**. Ainsi, aucune facture n'est perdue ni
comptabilisée de manière erronée.

---

## 2. Conformité marocaine

Le logiciel doit s'appuyer sur la structure du **plan comptable marocain (CGNC)**.
Contrairement aux systèmes génériques comme DATEV en Allemagne, il doit intégrer
nativement :

- La structure comptable spécifique au Maroc (classes 1 à 9).
- Les états de synthèse obligatoires :
  - Bilan
  - Compte de Produits et Charges (CPC)
  - État des Soldes de Gestion (ESG) ¹
  - Tableau de financement / flux de trésorerie
  - État des Informations Complémentaires (ETIC)
- La gestion automatique des **retenues à la source (RAS)** ², qui varient selon le
  type de prestation (honoraires, revenus locatifs, etc.) — aspect particulièrement
  complexe au Maroc.

> ¹ Le brief initial indiquait « état des soldes du bilan ». Le terme correct est
> **État des Soldes de Gestion**.
> ² Le brief initial indiquait « IRS ». Le terme correct est **retenue à la source**,
> prélevée au titre de l'IR ou de l'IS selon la nature du paiement.

---

## 3. Interface conseillers fiscaux

Interface dédiée aux experts-comptables / fiduciaires, avec connexion directe à
**Sage**, **Cegid** ou au système actuel de l'utilisateur.

Pas d'exportation manuelle. Pas de double saisie.

---

## 4. Automatisation des déclarations

L'automatisation doit se concentrer sur les déclarations fréquentes qui pénalisent les
petits entrepreneurs en temps.

### 4.1 TVA

- Intégrer les taux spécifiques (20 %, 14 %, 10 %, 7 %).
- Gérer automatiquement le **prorata de déduction** pour les activités mixtes.

### 4.2 Échéancier

Générer automatiquement les formulaires de déclaration mensuelle ou trimestrielle de
TVA, compatibles avec le portail **SIMPL** de la Direction Générale des Impôts (DGI).

### 4.3 IS (Impôt sur les Sociétés)

Pré-remplir les **tableaux de passage du résultat comptable au résultat fiscal**, en
gérant les réintégrations et déductions extracomptables courantes.

---

## 5. Accessibilité financière

- **Modèle SaaS** : architecture cloud avec abonnement mensuel faible
  (cible : 100–200 MAD/mois) plutôt qu'une licence perpétuelle coûteuse.
- **Open Source** : envisager des frameworks comptables open source (Odoo Community,
  Dolibarr) déjà adaptés ou adaptables au contexte marocain, en ne développant que
  les modules spécifiques de conformité fiscale marocaine par-dessus. ³
- **Mobile First** : interface simplifiée pour smartphone, permettant la saisie des
  factures par photo (OCR) et la consultation du chiffre d'affaires en temps réel —
  crucial pour les commerçants et artisans.

> ³ **Décision ouverte.** Cette piste est incompatible en l'état avec la stack
> technique du §7 (Next.js / Prisma / Python). Voir `CLAUDE.md` §16, décision 1.

---

## 6. Intégration bancaire et facturation

### 6.1 Rapprochement bancaire

Se connecter aux API des banques marocaines — ou, à défaut, importer les relevés
CSV/Excel standardisés — pour automatiser le lettrage.

### 6.2 Facturation conforme

Générer des factures respectant strictement les mentions obligatoires du code de
commerce marocain, afin d'éviter les rejets fiscaux, avec **numérotation séquentielle
obligatoire**.

---

## 7. Stack technique visée

> Ces versions sont des **cibles à vérifier**, pas des faits établis. Voir
> `CLAUDE.md` §4 : toute version doit être confirmée auprès du registre avant d'être
> épinglée.

### Backend & IA (Python)

- **Python 3.14.x** — version stable la plus récente offrant le meilleur support pour
  les bibliothèques d'IA (TensorFlow, PyTorch, scikit-learn). Éviter la 3.15, encore
  en pré-release.

### Interface & framework web

- **React 19.2.x** — norme stable. Pas de canary ni d'experimental.
- **Next.js 16.2.x** — impose Node.js 20+, Turbopack par défaut, conçu pour React 19.
- **TypeScript 7.0.x** — gains de performance majeurs par rapport à la v6.

### Styling & base de données

- **Tailwind CSS 4.3.x**
- **Prisma ORM 7.9.x** — runtime entièrement TypeScript.

```json
{
  "dependencies": {
    "next": "16.2.12",
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "prisma": "7.9.0",
    "@prisma/client": "7.9.0"
  },
  "devDependencies": {
    "typescript": "7.0.2",
    "tailwindcss": "4.3.3",
    "@types/react": "19.2.x",
    "@types/node": "20.x"
  }
}
```

---

## 8. Nom du projet

**mou7asib** — projet local.
