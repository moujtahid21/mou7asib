"""Generates ~12 synthetic Moroccan-style invoices as (PDF, ground_truth.json) pairs.

Committed to git (apps/ai/synthetic/corpus/) — small files, and per
docs/build-order.md the corpus is the deliverable, seeding CLAUDE.md §12's
permanent regression fixture set. Ground truth is always serialized from the
same InvoiceExtraction model the harness scores against, so it can never
hand-drift from the schema.

Run: uv run --project apps/ai python synthetic/generate_invoices.py
"""

from __future__ import annotations

import sys
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from pathlib import Path

import fitz

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from extraction_harness.schemas import InvoiceExtraction, TvaLine

CORPUS_DIR = Path(__file__).resolve().parent / "corpus"


@dataclass
class InvoiceSpec:
    name: str
    header_line: str | None
    extraction: InvoiceExtraction


def _tva(rate: str, base_ht: str, tva_amount: str) -> TvaLine:
    return TvaLine(rate=Decimal(rate), base_ht=Decimal(base_ht), tva_amount=Decimal(tva_amount))


SPECS: list[InvoiceSpec] = [
    InvoiceSpec(
        "invoice_01_single_rate_clean",
        None,
        InvoiceExtraction(
            invoice_number="FA-2026-0001",
            invoice_date=date(2026, 1, 10),
            due_date=date(2026, 2, 9),
            supplier_name="Atelier El Amrani",
            supplier_ice="001234567000045",
            supplier_if="12345678",
            customer_name="Client Test SARL",
            customer_ice="009876543000012",
            customer_if="87654321",
            total_ht=Decimal("1000.00"),
            tva_lines=[_tva("0.20", "1000.00", "200.00")],
            total_tva=Decimal("200.00"),
            total_ttc=Decimal("1200.00"),
            payment_terms="30 jours",
        ),
    ),
    InvoiceSpec(
        "invoice_02_missing_optional_fields",
        None,
        InvoiceExtraction(
            invoice_number="FA-2026-0002",
            invoice_date=date(2026, 1, 12),
            due_date=None,
            supplier_name="Menuiserie Bennani",
            supplier_ice="001111222000033",
            supplier_if="11112222",
            customer_name="Particulier",
            customer_ice=None,
            customer_if=None,
            total_ht=Decimal("500.00"),
            tva_lines=[_tva("0.20", "500.00", "100.00")],
            total_tva=Decimal("100.00"),
            total_ttc=Decimal("600.00"),
            payment_terms=None,
        ),
    ),
    InvoiceSpec(
        "invoice_03_mixed_rate_20_14",
        None,
        InvoiceExtraction(
            invoice_number="FA-2026-0003",
            invoice_date=date(2026, 1, 15),
            due_date=date(2026, 2, 14),
            supplier_name="Import Export Chraibi",
            supplier_ice="002233445000067",
            supplier_if="22334455",
            customer_name="Societe Alpha SARL",
            customer_ice="008765432000099",
            customer_if="88776655",
            total_ht=Decimal("1500.00"),
            tva_lines=[_tva("0.20", "1000.00", "200.00"), _tva("0.14", "500.00", "70.00")],
            total_tva=Decimal("270.00"),
            total_ttc=Decimal("1770.00"),
            payment_terms="45 jours fin de mois",
        ),
    ),
    InvoiceSpec(
        "invoice_04_mixed_rate_three_lines",
        None,
        InvoiceExtraction(
            invoice_number="FA-2026-0004",
            invoice_date=date(2026, 1, 18),
            due_date=date(2026, 2, 17),
            supplier_name="Fournitures Generales du Sud",
            supplier_ice="003344556000078",
            supplier_if="33445566",
            customer_name="Cooperative Argania",
            customer_ice="007654321000088",
            customer_if="77665544",
            total_ht=Decimal("2200.00"),
            tva_lines=[
                _tva("0.20", "1000.00", "200.00"),
                _tva("0.10", "800.00", "80.00"),
                _tva("0.07", "400.00", "28.00"),
            ],
            total_tva=Decimal("308.00"),
            total_ttc=Decimal("2508.00"),
            payment_terms="A reception",
        ),
    ),
    InvoiceSpec(
        "invoice_05_single_rate_10_dashed_ice",
        None,
        InvoiceExtraction(
            invoice_number="FA-2026-0005",
            invoice_date=date(2026, 1, 20),
            due_date=date(2026, 2, 19),
            supplier_name="Transport Rapide SARL",
            supplier_ice="001-234567-000099",
            supplier_if="99887766",
            customer_name="Cafe Al Manzah",
            customer_ice="004-455667-000011",
            customer_if=None,
            total_ht=Decimal("800.00"),
            tva_lines=[_tva("0.10", "800.00", "80.00")],
            total_tva=Decimal("80.00"),
            total_ttc=Decimal("880.00"),
            payment_terms="Comptant",
        ),
    ),
    InvoiceSpec(
        "invoice_06_single_rate_7_no_customer_if",
        None,
        InvoiceExtraction(
            invoice_number="FA-2026-0006",
            invoice_date=date(2026, 1, 22),
            due_date=None,
            supplier_name="Librairie Centrale",
            supplier_ice="005566778000022",
            supplier_if="55667788",
            customer_name="Ecole Privee Ibn Sina",
            customer_ice="006677889000033",
            customer_if=None,
            total_ht=Decimal("300.00"),
            tva_lines=[_tva("0.07", "300.00", "21.00")],
            total_tva=Decimal("21.00"),
            total_ttc=Decimal("321.00"),
            payment_terms="15 jours",
        ),
    ),
    InvoiceSpec(
        "invoice_07_mixed_rate_bilingual_header",
        "FACTURE / فاتورة",
        InvoiceExtraction(
            invoice_number="FA-2026-0007",
            invoice_date=date(2026, 1, 25),
            due_date=date(2026, 2, 24),
            supplier_name="Riad Dar Zaytoune",
            supplier_ice="007788990000044",
            supplier_if="77889900",
            customer_name="Voyages Atlas SARL",
            customer_ice="003322110000055",
            customer_if="33221100",
            total_ht=Decimal("1800.00"),
            tva_lines=[_tva("0.20", "1200.00", "240.00"), _tva("0.14", "600.00", "84.00")],
            total_tva=Decimal("324.00"),
            total_ttc=Decimal("2124.00"),
            payment_terms="60 jours",
        ),
    ),
    InvoiceSpec(
        "invoice_08_single_rate_bilingual_supplier",
        "Societe Al Baraka / شركة البركة",
        InvoiceExtraction(
            invoice_number="FA-2026-0008",
            invoice_date=date(2026, 1, 27),
            due_date=date(2026, 2, 26),
            supplier_name="Societe Al Baraka",
            supplier_ice="008899001000066",
            supplier_if="88990011",
            customer_name="Hanout Bab Doukkala",
            customer_ice="002211009000077",
            customer_if="22110099",
            total_ht=Decimal("650.00"),
            tva_lines=[_tva("0.20", "650.00", "130.00")],
            total_tva=Decimal("130.00"),
            total_ttc=Decimal("780.00"),
            payment_terms="30 jours",
        ),
    ),
    InvoiceSpec(
        "invoice_09_individual_customer_no_ice",
        None,
        InvoiceExtraction(
            invoice_number="FA-2026-0009",
            invoice_date=date(2026, 1, 29),
            due_date=date(2026, 2, 28),
            supplier_name="Garage Moderne",
            supplier_ice="009900112000088",
            supplier_if="99001122",
            customer_name="Mr. Youssef Idrissi",
            customer_ice=None,
            customer_if=None,
            total_ht=Decimal("950.00"),
            tva_lines=[_tva("0.20", "950.00", "190.00")],
            total_tva=Decimal("190.00"),
            total_ttc=Decimal("1140.00"),
            payment_terms="Comptant",
        ),
    ),
    InvoiceSpec(
        "invoice_10_mixed_rate_no_separators",
        None,
        InvoiceExtraction(
            invoice_number="FA-2026-0010",
            invoice_date=date(2026, 2, 1),
            due_date=date(2026, 3, 3),
            supplier_name="Materiaux du Nord SARL",
            supplier_ice="010011223000099",
            supplier_if="10011223",
            customer_name="Chantier Bab Marrakech",
            customer_ice="011022334000100",
            customer_if="11022334",
            total_ht=Decimal("3200.00"),
            tva_lines=[_tva("0.20", "2200.00", "440.00"), _tva("0.14", "1000.00", "140.00")],
            total_tva=Decimal("580.00"),
            total_ttc=Decimal("3780.00"),
            payment_terms="90 jours date de facture, virement bancaire uniquement",
        ),
    ),
    InvoiceSpec(
        "invoice_11_single_rate_no_due_date",
        None,
        InvoiceExtraction(
            invoice_number="FA-2026-0011",
            invoice_date=date(2026, 2, 3),
            due_date=None,
            supplier_name="Pharmacie Al Wafa",
            supplier_ice="012033445000011",
            supplier_if="12033445",
            customer_name="Clinique Errazi",
            customer_ice="013044556000022",
            customer_if="13044556",
            total_ht=Decimal("420.00"),
            tva_lines=[_tva("0.20", "420.00", "84.00")],
            total_tva=Decimal("84.00"),
            total_ttc=Decimal("504.00"),
            payment_terms="7 jours",
        ),
    ),
    InvoiceSpec(
        "invoice_12_mixed_rate_14_7",
        None,
        InvoiceExtraction(
            invoice_number="FA-2026-0012",
            invoice_date=date(2026, 2, 5),
            due_date=date(2026, 3, 7),
            supplier_name="Distribution Agricole du Souss",
            supplier_ice="014055667000033",
            supplier_if="14055667",
            customer_name="Cooperative Agricole Taroudant",
            customer_ice="015066778000044",
            customer_if="15066778",
            total_ht=Decimal("1900.00"),
            tva_lines=[_tva("0.14", "1200.00", "168.00"), _tva("0.07", "700.00", "49.00")],
            total_tva=Decimal("217.00"),
            total_ttc=Decimal("2117.00"),
            payment_terms="30 jours",
        ),
    ),
]


# Base-14 fonts have no Arabic glyph coverage (silently renders as missing-glyph
# dots, not an error), so bilingual lines need a separate Arabic-capable font for
# the Arabic run. Two draw calls per mixed line, not one insert_text call.
ARABIC_FONT_PATH = "/usr/share/fonts/truetype/noto/NotoSansArabic-Regular.ttf"
ARABIC_FONT_NAME = "notoarabic"


def render_invoice_pdf(spec: InvoiceSpec, output_path: Path) -> None:
    doc = fitz.open()
    page = doc.new_page()
    y = 72.0
    line_height = 18.0

    def write_line(text: str, size: float = 11.0) -> None:
        nonlocal y
        page.insert_text((72, y), text, fontsize=size)
        y += line_height

    def write_bilingual_line(text: str, size: float = 14.0) -> None:
        """Latin run in the default font, Arabic run in a Noto Sans Arabic font."""
        nonlocal y
        latin_part, _, arabic_part = text.partition(" / ")
        page.insert_text((72, y), f"{latin_part} / ", fontsize=size)
        if arabic_part:
            latin_width = fitz.get_text_length(f"{latin_part} / ", fontsize=size)
            page.insert_text(
                (72 + latin_width, y),
                arabic_part,
                fontsize=size,
                fontname=ARABIC_FONT_NAME,
                fontfile=ARABIC_FONT_PATH,
            )
        y += line_height

    inv = spec.extraction

    if spec.header_line:
        write_bilingual_line(spec.header_line, size=14.0)
    else:
        write_line("FACTURE", size=14.0)
    write_line("")
    write_line(f"{inv.supplier_name}")
    write_line(f"ICE: {inv.supplier_ice}   IF: {inv.supplier_if}")
    write_line("")
    write_line(f"Facture N: {inv.invoice_number}")
    write_line(f"Date: {inv.invoice_date.isoformat() if inv.invoice_date else ''}")
    if inv.due_date:
        write_line(f"Echeance: {inv.due_date.isoformat()}")
    write_line("")
    write_line(f"Client: {inv.customer_name}")
    if inv.customer_ice:
        write_line(f"ICE Client: {inv.customer_ice}")
    if inv.customer_if:
        write_line(f"IF Client: {inv.customer_if}")
    write_line("")
    write_line("Detail TVA:")
    for line in inv.tva_lines:
        write_line(f"  Base HT {line.base_ht}  x  TVA {line.rate * 100}%  =  {line.tva_amount} {inv.currency}")
    write_line("")
    write_line(f"Total HT:  {inv.total_ht} {inv.currency}")
    write_line(f"Total TVA: {inv.total_tva} {inv.currency}")
    write_line(f"Total TTC: {inv.total_ttc} {inv.currency}")
    write_line("")
    if inv.payment_terms:
        write_line(f"Conditions de paiement: {inv.payment_terms}")

    doc.save(output_path)
    doc.close()


def main() -> None:
    CORPUS_DIR.mkdir(parents=True, exist_ok=True)
    for spec in SPECS:
        pdf_path = CORPUS_DIR / f"{spec.name}.pdf"
        ground_truth_path = CORPUS_DIR / f"{spec.name}.ground_truth.json"
        render_invoice_pdf(spec, pdf_path)
        ground_truth_path.write_text(spec.extraction.model_dump_json(indent=2))
        print(f"wrote {pdf_path.name} + {ground_truth_path.name}")
    print(f"\n{len(SPECS)} synthetic invoices written to {CORPUS_DIR}")


if __name__ == "__main__":
    main()
