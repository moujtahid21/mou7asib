# extraction-harness

Two things live here now:
- **D1's CLI harness** (`docs/build-order.md` S1a) — measures per-field extraction accuracy
  and per-document cost/latency on synthetic Moroccan-style invoices. Still a throwaway
  spike in spirit, kept for regression measurement.
- **D2's extraction worker** — the real background worker behind the demo (`docs/decision-log.md`
  D2 / ADR 0006). Polls a Postgres queue (`packages/db`'s `ExtractionJob` table), reuses D1's
  extraction pipeline unchanged, grounds each field's value against the source document, and
  writes results back. **Not a throwaway** — this is the foundation D2 explicitly says to
  build on.

Both talk to Ollama's local HTTP API only — no cloud AI provider, no data leaves the machine.

## Prerequisites (one-time, this machine)

1. **uv** (Python package/version manager): `curl -LsSf https://astral.sh/uv/install.sh | sh`
2. **Python 3.14**: `uv python install 3.14` (provisioned independent of system Python/apt)
3. **Ollama**: `curl -fsSL https://ollama.com/install.sh | sh` (needs `sudo`, run interactively)
4. **qwen2.5vl model**: `ollama pull qwen2.5vl`, then confirm `ollama serve` answers on
   `http://localhost:11434` (run `ollama serve` in a separate terminal, or as a systemd
   service if the installer set that up). Same code runs unchanged against a bigger model on
   a stronger machine (point `--ollama-host`/`OLLAMA_HOST` at it, or run there directly).
5. **Tesseract OCR** (D2 worker only — grounding's Approach B, see below):
   `sudo apt install tesseract-ocr tesseract-ocr-fra tesseract-ocr-ara`
6. **ClamAV** (D2 worker's malware-scan step lives in `apps/web`, not here, but needs the
   same daemon): `sudo apt install clamav-daemon && sudo freshclam && sudo systemctl start clamav-daemon`
7. **`DATABASE_URL`** (D2 worker only): reads the same repo-root `.env` as `packages/db` —
   run `npm run db:up` at the repo root first so Postgres is actually reachable.

## Setup

```
cd apps/ai
uv sync                      # installs pydantic/httpx/pymupdf/pillow + dev tools
uv run python synthetic/generate_invoices.py   # writes synthetic/corpus/ (committed to git)
uv run python synthetic/degrade.py             # writes synthetic/corpus_degraded/ (committed)
```

## Run the harness

```
uv run mou7asib-extract-harness run \
    --input-dir synthetic/corpus \
    --model qwen2.5vl \
    --prompt-version v1
```

Prints a per-field accuracy table and a cost-per-document-by-path table to stdout, and writes
`runs/<run-id>/{results.jsonl,cost_log.jsonl,summary.json}`.

Run against the degraded corpus separately to confirm the `ocr` path gets exercised:

```
uv run mou7asib-extract-harness run --input-dir synthetic/corpus_degraded --model qwen2.5vl
```

Re-print a prior run's tables without needing Ollama running:

```
uv run mou7asib-extract-harness score --run-id <run-id>
```

## Run the D2 worker

```
cd apps/ai
uv sync
uv run mou7asib-extraction-worker
```

Polls `extraction_jobs` every 5s, claims one with `SELECT ... FOR UPDATE SKIP LOCKED`
(ADR 0002's own recommended queue mechanism — no Redis, no broker), runs the same
`extract_document` pipeline D1 validated, grounds each field (see "Grounding approach"
below), and writes `ExtractionAttempt`/`ExtractedField` rows plus the document's final
status back to Postgres. `apps/web`'s upload Server Action is the only thing that enqueues;
this worker never talks to Next.js directly, only through the shared database.

Env vars: `DATABASE_URL` (required, same `.env` as `packages/db`), `MOU7ASIB_MODEL`
(default `qwen2.5vl`), `MOU7ASIB_PROMPT_VERSION` (default `v2`), `MOU7ASIB_REPO_ROOT`
(override if the worker isn't running from a checkout in the expected shape — defaults to
four parents up from this file).

### Grounding approach (bounding boxes + confidence per field)

D2's plan called for spiking whether `qwen2.5vl` could return usable bounding boxes
directly before building anything more complex. It was spiked, and it doesn't work through
Ollama specifically: Qwen2.5-VL's grounding coordinates are relative to the model's
*internal* resized/padded image representation, and correctly rescaling them back to the
original image requires the `image_grid_thw` metadata from the raw Hugging Face/vLLM
pipeline — which Ollama's `/api/chat` API does not expose. Field *values* were read
correctly in the spike even under rotation degradation; only the bounding-box mechanism was
a dead end for this serving layer.

So `grounding.py` implements the plan's fallback (Approach B), deterministically:
- **text_layer path**: PyMuPDF's `page.search_for()` — exact rects in PDF point-space,
  near-free. Dormant in D2's actual product flow (the capture UI is image-only, so
  `routing.decide_path()` always returns `"ocr"` for real D2 documents) but exercised by
  D1's CLI harness and kept general for S5, which reintroduces PDF upload.
- **ocr path** (the one D2's camera-capture flow actually uses): word-level Tesseract OCR
  (`fra+ara+eng`) + `rapidfuzz` matching against the stored image. Confidence is a computed
  blend (fuzzy-match score, Tesseract's own word confidence, and — for amount fields —
  whether `scoring.py`'s `check_arithmetic` passed), never the model's own self-reported
  confidence.

## Tests

```
uv run pytest          # no Ollama dependency — pure scoring/routing/grounding logic
uv run mypy --strict src tests
uv run ruff check .
```

## Known limitations (explicit, not silently assumed)

- **Synthetic corpus only.** Low visual fidelity (PyMuPDF text/lines, not photorealistic
  letterhead). Per decision D-05, numbers from this corpus measure the harness, not
  real-world extraction accuracy — that's S1b, blocked on gathering real anonymised
  documents.
- **Degradation covers rotate/blur/underexpose/JPEG-compression only.** Physical crumpling
  and an actual phone-camera capture (moiré, perspective distortion, uneven real lighting)
  are not simulated in code — S1b is the real answer to "does this work on phone photos."
- **Arabic text in the synthetic corpus extracts in reversed character order.** PyMuPDF's
  `insert_text` does not perform BiDi reshaping for RTL runs, so the Arabic half of the two
  bilingual header lines (`invoice_07`, `invoice_08`) round-trips as real Arabic Unicode
  codepoints (not corrupted/placeholder glyphs — that failure mode was caught and fixed
  during generation) but in reversed logical order. This does not affect scoring: the Arabic
  text is a decorative header, not a scored ground-truth field. Worth knowing before reusing
  `generate_invoices.py`'s font-splitting approach for anything that *is* scored.
- **No FastAPI service.** D2's worker talks to Postgres, not HTTP — see the D2 plan for why
  a synchronous request/response layer isn't needed yet. FastAPI arrives when apps/ai needs
  to expose something over a network boundary (ADR 0002 Option B, post-demo).
- **This worker connects as the RLS-bypassing role.** Real multi-tenancy, RLS, and auth
  landed on the `apps/web` side in ADR 0007's phase 1 (see `packages/db/README.md`) — but
  `db.py` (`_database_url()`) reads plain `DATABASE_URL`, the schema-owning `mou7asib`
  role, which is a Postgres superuser and therefore bypasses Row Level Security
  unconditionally, same root cause `packages/db/README.md` documents for why `apps/web`
  had to be split onto `APP_DATABASE_URL`/`mou7asib_app` instead. In practice this worker
  still only ever touches the job it claimed (`ExtractionJob.tenantId`, set correctly by
  `apps/web`'s upload action), so it isn't a live cross-tenant leak today — but RLS is
  providing **zero** backstop for this connection, only whatever the Python code itself
  gets right. Point this worker at a restricted role (`mou7asib_app`, or its own
  equivalent) before trusting it the way `apps/web` is now trusted.
- **Grounding confidence thresholds (`MATCH_SCORE_FLOOR` in `grounding.py`,
  `LOW_CONFIDENCE_THRESHOLD` in `apps/web/lib/confidence.ts`) are documented placeholders**,
  not tuned against real accuracy data — there isn't any yet. Revisit once D2 has run
  against enough real documents to know.
