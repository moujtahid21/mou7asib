"""Orchestrates one document through: route -> call model -> validate -> retry -> cost record.

CLAUDE.md §7.2: on schema validation failure, retry with a bounded budget;
after exhausting it, flag (extraction=None) rather than guess. Every attempt
writes its own CostRecord so first-attempt vs retry cost stay distinguishable
(ADR 0005).
"""

from __future__ import annotations

import base64
import hashlib
import json
import time
from pathlib import Path

from pydantic import ValidationError

from extraction_harness.ollama_client import chat
from extraction_harness.prompt import build_messages_for_image, build_messages_for_text
from extraction_harness.routing import decide_path, extract_text_layer, rasterize_first_page
from extraction_harness.schemas import CostRecord, ExtractionAttempt, InvoiceExtraction

MAX_ATTEMPTS = 3
BACKOFF_SECONDS = 1.0


def document_id_for(document_path: Path) -> str:
    """Content hash, reused later as the duplicate-detection key (CLAUDE.md §7.2)."""
    digest = hashlib.sha256(document_path.read_bytes()).hexdigest()
    return digest[:16]


def _image_bytes_for(document_path: Path, tmp_dir: Path) -> bytes:
    if document_path.suffix.lower() == ".pdf":
        rasterized = tmp_dir / f"{document_path.stem}.png"
        rasterize_first_page(document_path, rasterized)
        return rasterized.read_bytes()
    return document_path.read_bytes()


def extract_document(
    document_path: Path,
    model: str,
    prompt_version: str,
    tmp_dir: Path,
    tenant_id: str = "d1-spike",
    max_attempts: int = MAX_ATTEMPTS,
) -> list[ExtractionAttempt]:
    """Run the full pipeline for one document. Returns every attempt (for cost accounting)."""
    document_id = document_id_for(document_path)
    path = decide_path(document_path)

    attempts: list[ExtractionAttempt] = []
    validation_error: str | None = None

    for attempt_number in range(1, max_attempts + 1):
        if path == "text_layer":
            document_text = extract_text_layer(document_path)
            messages = build_messages_for_text(document_text, validation_error)
        else:
            image_b64 = base64.b64encode(_image_bytes_for(document_path, tmp_dir)).decode("ascii")
            messages = build_messages_for_image(image_b64, validation_error)

        start = time.monotonic()
        result = chat(messages, model=model)
        wall_clock_ms = int((time.monotonic() - start) * 1000)

        cost = CostRecord(
            tenant_id=tenant_id,
            document_id=document_id,
            provider="ollama",
            model=model,
            prompt_version=prompt_version,
            input_tokens=result.input_tokens,
            output_tokens=result.output_tokens,
            cost_minor_units=0,
            compute_ms=result.eval_duration_ms or wall_clock_ms,
            latency_ms=result.total_duration_ms or wall_clock_ms,
            attempt_number=attempt_number,
            path=path,
        )

        try:
            payload = json.loads(result.content)
            extraction = InvoiceExtraction.model_validate(payload)
        except (json.JSONDecodeError, ValidationError) as exc:
            validation_error = str(exc)
            attempts.append(ExtractionAttempt(extraction=None, cost=cost, raw_response=result.content))
            if attempt_number < max_attempts:
                time.sleep(BACKOFF_SECONDS * attempt_number)
            continue

        attempts.append(ExtractionAttempt(extraction=extraction, cost=cost, raw_response=result.content))
        break

    return attempts
