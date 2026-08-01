"""Integration tests against a real local Postgres (CLAUDE.md §12), not a
mock — the point is to catch things mypy can't: SQL syntax errors, enum
casing mismatches, JSON serialization for bounding_box, Prisma/psycopg
connection-string interop (the schema= query param strip in db._database_url).

Skipped entirely if DATABASE_URL isn't set (e.g. CI without a DB attached),
rather than failing — the surrounding pure-logic tests still run.
"""

from __future__ import annotations

import os
import uuid
from collections.abc import Iterator

import psycopg
import pytest
from psycopg.rows import dict_row

from extraction_harness import db
from extraction_harness.schemas import BoundingBox, CostRecord, GroundedField

pytestmark = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"), reason="DATABASE_URL not set — skipping DB integration tests"
)

# Seeded by packages/db/src/seed.ts — see CLAUDE.md §9 idempotent-seed convention.
DEMO_TENANT_ID = "01930000-0000-7000-8000-000000000001"


@pytest.fixture
def conn() -> Iterator[db.DictConnection]:
    with db.connect() as connection:
        yield connection


@pytest.fixture
def document_and_job(conn: db.DictConnection) -> Iterator[tuple[str, str]]:
    """Inserts a throwaway Document + ExtractionJob row, cleans up after."""
    document_id = str(uuid.uuid7())
    job_id = str(uuid.uuid7())
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO documents (
                id, tenant_id, content_hash, original_filename, mime_type,
                byte_size, storage_path, stored_image_width, stored_image_height,
                status, uploaded_at, updated_at
            ) VALUES (
                %(id)s, %(tenant_id)s, %(hash)s, 'test.jpg', 'image/jpeg',
                100, 'uploads/documents/test/test.jpg', 800, 600,
                'queued', now(), now()
            )
            """,
            {"id": document_id, "tenant_id": DEMO_TENANT_ID, "hash": f"test-{document_id[:8]}"},
        )
        cur.execute(
            """
            INSERT INTO extraction_jobs (id, tenant_id, document_id, status, created_at)
            VALUES (%(id)s, %(tenant_id)s, %(document_id)s, 'queued', now())
            """,
            {"id": job_id, "tenant_id": DEMO_TENANT_ID, "document_id": document_id},
        )
    conn.commit()

    yield document_id, job_id

    with conn.cursor() as cur:
        cur.execute("DELETE FROM extracted_fields WHERE document_id = %(id)s", {"id": document_id})
        cur.execute("DELETE FROM extraction_attempts WHERE document_id = %(id)s", {"id": document_id})
        cur.execute("DELETE FROM extraction_jobs WHERE document_id = %(id)s", {"id": document_id})
        cur.execute("DELETE FROM documents WHERE id = %(id)s", {"id": document_id})
    conn.commit()


def test_database_url_strips_prisma_schema_param() -> None:
    """Prisma's ?schema=public would otherwise make psycopg reject the whole URL."""
    stripped = db._database_url()
    assert "schema=" not in stripped


def test_claim_record_and_mark_extracted_round_trip(
    conn: db.DictConnection, document_and_job: tuple[str, str]
) -> None:
    document_id, job_id = document_and_job

    claimed = db.claim_next_job(conn, "pytest-worker")
    assert claimed is not None
    assert claimed.document_id == document_id
    assert claimed.job_id == job_id

    cost = CostRecord(
        tenant_id=DEMO_TENANT_ID,
        document_id=document_id,
        provider="ollama",
        model="qwen2.5vl",
        prompt_version="v2",
        input_tokens=100,
        output_tokens=50,
        cost_minor_units=0,
        compute_ms=1234,
        latency_ms=2345,
        attempt_number=1,
        path="ocr",
    )
    attempt_id = db.record_attempt(
        conn,
        job_id=job_id,
        document_id=document_id,
        cost=cost,
        success=True,
        raw_response='{"invoice_number": "FA-2026-0001"}',
        arithmetic_ok=True,
    )

    fields = [
        GroundedField(
            field_name="invoice_number",
            field_type="string",
            value_text="FA-2026-0001",
            confidence=0.95,
            bounding_box=BoundingBox(x=0.1, y=0.2, width=0.3, height=0.05),
        ),
        GroundedField(
            field_name="rate",
            group_name="tva_lines",
            group_index=0,
            field_type="decimal",
            value_decimal=None,  # exercised as None deliberately below via a second field
            confidence=0.0,
            bounding_box=None,
        ),
    ]
    db.record_extracted_fields(
        conn, document_id=document_id, tenant_id=DEMO_TENANT_ID, attempt_id=attempt_id, fields=fields
    )
    db.mark_document_extracted(conn, job_id=job_id, document_id=document_id, attempt_id=attempt_id)

    with psycopg.connect(db._database_url(), row_factory=dict_row) as verify_conn, verify_conn.cursor() as cur:
        cur.execute("SELECT status, current_attempt_id FROM documents WHERE id = %(id)s", {"id": document_id})
        doc_row = cur.fetchone()
        assert doc_row is not None
        assert doc_row["status"] == "extracted"
        assert str(doc_row["current_attempt_id"]) == attempt_id

        cur.execute("SELECT status FROM extraction_jobs WHERE id = %(id)s", {"id": job_id})
        job_row = cur.fetchone()
        assert job_row is not None
        assert job_row["status"] == "succeeded"

        cur.execute(
            "SELECT field_name, value_text, bounding_box FROM extracted_fields "
            "WHERE document_id = %(id)s AND field_name = 'invoice_number'",
            {"id": document_id},
        )
        field_row = cur.fetchone()
        assert field_row is not None
        assert field_row["value_text"] == "FA-2026-0001"
        assert field_row["bounding_box"] is not None


def test_mark_document_failed(conn: db.DictConnection, document_and_job: tuple[str, str]) -> None:
    document_id, job_id = document_and_job
    db.claim_next_job(conn, "pytest-worker")

    db.mark_document_failed(conn, job_id=job_id, document_id=document_id, error_message="test failure")

    with psycopg.connect(db._database_url(), row_factory=dict_row) as verify_conn, verify_conn.cursor() as cur:
        cur.execute("SELECT status FROM documents WHERE id = %(id)s", {"id": document_id})
        doc_row = cur.fetchone()
        assert doc_row is not None
        assert doc_row["status"] == "failed"

        cur.execute("SELECT status, last_error FROM extraction_jobs WHERE id = %(id)s", {"id": job_id})
        job_row = cur.fetchone()
        assert job_row is not None
        assert job_row["status"] == "failed"
        assert job_row["last_error"] == "test failure"
