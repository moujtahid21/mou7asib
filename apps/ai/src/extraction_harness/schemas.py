"""Pydantic v2 schemas shared by ground truth and model output (CLAUDE.md §11).

The same InvoiceExtraction shape serves both roles so scoring is a direct
field-by-field diff between two instances of the same model.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict


class TvaLine(BaseModel):
    """One TVA rate line on an invoice. A single-rate invoice has one element."""

    model_config = ConfigDict(frozen=True)

    rate: Decimal
    base_ht: Decimal
    tva_amount: Decimal


class InvoiceExtraction(BaseModel):
    """CLAUDE.md §1 pillar-1 minimum extraction fields, plus mixed-rate TVA (§5.3)."""

    model_config = ConfigDict(frozen=True)

    invoice_number: str | None = None
    invoice_date: date | None = None
    due_date: date | None = None
    supplier_name: str | None = None
    # ICE/IF are strings, never ints — leading structure matters (mirrors
    # CLAUDE.md §5.1's account-code rule, applied to identifiers generally).
    supplier_ice: str | None = None
    supplier_if: str | None = None
    customer_name: str | None = None
    customer_ice: str | None = None
    customer_if: str | None = None
    currency: str = "MAD"
    total_ht: Decimal | None = None
    tva_lines: list[TvaLine] = []
    total_tva: Decimal | None = None
    total_ttc: Decimal | None = None
    payment_terms: str | None = None


class CostRecord(BaseModel):
    """The ADR 0005 cost-accounting tuple, plus compute_ms for local models.

    cost_minor_units is always 0 for a local Ollama call — recorded
    explicitly rather than omitted, per ADR 0005's instrumentation
    requirement that cost be queryable even when it is legitimately zero.
    """

    tenant_id: str
    document_id: str
    provider: str
    model: str
    prompt_version: str
    input_tokens: int
    output_tokens: int
    cost_minor_units: int
    compute_ms: int
    latency_ms: int
    attempt_number: int
    path: Literal["text_layer", "ocr"]


class ExtractionAttempt(BaseModel):
    """One attempt's outcome: either a validated extraction or None (flagged, not guessed)."""

    extraction: InvoiceExtraction | None
    cost: CostRecord
    raw_response: str
