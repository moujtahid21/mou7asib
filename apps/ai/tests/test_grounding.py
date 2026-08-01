from datetime import date
from decimal import Decimal
from pathlib import Path

import fitz

from extraction_harness.grounding import (
    TEXT_LAYER_AMBIGUOUS_CONFIDENCE,
    TEXT_LAYER_MATCH_CONFIDENCE,
    TEXT_LAYER_NO_MATCH_CONFIDENCE,
    _ground_via_text_layer,
    _search_candidates,
    ground_extraction,
)
from extraction_harness.schemas import InvoiceExtraction, TvaLine


def _write_pdf(path: Path, lines: list[str]) -> None:
    doc = fitz.open()
    page = doc.new_page()
    y = 72.0
    for line in lines:
        page.insert_text((72, y), line, fontsize=11)
        y += 18.0
    doc.save(path)
    doc.close()


def test_ground_via_text_layer_unambiguous_match(tmp_path: Path) -> None:
    pdf_path = tmp_path / "invoice.pdf"
    _write_pdf(pdf_path, ["FACTURE N: FA-2026-0001", "Total TTC: 1200.00 MAD"])
    doc = fitz.open(pdf_path)
    try:
        bbox, confidence = _ground_via_text_layer("FA-2026-0001", doc[0])
    finally:
        doc.close()

    assert bbox is not None
    assert confidence == TEXT_LAYER_MATCH_CONFIDENCE
    assert 0.0 <= bbox.x <= 1.0
    assert 0.0 <= bbox.y <= 1.0
    assert bbox.width > 0.0
    assert bbox.height > 0.0


def test_ground_via_text_layer_no_match(tmp_path: Path) -> None:
    pdf_path = tmp_path / "invoice.pdf"
    _write_pdf(pdf_path, ["FACTURE N: FA-2026-0001"])
    doc = fitz.open(pdf_path)
    try:
        bbox, confidence = _ground_via_text_layer("SOMETHING-NOT-PRESENT", doc[0])
    finally:
        doc.close()

    assert bbox is None
    assert confidence == TEXT_LAYER_NO_MATCH_CONFIDENCE


def test_ground_via_text_layer_ambiguous_multiple_matches_does_not_guess(tmp_path: Path) -> None:
    pdf_path = tmp_path / "invoice.pdf"
    _write_pdf(pdf_path, ["20.00 subtotal", "20.00 again"])
    doc = fitz.open(pdf_path)
    try:
        bbox, confidence = _ground_via_text_layer("20.00", doc[0])
    finally:
        doc.close()

    assert bbox is None
    assert confidence == TEXT_LAYER_AMBIGUOUS_CONFIDENCE


def test_ground_extraction_text_layer_grounds_known_fields(tmp_path: Path) -> None:
    pdf_path = tmp_path / "invoice.pdf"
    _write_pdf(
        pdf_path,
        [
            "FACTURE",
            "Atelier El Amrani",
            "Facture N: FA-2026-0001",
            "Total HT: 1000.00 MAD",
            "Total TVA: 200.00 MAD",
            "Total TTC: 1200.00 MAD",
        ],
    )
    extraction = InvoiceExtraction(
        invoice_number="FA-2026-0001",
        invoice_date=date(2026, 1, 10),
        supplier_name="Atelier El Amrani",
        total_ht=Decimal("1000.00"),
        tva_lines=[TvaLine(rate=Decimal("0.20"), base_ht=Decimal("1000.00"), tva_amount=Decimal("200.00"))],
        total_tva=Decimal("200.00"),
        total_ttc=Decimal("1200.00"),
    )

    fields = ground_extraction(extraction, "text_layer", pdf_path, arithmetic_ok=True)

    by_name = {(f.field_name, f.group_name, f.group_index): f for f in fields}

    invoice_number_field = by_name[("invoice_number", None, None)]
    assert invoice_number_field.confidence == TEXT_LAYER_MATCH_CONFIDENCE
    assert invoice_number_field.bounding_box is not None

    supplier_field = by_name[("supplier_name", None, None)]
    assert supplier_field.bounding_box is not None

    # due_date was never set (None) — must not be guessed at, zero confidence, no box.
    due_date_field = by_name[("due_date", None, None)]
    assert due_date_field.bounding_box is None
    assert due_date_field.confidence == 0.0

    # TVA line group fields present with the correct group indexing.
    tva_rate_field = by_name[("rate", "tva_lines", 0)]
    assert tva_rate_field.value_decimal == Decimal("0.20")


def test_search_candidates_includes_percentage_forms_for_rate() -> None:
    # Real gap found running the worker end to end: rates are stored/formatted
    # as decimal fractions (0.20) but invoices print them as percentages
    # (20.00%) — the canonical form alone never matches anything on the page.
    candidates = _search_candidates("rate", Decimal("0.20"), "0.20")
    assert "0.20" in candidates
    assert any("20" in c and "%" in c for c in candidates)


def test_search_candidates_unchanged_for_non_rate_fields() -> None:
    candidates = _search_candidates("total_ttc", Decimal("1200.00"), "1200.00")
    assert candidates == ["1200.00"]


def test_ground_extraction_finds_rate_printed_as_percentage(tmp_path: Path) -> None:
    pdf_path = tmp_path / "invoice.pdf"
    _write_pdf(pdf_path, ["Base HT 1000.00  x  TVA 20.00%  =  200.00 MAD"])
    extraction = InvoiceExtraction(
        tva_lines=[TvaLine(rate=Decimal("0.20"), base_ht=Decimal("1000.00"), tva_amount=Decimal("200.00"))],
    )

    fields = ground_extraction(extraction, "text_layer", pdf_path, arithmetic_ok=None)
    by_name = {(f.field_name, f.group_name, f.group_index): f for f in fields}

    rate_field = by_name[("rate", "tva_lines", 0)]
    assert rate_field.bounding_box is not None
    assert rate_field.confidence == TEXT_LAYER_MATCH_CONFIDENCE
