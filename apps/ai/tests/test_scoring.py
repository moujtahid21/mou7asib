"""The required S1a 'proof' test: the harness must score a deliberately wrong
extraction correctly. No Ollama dependency — pure scoring-logic tests.
"""

from datetime import date
from decimal import Decimal

from extraction_harness.schemas import InvoiceExtraction, TvaLine
from extraction_harness.scoring import check_arithmetic, score_document


def _sample_ground_truth() -> InvoiceExtraction:
    return InvoiceExtraction(
        invoice_number="FA-2026-001",
        invoice_date=date(2026, 3, 15),
        supplier_name="Atelier El Amrani",
        supplier_ice="001234567000045",
        supplier_if="12345678",
        customer_name="Client Test SARL",
        customer_ice="009876543000012",
        currency="MAD",
        total_ht=Decimal("1000.00"),
        tva_lines=[TvaLine(rate=Decimal("0.20"), base_ht=Decimal("1000.00"), tva_amount=Decimal("200.00"))],
        total_tva=Decimal("200.00"),
        total_ttc=Decimal("1200.00"),
        payment_terms="30 jours",
    )


def test_scoring_catches_deliberately_wrong_extraction() -> None:
    ground_truth = _sample_ground_truth()
    wrong = ground_truth.model_copy(
        update={
            "total_ttc": Decimal("999.99"),
            "invoice_number": "FA-2026-999",
            "supplier_ice": None,
        }
    )

    result = score_document(ground_truth, wrong)

    assert result.fields["total_ttc"].status == "wrong"
    assert result.fields["invoice_number"].status == "wrong"
    assert result.fields["supplier_ice"].status == "missing"
    assert result.overall_accuracy < 1.0
    assert check_arithmetic(wrong) is False


def test_scoring_passes_correct_extraction() -> None:
    ground_truth = _sample_ground_truth()
    extracted = ground_truth.model_copy(deep=True)

    result = score_document(ground_truth, extracted)

    assert result.overall_accuracy == 1.0
    assert all(field.status in ("correct", "correctly_null") for field in result.fields.values())
    assert check_arithmetic(extracted) is True


def test_scoring_flags_hallucinated_field() -> None:
    ground_truth = _sample_ground_truth().model_copy(update={"due_date": None})
    extracted = ground_truth.model_copy(update={"due_date": date(2026, 4, 15)})

    result = score_document(ground_truth, extracted)

    assert result.fields["due_date"].status == "hallucinated"


def test_scoring_matches_mixed_rate_tva_lines_by_rate() -> None:
    ground_truth = _sample_ground_truth().model_copy(
        update={
            "tva_lines": [
                TvaLine(rate=Decimal("0.20"), base_ht=Decimal("1000.00"), tva_amount=Decimal("200.00")),
                TvaLine(rate=Decimal("0.14"), base_ht=Decimal("500.00"), tva_amount=Decimal("70.00")),
            ]
        }
    )
    extracted = ground_truth.model_copy(
        update={
            "tva_lines": [
                TvaLine(rate=Decimal("0.20"), base_ht=Decimal("1000.00"), tva_amount=Decimal("200.00")),
                # 14% line missing entirely from the extraction.
            ]
        }
    )

    result = score_document(ground_truth, extracted)

    assert result.unmatched_ground_truth_rates == [Decimal("0.14")]
    assert result.fields["tva_lines[rate=0.14]"].status == "missing"
