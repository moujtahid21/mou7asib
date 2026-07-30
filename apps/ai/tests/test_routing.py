from pathlib import Path

import fitz

from extraction_harness.routing import decide_path, extract_text_layer, rasterize_first_page


def _write_pdf_with_text(path: Path, text: str) -> None:
    doc = fitz.open()
    page = doc.new_page()
    if text:
        page.insert_text((72, 72), text)
    doc.save(path)
    doc.close()


def test_decide_path_routes_pdf_with_text_layer_to_text_layer(tmp_path: Path) -> None:
    pdf_path = tmp_path / "invoice_with_text.pdf"
    _write_pdf_with_text(pdf_path, "FACTURE N 001 - Total TTC 1200.00 MAD ICE 001234567000045")

    assert decide_path(pdf_path) == "text_layer"


def test_decide_path_routes_pdf_without_text_layer_to_ocr(tmp_path: Path) -> None:
    pdf_path = tmp_path / "scanned_invoice.pdf"
    _write_pdf_with_text(pdf_path, "")

    assert decide_path(pdf_path) == "ocr"


def test_decide_path_routes_image_to_ocr(tmp_path: Path) -> None:
    image_path = tmp_path / "photo.jpg"
    image_path.write_bytes(b"\xff\xd8\xff\xe0not a real jpeg but has the right suffix")

    assert decide_path(image_path) == "ocr"


def test_extract_text_layer_returns_empty_string_for_blank_pdf(tmp_path: Path) -> None:
    pdf_path = tmp_path / "blank.pdf"
    _write_pdf_with_text(pdf_path, "")

    assert extract_text_layer(pdf_path).strip() == ""


def test_rasterize_first_page_produces_a_png(tmp_path: Path) -> None:
    pdf_path = tmp_path / "invoice.pdf"
    _write_pdf_with_text(pdf_path, "FACTURE N 002")
    output_path = tmp_path / "page.png"

    result = rasterize_first_page(pdf_path, output_path)

    assert result == output_path
    assert output_path.exists()
    assert output_path.stat().st_size > 0
