"""Append-only JSONL log for the ADR 0005 cost-accounting tuple.

No SQLite/Postgres — unjustified for a few dozen records in a throwaway
spike (ADR 0006: D1 needs no database). Trivially jq-able for debugging.
"""

from __future__ import annotations

from pathlib import Path

from extraction_harness.schemas import CostRecord


def append_cost_record(log_path: Path, record: CostRecord) -> None:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("a", encoding="utf-8") as f:
        f.write(record.model_dump_json() + "\n")


def read_cost_records(log_path: Path) -> list[CostRecord]:
    if not log_path.exists():
        return []
    with log_path.open("r", encoding="utf-8") as f:
        return [CostRecord.model_validate_json(line) for line in f if line.strip()]


def render_cost_table(records: list[CostRecord], total_documents: int, run_id: str) -> str:
    """The literal Definition-of-Done artifact: cost-per-document-by-path, as text."""
    by_path: dict[str, list[CostRecord]] = {}
    for record in records:
        by_path.setdefault(record.path, []).append(record)

    lines = [f"Cost per document by path (n={total_documents} documents, run {run_id})"]
    lines.append(
        f"{'path':<12} {'n':>4} {'avg_cost_minor':>15} {'avg_compute_ms':>15} "
        f"{'avg_latency_ms':>15} {'retry_rate':>11}"
    )
    for path in sorted(by_path):
        path_records = by_path[path]
        document_count = len({r.document_id for r in path_records})
        avg_cost = sum(r.cost_minor_units for r in path_records) / len(path_records)
        avg_compute = sum(r.compute_ms for r in path_records) / len(path_records)
        avg_latency = sum(r.latency_ms for r in path_records) / len(path_records)
        retry_rate = sum(1 for r in path_records if r.attempt_number > 1) / len(path_records)
        lines.append(
            f"{path:<12} {document_count:>4} {avg_cost:>15.0f} {avg_compute:>15.0f} "
            f"{avg_latency:>15.0f} {retry_rate * 100:>10.1f}%"
        )
    return "\n".join(lines)
