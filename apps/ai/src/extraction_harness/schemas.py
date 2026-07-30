"""Pydantic v2 schemas shared by ground truth and model output (CLAUDE.md §11).

The same InvoiceExtraction shape serves both roles so scoring is a direct
field-by-field diff between two instances of the same model.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, field_validator


class TvaLine(BaseModel):
    """One TVA rate line on an invoice. A single-rate invoice has one element."""

    model_config = ConfigDict(frozen=True)

    rate: Decimal  # decimal fraction, e.g. 0.20 for 20% — never 20
    base_ht: Decimal
    tva_amount: Decimal

    @field_validator("rate")
    @classmethod
    def _rate_is_a_fraction_not_a_percentage(cls, value: Decimal) -> Decimal:
        # Moroccan TVA rates in use are 0%, 7%, 10%, 14%, 20% (CLAUDE.md §5.3) — as
        # fractions, always <= 0.20. A model that returns "20" instead of "0.20" fails
        # here and the retry loop (extract.py) feeds this error back for self-correction,
        # rather than silently accepting a rate 100x too large.
        if value > Decimal(1):
            raise ValueError(
                f"rate must be a decimal fraction (e.g. 0.20 for 20%), got {value} "
                "which looks like a percentage — divide by 100"
            )
        return value


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
