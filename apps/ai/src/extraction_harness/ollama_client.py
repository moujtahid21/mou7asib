"""Thin httpx wrapper around Ollama's local /api/chat endpoint.

No SDK — this is one local HTTP endpoint with a stable, documented shape.
"""

from __future__ import annotations

import os

import httpx
from pydantic import BaseModel

from extraction_harness.prompt import ChatMessage

DEFAULT_OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
DEFAULT_TIMEOUT_SECONDS = 900.0  # CPU-only inference of a 6GB vision model can be slow, esp. cold-start
# The schema-embedded instruction template plus one image (min 1024 tokens per
# Ollama's mmproj config) measured at 4277 prompt tokens against qwen2.5vl's
# default 4096 context, which Ollama rejects with a 400 rather than truncating.
# 8192 leaves headroom for the prompt plus the JSON response.
DEFAULT_NUM_CTX = 8192


class OllamaChatResult(BaseModel):
    content: str
    input_tokens: int
    output_tokens: int
    total_duration_ms: int
    eval_duration_ms: int


def chat(
    messages: list[ChatMessage],
    model: str,
    host: str = DEFAULT_OLLAMA_HOST,
    timeout: float = DEFAULT_TIMEOUT_SECONDS,
    num_ctx: int = DEFAULT_NUM_CTX,
) -> OllamaChatResult:
    """Call Ollama's chat endpoint in JSON mode and return content plus token/timing metadata."""
    response = httpx.post(
        f"{host}/api/chat",
        json={
            "model": model,
            "messages": messages,
            "stream": False,
            "format": "json",
            "options": {"num_ctx": num_ctx},
        },
        timeout=timeout,
    )
    response.raise_for_status()
    body = response.json()

    return OllamaChatResult(
        content=body["message"]["content"],
        input_tokens=body.get("prompt_eval_count", 0),
        output_tokens=body.get("eval_count", 0),
        total_duration_ms=body.get("total_duration", 0) // 1_000_000,
        eval_duration_ms=body.get("eval_duration", 0) // 1_000_000,
    )
