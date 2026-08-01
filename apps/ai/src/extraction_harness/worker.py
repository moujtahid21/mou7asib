"""D2 extraction worker: polls the Postgres queue, runs D1's extraction
pipeline plus grounding, writes results back. No HTTP between apps/web and
apps/ai — CLAUDE.md §3's "the web app never talks to the OCR/LLM providers
directly" is about where the prompts/redaction/retries live (here), not the
transport. See the D2 plan for the full rationale (ADR 0002's own
recommended queue mechanism, no redundant protocol layer).
"""

from __future__ import annotations

import logging
import os
import socket
import tempfile
import time
from pathlib import Path

from extraction_harness import db
from extraction_harness.extract import extract_document
from extraction_harness.grounding import ground_extraction
from extraction_harness.scoring import check_arithmetic

logger = logging.getLogger("extraction_harness.worker")

POLL_INTERVAL_SECONDS = 5.0
MODEL = os.environ.get("MOU7ASIB_MODEL", "qwen2.5vl")
PROMPT_VERSION = os.environ.get("MOU7ASIB_PROMPT_VERSION", "v2")


def _worker_id() -> str:
    return f"{socket.gethostname()}:{os.getpid()}"


def _repo_root() -> Path:
    # apps/ai/src/extraction_harness/worker.py -> repo root, 4 parents up.
    # Overridable since the worker and apps/web only need to agree on this
    # when they're not both running from a checkout in the expected shape.
    override = os.environ.get("MOU7ASIB_REPO_ROOT")
    if override:
        return Path(override)
    return Path(__file__).resolve().parents[4]


def process_job(conn: db.DictConnection, job: db.ClaimedJob) -> None:
    document_path = _repo_root() / job.storage_path
    if not document_path.exists():
        db.mark_document_failed(
            conn,
            job_id=job.job_id,
            document_id=job.document_id,
            error_message=f"Stored file missing: {document_path}",
        )
        return

    with tempfile.TemporaryDirectory() as tmp_dir_str:
        attempts = extract_document(
            document_path,
            model=MODEL,
            prompt_version=PROMPT_VERSION,
            tmp_dir=Path(tmp_dir_str),
            tenant_id=job.tenant_id,
        )

    final_attempt_id: str | None = None
    for attempt in attempts:
        arithmetic_ok = check_arithmetic(attempt.extraction) if attempt.extraction is not None else None
        attempt_id = db.record_attempt(
            conn,
            job_id=job.job_id,
            document_id=job.document_id,
            cost=attempt.cost,
            success=attempt.extraction is not None,
            raw_response=attempt.raw_response,
            arithmetic_ok=arithmetic_ok,
        )
        if attempt.extraction is not None:
            final_attempt_id = attempt_id

    final_extraction = attempts[-1].extraction if attempts else None
    if final_extraction is None or final_attempt_id is None:
        # Flag rather than guess (CLAUDE.md §7.2) — the document surfaces as
        # "extraction impossible, manual entry needed" in the review screen.
        error = "Extraction failed after all attempts" if attempts else "No attempts were made"
        db.mark_document_failed(conn, job_id=job.job_id, document_id=job.document_id, error_message=error)
        return

    final_path = attempts[-1].cost.path
    final_arithmetic_ok = check_arithmetic(final_extraction)

    grounded_fields = ground_extraction(final_extraction, final_path, document_path, final_arithmetic_ok)
    db.record_extracted_fields(
        conn,
        document_id=job.document_id,
        tenant_id=job.tenant_id,
        attempt_id=final_attempt_id,
        fields=grounded_fields,
    )
    db.mark_document_extracted(
        conn, job_id=job.job_id, document_id=job.document_id, attempt_id=final_attempt_id
    )


def run_worker(max_iterations: int | None = None) -> None:
    """max_iterations is for tests — production runs pass None (loop forever)."""
    worker_id = _worker_id()
    logger.info("worker starting: %s", worker_id)

    with db.connect() as conn:
        requeued = db.requeue_stuck_jobs(conn)
        if requeued:
            logger.info("requeued %d stuck job(s) on startup", requeued)

    iterations = 0
    while max_iterations is None or iterations < max_iterations:
        iterations += 1
        with db.connect() as conn:
            job = db.claim_next_job(conn, worker_id)
            if job is None:
                time.sleep(POLL_INTERVAL_SECONDS)
                continue

            logger.info("processing job %s (document %s)", job.job_id, job.document_id)
            try:
                process_job(conn, job)
            except Exception:
                # One bad job must not crash the whole worker — mirrors
                # extract_document's existing per-document resilience.
                logger.exception("job %s failed with an unexpected error", job.job_id)
                db.mark_document_failed(
                    conn,
                    job_id=job.job_id,
                    document_id=job.document_id,
                    error_message="Unexpected worker error — see logs",
                )


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    run_worker()


if __name__ == "__main__":
    main()
