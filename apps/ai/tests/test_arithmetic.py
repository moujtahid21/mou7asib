from datetime import date
from decimal import Decimal

from extraction_harness.schemas import InvoiceExtraction, TvaLine
from extraction_harness.scoring import check_arithmetic


def test_arithmetic_passes_when_balanced_single_rate() -> None:
    extraction = InvoiceExtraction(
        invoice_date=date(2026, 1, 1),
        total_ht=Decimal("1000.00"),
        tva_lines=[TvaLine(rate=Decimal("0.20"), base_ht=Decimal("1000.00"), tva_amount=Decimal("200.00"))],
        total_tva=Decimal("200.00"),
        total_ttc=Decimal("1200.00"),
    )
    assert check_arithmetic(extraction) is True


def test_arithmetic_passes_when_balanced_mixed_rate() -> None:
    extraction = InvoiceExtraction(
        total_ht=Decimal("1500.00"),
        tva_lines=[
            TvaLine(rate=Decimal("0.20"), base_ht=Decimal("1000.00"), tva_amount=Decimal("200.00")),
            TvaLine(rate=Decimal("0.14"), base_ht=Decimal("500.00"), tva_amount=Decimal("70.00")),
        ],
        total_tva=Decimal("270.00"),
        total_ttc=Decimal("1770.00"),
    )
    assert check_arithmetic(extraction) is True


def test_arithmetic_fails_when_ttc_does_not_match() -> None:
    extraction = InvoiceExtraction(
        total_ht=Decimal("1000.00"),
        tva_lines=[TvaLine(rate=Decimal("0.20"), base_ht=Decimal("1000.00"), tva_amount=Decimal("200.00"))],
        total_tva=Decimal("200.00"),
        total_ttc=Decimal("999.99"),
    )
    assert check_arithmetic(extraction) is False


def test_arithmetic_fails_when_totals_missing() -> None:
    extraction = InvoiceExtraction(total_ht=Decimal("1000.00"))
    assert check_arithmetic(extraction) is False
