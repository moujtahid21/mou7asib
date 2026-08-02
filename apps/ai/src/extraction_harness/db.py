"""Postgres access for the D2 worker: job-claim query and result writes.

Raw psycopg SQL, not Prisma/an ORM — the worker is a second, independent
writer against the same schema apps/web owns via Prisma (ADR 0002's
recommended queue mechanism: Postgres first, no Redis, no broker). Every
identifier here must match the @map()'d snake_case names in
packages/db/prisma/schema.prisma exactly, and every id is a stdlib
uuid.uuid7() to match Prisma's uuid(7) convention — Prisma generates that ID
client-side, not as a DB-level default, so this worker must generate its own.
"""

from __future__ import annotations

import os
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any
from urllib.parse import parse_qs, urlencode, urlsplit, urlunsplit

import psycopg
from psycopg.rows import dict_row

from extraction_harness.schemas import CostRecord, GroundedField

# Every function below takes this row-factory-typed connection, not the
# psycopg default (tuple rows) — dict_row is what makes row["field_name"]
# indexing below type-check and work correctly.
DictConnection = psycopg.Connection[dict[str, Any]]

# Startup crash-recovery: a job stuck `processing` past this ceiling gets
# requeued. Well past the 500-600s worst case measured in D1 on CPU-only
# hardware — this is "the worker died," not "the job is slow."
STUCK_JOB_CEILING_MINUTES = 20


def _database_url() -> str:
    """The same DATABASE_URL packages/db's Prisma client reads, minus
    Prisma-specific query params that plain psycopg doesn't understand.

    Prisma's connection string convention includes ?schema=public — Prisma's
    own syntax for selecting a Postgres schema, not a standard libpq URI
    parameter. psycopg rejects the whole connection string outright if it's
    present ("invalid URI query parameter: schema"), so it's stripped here.
    Our schema is "public" (Postgres's own default), so dropping it changes
    nothing about which schema is actually used.
    """
    url = os.environ.get("DATABASE_URL")
    if url is None or url == "":
        raise RuntimeError("DATABASE_URL is not set.")

    parts = urlsplit(url)
    query = parse_qs(parts.query)
    query.pop("schema", None)
    return urlunsplit(parts._replace(query=urlencode(query, doseq=True)))


@contextmanager
def connect() -> Iterator[DictConnection]:
    with psycopg.connect(_database_url(), row_factory=dict_row) as conn:
        yield conn


@dataclass(frozen=True)
class ClaimedJob:
    job_id: str
    document_id: str
    tenant_id: str
    storage_path: str
    attempt_count: int


def requeue_stuck_jobs(conn: DictConnection) -> int:
    """Startup crash recovery: simple, appropriate for a single worker process.

    Joins documents and excludes soft-deleted ones — no point requeuing a job
    for a document the user has since deleted (deleted_at filter, matching
    claim_next_job below).
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE extraction_jobs j
            SET status = 'queued', locked_at = NULL, locked_by = NULL
            FROM documents d
            WHERE j.document_id = d.id
              AND j.status = 'processing'
              AND j.locked_at < now() - make_interval(mins => %(ceiling)s)
              AND d.deleted_at IS NULL
            """,
            {"ceiling": STUCK_JOB_CEILING_MINUTES},
        )
        requeued = cur.rowcount
    conn.commit()
    return requeued


def claim_next_job(conn: DictConnection, worker_id: str) -> ClaimedJob | None:
    """SELECT ... FOR UPDATE SKIP LOCKED — ADR 0002's own recommended queue mechanism.

    Excludes a soft-deleted document's job (deleted_at IS NOT NULL) — without
    this, a worker could resurrect a deleted document's status after the user
    believed it gone.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT j.id AS job_id, j.document_id, j.tenant_id, j.attempt_count,
                   d.storage_path
            FROM extraction_jobs j
            JOIN documents d ON d.id = j.document_id
            WHERE j.status = 'queued'
              AND d.deleted_at IS NULL
            ORDER BY j.created_at
            FOR UPDATE OF j SKIP LOCKED
            LIMIT 1
            """
        )
        row = cur.fetchone()
        if row is None:
            conn.commit()
            return None

        cur.execute(
            """
            UPDATE extraction_jobs
            SET status = 'processing', attempt_count = attempt_count + 1,
                locked_at = now(), locked_by = %(worker_id)s,
                started_at = COALESCE(started_at, now())
            WHERE id = %(job_id)s
            """,
            {"worker_id": worker_id, "job_id": row["job_id"]},
        )
        cur.execute(
            "UPDATE documents SET status = 'processing' WHERE id = %(document_id)s",
            {"document_id": row["document_id"]},
        )
    conn.commit()
    return ClaimedJob(
        job_id=str(row["job_id"]),
        document_id=str(row["document_id"]),
        tenant_id=str(row["tenant_id"]),
        storage_path=row["storage_path"],
        attempt_count=row["attempt_count"],
    )


def record_attempt(
    conn: DictConnection,
    *,
    job_id: str,
    document_id: str,
    cost: CostRecord,
    success: bool,
    raw_response: str,
    arithmetic_ok: bool | None,
) -> str:
    """Insert one ExtractionAttempt row (CLAUDE.md §7.2's cost/audit tuple) and return its id."""
    attempt_id = str(uuid.uuid7())
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO extraction_attempts (
                id, job_id, tenant_id, document_id, attempt_number, model,
                prompt_version, path, success, raw_response, input_tokens,
                output_tokens, cost_minor_units, compute_ms, latency_ms,
                arithmetic_ok, created_at
            ) VALUES (
                %(id)s, %(job_id)s, %(tenant_id)s, %(document_id)s,
                %(attempt_number)s, %(model)s, %(prompt_version)s, %(path)s,
                %(success)s, %(raw_response)s, %(input_tokens)s, %(output_tokens)s,
                %(cost_minor_units)s, %(compute_ms)s, %(latency_ms)s,
                %(arithmetic_ok)s, now()
            )
            """,
            {
                "id": attempt_id,
                "job_id": job_id,
                "tenant_id": cost.tenant_id,
                "document_id": document_id,
                "attempt_number": cost.attempt_number,
                "model": cost.model,
                "prompt_version": cost.prompt_version,
                "path": cost.path,
                "success": success,
                "raw_response": raw_response,
                "input_tokens": cost.input_tokens,
                "output_tokens": cost.output_tokens,
                "cost_minor_units": cost.cost_minor_units,
                "compute_ms": cost.compute_ms,
                "latency_ms": cost.latency_ms,
                "arithmetic_ok": arithmetic_ok,
            },
        )
    conn.commit()
    return attempt_id


def record_extracted_fields(
    conn: DictConnection,
    *,
    document_id: str,
    tenant_id: str,
    attempt_id: str,
    fields: list[GroundedField],
) -> None:
    """Insert ExtractedField rows. Only fields with a non-null value get a row —
    the review UI treats a missing row as 'not extracted' (CLAUDE.md §7.2)."""
    with conn.cursor() as cur:
        for field in fields:
            cur.execute(
                """
                INSERT INTO extracted_fields (
                    id, tenant_id, document_id, attempt_id, field_name,
                    group_name, group_index, field_type, value_text,
                    value_decimal, confidence, page_number, bounding_box,
                    created_at
                ) VALUES (
                    %(id)s, %(tenant_id)s, %(document_id)s, %(attempt_id)s,
                    %(field_name)s, %(group_name)s, %(group_index)s,
                    %(field_type)s, %(value_text)s, %(value_decimal)s,
                    %(confidence)s, %(page_number)s, %(bounding_box)s, now()
                )
                """,
                {
                    "id": str(uuid.uuid7()),
                    "tenant_id": tenant_id,
                    "document_id": document_id,
                    "attempt_id": attempt_id,
                    "field_name": field.field_name,
                    "group_name": field.group_name,
                    "group_index": field.group_index,
                    "field_type": field.field_type,
                    "value_text": field.value_text,
                    "value_decimal": field.value_decimal,
                    "confidence": field.confidence,
                    "page_number": field.page_number,
                    "bounding_box": field.bounding_box.model_dump_json()
                    if field.bounding_box is not None
                    else None,
                },
            )
    conn.commit()


def record_document_preview(
    conn: DictConnection, *, document_id: str, preview_path: str, width: int, height: int
) -> None:
    """PDF only — the worker rasterizes a first-page preview (routing.rasterize_first_page)
    since a raw PDF can't render in an <img> tag. Images never call this; storagePath
    already IS their preview."""
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE documents
            SET preview_image_path = %(preview_path)s,
                stored_image_width = %(width)s,
                stored_image_height = %(height)s,
                updated_at = now()
            WHERE id = %(document_id)s
            """,
            {"preview_path": preview_path, "width": width, "height": height, "document_id": document_id},
        )
    conn.commit()


def mark_document_extracted(conn: DictConnection, *, job_id: str, document_id: str, attempt_id: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE extraction_jobs SET status = 'succeeded', finished_at = now() WHERE id = %(job_id)s",
            {"job_id": job_id},
        )
        cur.execute(
            """
            UPDATE documents
            SET status = 'extracted', current_attempt_id = %(attempt_id)s, updated_at = now()
            WHERE id = %(document_id)s
            """,
            {"attempt_id": attempt_id, "document_id": document_id},
        )
    conn.commit()


def mark_document_failed(conn: DictConnection, *, job_id: str, document_id: str, error_message: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE extraction_jobs
            SET status = 'failed', finished_at = now(), last_error = %(error)s
            WHERE id = %(job_id)s
            """,
            {"job_id": job_id, "error": error_message},
        )
        cur.execute(
            "UPDATE documents SET status = 'failed', updated_at = now() WHERE id = %(document_id)s",
            {"document_id": document_id},
        )
    conn.commit()
