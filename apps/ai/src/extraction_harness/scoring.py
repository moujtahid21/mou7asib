"""Per-field accuracy scoring and the arithmetic cross-check (CLAUDE.md §7.2, §6).

Never compares Decimal amounts with bare == (CLAUDE.md §6) — every comparison
goes through amounts_equal, one explicit tolerance helper, mirroring the rule
CLAUDE.md §6 states for the TS side of this codebase.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Literal

from pydantic import BaseModel

from extraction_harness.schemas import InvoiceExtraction, TvaLine

FieldStatus = Literal["correct", "wrong", "missing", "correctly_null", "hallucinated"]

DEFAULT_AMOUNT_TOLERANCE = Decimal("0.01")
RATE_TOLERANCE = Decimal("0.0001")

# Scalar fields scored by simple equality after normalization.
_STRING_FIELDS = (
    "invoice_number",
    "supplier_name",
    "customer_name",
    "payment_terms",
)
_ID_FIELDS = ("supplier_ice", "supplier_if", "customer_ice", "customer_if")
_DATE_FIELDS = ("invoice_date", "due_date")
_AMOUNT_FIELDS = ("total_ht", "total_tva", "total_ttc")


def amounts_equal(a: Decimal | None, b: Decimal | None, tolerance: Decimal = DEFAULT_AMOUNT_TOLERANCE) -> bool:
    """The one explicit tolerance helper for comparing two amounts. Never use == directly."""
    if a is None or b is None:
        return a is None and b is None
    return abs(a - b) <= tolerance


def _normalize_id(value: str | None) -> str | None:
    if value is None:
        return None
    return "".join(ch for ch in value if ch.isdigit())


def _normalize_string(value: str | None) -> str | None:
    if value is None:
        return None
    return " ".join(value.split()).casefold()


def _score_scalar(truth: object, extracted: object, equal: bool) -> FieldStatus:
    if truth is None and extracted is None:
        return "correctly_null"
    if truth is None and extracted is not None:
        return "hallucinated"
    if truth is not None and extracted is None:
        return "missing"
    return "correct" if equal else "wrong"


class FieldResult(BaseModel):
    status: FieldStatus


class TvaLineMatchResult(BaseModel):
    rate: Decimal
    base_ht: FieldResult
    tva_amount: FieldResult


class DocumentScore(BaseModel):
    fields: dict[str, FieldResult]
    tva_line_matches: list[TvaLineMatchResult]
    unmatched_ground_truth_rates: list[Decimal]
    unmatched_extracted_rates: list[Decimal]
    overall_accuracy: float


def match_tva_lines(
    ground_truth: list[TvaLine], extracted: list[TvaLine]
) -> tuple[list[TvaLineMatchResult], list[Decimal], list[Decimal]]:
    """Match TVA lines by rate (the natural key — no duplicate rates on one invoice)."""
    truth_by_rate = {line.rate: line for line in ground_truth}
    extracted_by_rate = {line.rate: line for line in extracted}

    matches: list[TvaLineMatchResult] = []
    for rate, truth_line in truth_by_rate.items():
        extracted_line = extracted_by_rate.get(rate)
        if extracted_line is None:
            continue
        matches.append(
            TvaLineMatchResult(
                rate=rate,
                base_ht=FieldResult(
                    status=_score_scalar(
                        truth_line.base_ht,
                        extracted_line.base_ht,
                        amounts_equal(truth_line.base_ht, extracted_line.base_ht),
                    )
                ),
                tva_amount=FieldResult(
                    status=_score_scalar(
                        truth_line.tva_amount,
                        extracted_line.tva_amount,
                        amounts_equal(truth_line.tva_amount, extracted_line.tva_amount),
                    )
                ),
            )
        )

    unmatched_ground_truth = sorted(set(truth_by_rate) - set(extracted_by_rate))
    unmatched_extracted = sorted(set(extracted_by_rate) - set(truth_by_rate))
    return matches, unmatched_ground_truth, unmatched_extracted


def check_arithmetic(extraction: InvoiceExtraction, tolerance: Decimal = DEFAULT_AMOUNT_TOLERANCE) -> bool:
    """HT + TVA == TTC, summed across tva_lines, independent of the model's confidence."""
    if extraction.total_ht is None or extraction.total_tva is None or extraction.total_ttc is None:
        return False
    computed_ht = sum((line.base_ht for line in extraction.tva_lines), start=Decimal(0))
    computed_tva = sum((line.tva_amount for line in extraction.tva_lines), start=Decimal(0))
    if extraction.tva_lines:
        if not amounts_equal(computed_ht, extraction.total_ht, tolerance):
            return False
        if not amounts_equal(computed_tva, extraction.total_tva, tolerance):
            return False
    return amounts_equal(extraction.total_ht + extraction.total_tva, extraction.total_ttc, tolerance)


def score_document(ground_truth: InvoiceExtraction, extracted: InvoiceExtraction) -> DocumentScore:
    """Field-by-field diff between ground truth and an extraction, same schema on both sides."""
    fields: dict[str, FieldResult] = {}

    for name in _STRING_FIELDS:
        truth_value = _normalize_string(getattr(ground_truth, name))
        extracted_value = _normalize_string(getattr(extracted, name))
        fields[name] = FieldResult(
            status=_score_scalar(truth_value, extracted_value, truth_value == extracted_value)
        )

    for name in _ID_FIELDS:
        truth_value = _normalize_id(getattr(ground_truth, name))
        extracted_value = _normalize_id(getattr(extracted, name))
        fields[name] = FieldResult(
            status=_score_scalar(truth_value, extracted_value, truth_value == extracted_value)
        )

    for name in _DATE_FIELDS:
        truth_value = getattr(ground_truth, name)
        extracted_value = getattr(extracted, name)
        fields[name] = FieldResult(
            status=_score_scalar(truth_value, extracted_value, truth_value == extracted_value)
        )

    for name in _AMOUNT_FIELDS:
        truth_value = getattr(ground_truth, name)
        extracted_value = getattr(extracted, name)
        fields[name] = FieldResult(
            status=_score_scalar(truth_value, extracted_value, amounts_equal(truth_value, extracted_value))
        )

    truth_currency = ground_truth.currency.upper()
    extracted_currency = extracted.currency.upper()
    fields["currency"] = FieldResult(
        status="correct" if truth_currency == extracted_currency else "wrong"
    )

    matches, unmatched_truth, unmatched_extracted = match_tva_lines(
        ground_truth.tva_lines, extracted.tva_lines
    )
    for match in matches:
        fields[f"tva_lines[rate={match.rate}].base_ht"] = match.base_ht
        fields[f"tva_lines[rate={match.rate}].tva_amount"] = match.tva_amount
    for rate in unmatched_truth:
        fields[f"tva_lines[rate={rate}]"] = FieldResult(status="missing")
    for rate in unmatched_extracted:
        fields[f"tva_lines[rate={rate}]"] = FieldResult(status="hallucinated")

    correct_count = sum(
        1 for result in fields.values() if result.status in ("correct", "correctly_null")
    )
    overall_accuracy = correct_count / len(fields) if fields else 0.0

    return DocumentScore(
        fields=fields,
        tva_line_matches=matches,
        unmatched_ground_truth_rates=unmatched_truth,
        unmatched_extracted_rates=unmatched_extracted,
        overall_accuracy=overall_accuracy,
    )


def aggregate_field_accuracy(document_scores: list[DocumentScore]) -> dict[str, dict[FieldStatus, int]]:
    """Sum per-field status counts across every document in a run."""
    counts: dict[str, dict[FieldStatus, int]] = {}
    for score in document_scores:
        for field_name, result in score.fields.items():
            field_counts = counts.setdefault(
                field_name,
                {"correct": 0, "wrong": 0, "missing": 0, "correctly_null": 0, "hallucinated": 0},
            )
            field_counts[result.status] += 1
    return counts


def render_accuracy_table(document_scores: list[DocumentScore], arithmetic_results: list[bool]) -> str:
    """The literal Definition-of-Done artifact: a per-field accuracy table as text."""
    counts = aggregate_field_accuracy(document_scores)
    lines = [f"Per-field accuracy (n={len(document_scores)} documents)"]
    lines.append(
        f"{'field':<34} {'correct':>7} {'wrong':>7} {'missing':>7} {'correctly_null':>14} {'accuracy':>9}"
    )
    for field_name in sorted(counts):
        c = counts[field_name]
        total = sum(c.values())
        accuracy = (c["correct"] + c["correctly_null"]) / total if total else 0.0
        wrong_display = c["wrong"] + c["hallucinated"]
        lines.append(
            f"{field_name:<34} {c['correct']:>7} {wrong_display:>7} {c['missing']:>7} "
            f"{c['correctly_null']:>14} {accuracy * 100:>8.1f}%"
        )
    if arithmetic_results:
        ok = sum(1 for r in arithmetic_results if r)
        bad = len(arithmetic_results) - ok
        accuracy = ok / len(arithmetic_results)
        lines.append(
            f"{'arithmetic_check':<34} {ok:>7} {bad:>7} {'-':>7} {'-':>14} {accuracy * 100:>8.1f}%"
        )
    return "\n".join(lines)
