"""Locates each extracted field's value on the source document and assigns a
computed confidence — never the model's own self-reported confidence, which
is poorly calibrated by nature (and, per the D2 grounding spike, Ollama
doesn't expose the metadata needed to even correctly rescale Qwen2.5-VL's own
reported bounding boxes back to the original image — see the D2 plan).

Two paths, mirroring routing.py's cheap/OCR split:
- text_layer: PyMuPDF's page.search_for() — exact rects in PDF point-space,
  essentially free.
- ocr: word-level Tesseract OCR + rapidfuzz matching. Confidence is a
  computed blend of fuzzy-match score, Tesseract's own word confidence, and
  (for amount fields) whether the document's arithmetic cross-check passed.

The OCR path needs an actual raster image to hand to Tesseract — for a real
photo/scan, document_path already is one. For a scanned/no-text-layer PDF
(reachable once PDF upload exists), document_path is a PDF and PIL cannot
open it directly; ground_extraction's ocr_image_path parameter lets the
caller supply a pre-rasterized image instead (the worker already produces
one for display purposes when the source is a PDF — see worker.py).
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path
from typing import Literal

import fitz
import pytesseract
from pytesseract import Output
from rapidfuzz import fuzz

from extraction_harness.schemas import BoundingBox, GroundedField, InvoiceExtraction

# Below this fuzzy-match score (0-100), treat as "not found" rather than
# guessing a rect (CLAUDE.md §7.2's "flag rather than guess," applied to
# localization, not just extraction).
MATCH_SCORE_FLOOR = 70.0

TEXT_LAYER_MATCH_CONFIDENCE = 0.95
TEXT_LAYER_NO_MATCH_CONFIDENCE = 0.3
TEXT_LAYER_AMBIGUOUS_CONFIDENCE = 0.5

_DECIMAL_FIELD_NAMES = {"total_ht", "total_tva", "total_ttc"}


def _format_value(value: object) -> str | None:
    """String form of a field value for searching the document text/OCR output."""
    if value is None:
        return None
    if isinstance(value, Decimal):
        return f"{value:.2f}"
    from datetime import date

    if isinstance(value, date):
        return value.isoformat()
    return str(value)


@dataclass(frozen=True)
class OcrWord:
    text: str
    confidence: float  # Tesseract's own 0-100 word confidence
    left: int
    top: int
    width: int
    height: int
    line_key: tuple[int, int, int]  # (block_num, par_num, line_num)


@dataclass(frozen=True)
class OcrDocument:
    words: list[OcrWord]
    image_width: int
    image_height: int


def run_ocr(image_path: Path) -> OcrDocument:
    """Word-level OCR via Tesseract, French + Arabic (Moroccan invoices are often bilingual)."""
    from PIL import Image

    with Image.open(image_path) as image:
        image_width, image_height = image.size
        data = pytesseract.image_to_data(
            image, lang="fra+ara+eng", output_type=Output.DICT
        )

    words: list[OcrWord] = []
    for i, text in enumerate(data["text"]):
        stripped = text.strip()
        if not stripped:
            continue
        conf_raw = data["conf"][i]
        confidence = float(conf_raw) if float(conf_raw) >= 0 else 0.0
        words.append(
            OcrWord(
                text=stripped,
                confidence=confidence,
                left=int(data["left"][i]),
                top=int(data["top"][i]),
                width=int(data["width"][i]),
                height=int(data["height"][i]),
                line_key=(int(data["block_num"][i]), int(data["par_num"][i]), int(data["line_num"][i])),
            )
        )
    return OcrDocument(words=words, image_width=image_width, image_height=image_height)


def _line_spans(ocr: OcrDocument) -> list[tuple[str, float, int, int, int, int]]:
    """Group words into lines: (text, avg_confidence, left, top, right, bottom)."""
    lines: dict[tuple[int, int, int], list[OcrWord]] = {}
    for word in ocr.words:
        lines.setdefault(word.line_key, []).append(word)

    spans: list[tuple[str, float, int, int, int, int]] = []
    for line_words in lines.values():
        text = " ".join(w.text for w in line_words)
        avg_conf = sum(w.confidence for w in line_words) / len(line_words)
        left = min(w.left for w in line_words)
        top = min(w.top for w in line_words)
        right = max(w.left + w.width for w in line_words)
        bottom = max(w.top + w.height for w in line_words)
        spans.append((text, avg_conf, left, top, right, bottom))
    return spans


def _ground_via_ocr(value: str, ocr: OcrDocument, is_amount_field: bool, arithmetic_ok: bool | None) -> tuple[BoundingBox | None, float]:
    candidates: list[tuple[str, float, int, int, int, int]] = [
        (w.text, w.confidence, w.left, w.top, w.left + w.width, w.top + w.height) for w in ocr.words
    ]
    candidates.extend(_line_spans(ocr))

    best_score = -1.0
    best: tuple[str, float, int, int, int, int] | None = None
    for candidate in candidates:
        score = fuzz.ratio(value.casefold(), candidate[0].casefold())
        if score > best_score:
            best_score = score
            best = candidate

    if best is None or best_score < MATCH_SCORE_FLOOR:
        return None, 0.2

    _, word_conf, left, top, right, bottom = best
    confidence = (best_score / 100.0) * 0.6 + (word_conf / 100.0) * 0.4

    if is_amount_field and arithmetic_ok is not None:
        confidence = confidence + 0.05 if arithmetic_ok else confidence - 0.2
    confidence = max(0.0, min(1.0, confidence))

    if ocr.image_width == 0 or ocr.image_height == 0:
        return None, confidence

    bbox = BoundingBox(
        x=left / ocr.image_width,
        y=top / ocr.image_height,
        width=(right - left) / ocr.image_width,
        height=(bottom - top) / ocr.image_height,
    )
    return bbox, confidence


def _ground_via_text_layer(value: str, page: fitz.Page) -> tuple[BoundingBox | None, float]:
    rects = page.search_for(value)
    page_width, page_height = page.rect.width, page.rect.height
    if not rects or page_width == 0 or page_height == 0:
        return None, TEXT_LAYER_NO_MATCH_CONFIDENCE
    if len(rects) > 1:
        # Ambiguous — multiple occurrences, don't guess which one is right.
        return None, TEXT_LAYER_AMBIGUOUS_CONFIDENCE

    rect = rects[0]
    bbox = BoundingBox(
        x=rect.x0 / page_width,
        y=rect.y0 / page_height,
        width=(rect.x1 - rect.x0) / page_width,
        height=(rect.y1 - rect.y0) / page_height,
    )
    return bbox, TEXT_LAYER_MATCH_CONFIDENCE


def _search_candidates(field_name: str, value: object, formatted: str) -> list[str]:
    """Extra string forms worth searching for, beyond the canonical formatted value.

    Rates are stored/formatted as decimal fractions (0.20) but real invoices
    print them as percentages (20%, 20.00%) — a real gap found by running
    the worker end to end: every tva_lines.rate field went ungrounded until
    this was added. Try both forms rather than only the canonical one.
    """
    candidates = [formatted]
    if field_name == "rate" and isinstance(value, Decimal):
        percentage = value * 100
        candidates.append(f"{percentage:.0f}%")
        candidates.append(f"{percentage:.1f}%")
        candidates.append(f"{percentage:.2f}%")
    return candidates


def _ground_one(
    field_name: str,
    value: object,
    field_type: Literal["string", "date", "decimal"],
    path: Literal["text_layer", "ocr"],
    page: fitz.Page | None,
    ocr: OcrDocument | None,
    arithmetic_ok: bool | None,
    group_name: str | None = None,
    group_index: int | None = None,
) -> GroundedField:
    formatted = _format_value(value)
    if formatted is None:
        return GroundedField(
            field_name=field_name,
            group_name=group_name,
            group_index=group_index,
            field_type=field_type,
            value_text=None,
            value_decimal=None,
            confidence=0.0,
            bounding_box=None,
        )

    is_amount = field_name in _DECIMAL_FIELD_NAMES or field_type == "decimal"

    best_bbox: BoundingBox | None = None
    best_confidence = 0.0
    for candidate in _search_candidates(field_name, value, formatted):
        if path == "text_layer" and page is not None:
            bbox, confidence = _ground_via_text_layer(candidate, page)
        elif ocr is not None:
            bbox, confidence = _ground_via_ocr(candidate, ocr, is_amount, arithmetic_ok)
        else:
            bbox, confidence = None, 0.0

        found_improves = bbox is not None and (best_bbox is None or confidence > best_confidence)
        not_found_improves = bbox is None and best_bbox is None and confidence > best_confidence
        if found_improves or not_found_improves:
            best_bbox, best_confidence = bbox, confidence

    return GroundedField(
        field_name=field_name,
        group_name=group_name,
        group_index=group_index,
        field_type=field_type,
        value_text=formatted if field_type != "decimal" else None,
        value_decimal=value if field_type == "decimal" and isinstance(value, Decimal) else None,
        confidence=best_confidence,
        bounding_box=best_bbox,
    )


_SCALAR_STRING_FIELDS = (
    "invoice_number",
    "supplier_name",
    "supplier_ice",
    "supplier_if",
    "customer_name",
    "customer_ice",
    "customer_if",
    "currency",
    "payment_terms",
)
_SCALAR_DATE_FIELDS = ("invoice_date", "due_date")
_SCALAR_DECIMAL_FIELDS = ("total_ht", "total_tva", "total_ttc")


def ground_extraction(
    extraction: InvoiceExtraction,
    path: Literal["text_layer", "ocr"],
    document_path: Path,
    arithmetic_ok: bool | None,
    ocr_image_path: Path | None = None,
) -> list[GroundedField]:
    """Ground every non-null field in an extraction against its source document.

    ocr_image_path: the actual raster image to OCR, if different from
    document_path (e.g. document_path is a PDF — PIL can't open that
    directly). Defaults to document_path, the correct behaviour for a real
    image file.
    """
    page: fitz.Page | None = None
    doc: fitz.Document | None = None
    ocr: OcrDocument | None = None

    if path == "text_layer":
        doc = fitz.open(document_path)
        page = doc[0]
    else:
        ocr = run_ocr(ocr_image_path if ocr_image_path is not None else document_path)

    try:
        fields: list[GroundedField] = []

        for name in _SCALAR_STRING_FIELDS:
            fields.append(
                _ground_one(name, getattr(extraction, name), "string", path, page, ocr, arithmetic_ok)
            )
        for name in _SCALAR_DATE_FIELDS:
            fields.append(
                _ground_one(name, getattr(extraction, name), "date", path, page, ocr, arithmetic_ok)
            )
        for name in _SCALAR_DECIMAL_FIELDS:
            fields.append(
                _ground_one(name, getattr(extraction, name), "decimal", path, page, ocr, arithmetic_ok)
            )

        for index, line in enumerate(extraction.tva_lines):
            for field_name in ("rate", "base_ht", "tva_amount"):
                value: Decimal = getattr(line, field_name)
                fields.append(
                    _ground_one(
                        field_name,
                        value,
                        "decimal",
                        path,
                        page,
                        ocr,
                        arithmetic_ok,
                        group_name="tva_lines",
                        group_index=index,
                    )
                )

        return fields
    finally:
        if doc is not None:
            doc.close()
