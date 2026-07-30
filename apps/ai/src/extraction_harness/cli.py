"""`run` and `score` subcommands. `run` is S1a's literal Definition of Done:
one command over a document folder emits a per-field accuracy table and a
cost-per-document-by-path breakdown.
"""

from __future__ import annotations

import argparse
import json
import tempfile
from datetime import UTC, datetime
from pathlib import Path

from extraction_harness.costlog import append_cost_record, read_cost_records, render_cost_table
from extraction_harness.extract import extract_document
from extraction_harness.schemas import InvoiceExtraction
from extraction_harness.scoring import (
    DocumentScore,
    aggregate_field_accuracy,
    check_arithmetic,
    render_accuracy_table,
    score_document,
)

DOCUMENT_SUFFIXES = (".pdf", ".jpg", ".jpeg", ".png")


def _find_document_ground_truth_pairs(input_dir: Path) -> list[tuple[Path, Path]]:
    pairs: list[tuple[Path, Path]] = []
    for document_path in sorted(input_dir.iterdir()):
        if document_path.suffix.lower() not in DOCUMENT_SUFFIXES:
            continue
        ground_truth_path = document_path.with_suffix("").with_suffix(".ground_truth.json")
        if ground_truth_path.exists():
            pairs.append((document_path, ground_truth_path))
    return pairs


def _default_run_id() -> str:
    return datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")


def cmd_run(args: argparse.Namespace) -> None:
    input_dir = Path(args.input_dir)
    pairs = _find_document_ground_truth_pairs(input_dir)
    if not pairs:
        raise SystemExit(f"No document/.ground_truth.json pairs found under {input_dir}")

    run_dir = Path("apps/ai/runs") / args.run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    cost_log_path = run_dir / "cost_log.jsonl"
    results_path = run_dir / "results.jsonl"

    document_scores: list[DocumentScore] = []
    arithmetic_results: list[bool] = []

    with tempfile.TemporaryDirectory() as tmp_dir_str, results_path.open("w", encoding="utf-8") as results_file:
        tmp_dir = Path(tmp_dir_str)
        for document_path, ground_truth_path in pairs:
            ground_truth = InvoiceExtraction.model_validate_json(ground_truth_path.read_text())

            attempts = extract_document(
                document_path,
                model=args.model,
                prompt_version=args.prompt_version,
                tmp_dir=tmp_dir,
                max_attempts=args.max_attempts,
            )
            for attempt in attempts:
                append_cost_record(cost_log_path, attempt.cost)

            final_extraction = attempts[-1].extraction if attempts else None
            scored_extraction = final_extraction if final_extraction is not None else InvoiceExtraction()
            score = score_document(ground_truth, scored_extraction)
            arithmetic_ok = check_arithmetic(final_extraction) if final_extraction is not None else False

            document_scores.append(score)
            arithmetic_results.append(arithmetic_ok)

            results_file.write(
                json.dumps(
                    {
                        "document_path": str(document_path),
                        "path": attempts[-1].cost.path if attempts else None,
                        "attempts": len(attempts),
                        "extraction": final_extraction.model_dump(mode="json") if final_extraction else None,
                        "score": score.model_dump(mode="json"),
                        "arithmetic_ok": arithmetic_ok,
                    }
                )
                + "\n"
            )

    cost_records = read_cost_records(cost_log_path)
    accuracy_table = render_accuracy_table(document_scores, arithmetic_results)
    cost_table = render_cost_table(cost_records, total_documents=len(pairs), run_id=args.run_id)

    print(accuracy_table)
    print()
    print(cost_table)

    summary = {
        "run_id": args.run_id,
        "model": args.model,
        "prompt_version": args.prompt_version,
        "documents": len(pairs),
        "field_accuracy": aggregate_field_accuracy(document_scores),
        "arithmetic_pass_rate": sum(arithmetic_results) / len(arithmetic_results) if arithmetic_results else 0.0,
    }
    (run_dir / "summary.json").write_text(json.dumps(summary, indent=2, default=str))
    print(f"\nWrote {results_path} and {run_dir / 'summary.json'}")


def cmd_score(args: argparse.Namespace) -> None:
    results_path = Path("apps/ai/runs") / args.run_id / "results.jsonl"
    if not results_path.exists():
        raise SystemExit(f"No results found at {results_path} — run `run` first")

    document_scores: list[DocumentScore] = []
    arithmetic_results: list[bool] = []
    with results_path.open("r", encoding="utf-8") as f:
        for line in f:
            record = json.loads(line)
            document_scores.append(DocumentScore.model_validate(record["score"]))
            arithmetic_results.append(record["arithmetic_ok"])

    cost_log_path = Path("apps/ai/runs") / args.run_id / "cost_log.jsonl"
    cost_records = read_cost_records(cost_log_path)

    print(render_accuracy_table(document_scores, arithmetic_results))
    print()
    print(render_cost_table(cost_records, total_documents=len(document_scores), run_id=args.run_id))


def main() -> None:
    parser = argparse.ArgumentParser(prog="mou7asib-extract-harness")
    subparsers = parser.add_subparsers(dest="command", required=True)

    run_parser = subparsers.add_parser("run", help="Run extraction + scoring over a document folder")
    run_parser.add_argument("--input-dir", required=True)
    run_parser.add_argument("--model", default="qwen2.5vl")
    run_parser.add_argument("--ollama-host", default=None, help="Overrides OLLAMA_HOST env var if set")
    run_parser.add_argument("--prompt-version", default="v1")
    run_parser.add_argument("--run-id", default=None)
    run_parser.add_argument("--max-attempts", type=int, default=3)
    run_parser.set_defaults(func=cmd_run)

    score_parser = subparsers.add_parser("score", help="Re-render tables from a prior run, no Ollama needed")
    score_parser.add_argument("--run-id", required=True)
    score_parser.set_defaults(func=cmd_score)

    args = parser.parse_args()
    if getattr(args, "run_id", None) is None:
        args.run_id = _default_run_id()
    args.func(args)


if __name__ == "__main__":
    main()
