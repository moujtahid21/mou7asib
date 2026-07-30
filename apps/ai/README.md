# extraction-harness (D1 spike)

Throwaway spike per `docs/build-order.md` slice S1a: measures per-field extraction accuracy
and per-document cost/latency on synthetic Moroccan-style invoices, routed through a
cheap-path (PDF text layer) or OCR/vision-path (local Ollama vision model). Not a product,
not a service — the harness, not the finding (`docs/decision-log.md` D1 / ADR 0006).

## Prerequisites (one-time, this machine)

1. **uv** (Python package/version manager): `curl -LsSf https://astral.sh/uv/install.sh | sh`
2. **Python 3.14**: `uv python install 3.14` (provisioned independent of system Python/apt)
3. **Ollama**: `curl -fsSL https://ollama.com/install.sh | sh` (needs `sudo`, run interactively)
4. **qwen2.5vl model**: `ollama pull qwen2.5vl`, then confirm `ollama serve` answers on
   `http://localhost:11434` (run `ollama serve` in a separate terminal, or as a systemd
   service if the installer set that up)

This harness talks to Ollama's local HTTP API only — no cloud AI provider, no data leaves
the machine. Same code runs unchanged against a bigger model on a stronger machine (just
point `--ollama-host` at it, or run there directly).

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

## Tests

```
uv run pytest          # no Ollama dependency — pure scoring/routing logic
uv run mypy --strict src
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
- **No FastAPI service, no database, no tenancy.** This is a CLI spike per ADR 0006 ("D1
  needs no ledger, no auth, no database"). The real `apps/ai` service arrives later.
