"""Cheap-path (PDF text layer) vs OCR/vision-path routing (ADR 0005's P(cheap path) lever)."""

from __future__ import annotations

from pathlib import Path
from typing import Literal

import fitz  # PyMuPDF

# Below this many non-whitespace characters, treat the text layer as absent
# (a scanned PDF often has a few stray characters, not a real layer).
MIN_TEXT_LAYER_CHARS = 20


def extract_text_layer(pdf_path: Path) -> str:
    """Concatenate the text layer across all pages of a PDF. Empty string if none."""
    with fitz.open(pdf_path) as doc:
        return "".join(page.get_text() for page in doc)


def decide_path(document_path: Path) -> Literal["text_layer", "ocr"]:
    """Pure routing decision: does this document have a usable PDF text layer?"""
    if document_path.suffix.lower() != ".pdf":
        # Images (degraded corpus, phone photos) never have a text layer.
        return "ocr"

    text = extract_text_layer(document_path)
    non_whitespace = "".join(text.split())
    if len(non_whitespace) >= MIN_TEXT_LAYER_CHARS:
        return "text_layer"
    return "ocr"


def rasterize_first_page(pdf_path: Path, output_path: Path, zoom: float = 2.0) -> Path:
    """Render a PDF's first page to a PNG for the vision path. Returns output_path."""
    with fitz.open(pdf_path) as doc:
        page = doc[0]
        matrix = fitz.Matrix(zoom, zoom)
        pixmap = page.get_pixmap(matrix=matrix)
        pixmap.save(output_path)
    return output_path
