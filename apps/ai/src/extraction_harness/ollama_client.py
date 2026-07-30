"""Thin httpx wrapper around Ollama's local /api/chat endpoint.

No SDK — this is one local HTTP endpoint with a stable, documented shape.
"""

from __future__ import annotations

import os

import httpx
from pydantic import BaseModel

from extraction_harness.prompt import ChatMessage

DEFAULT_OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
DEFAULT_TIMEOUT_SECONDS = 120.0


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
) -> OllamaChatResult:
    """Call Ollama's chat endpoint in JSON mode and return content plus token/timing metadata."""
    response = httpx.post(
        f"{host}/api/chat",
        json={"model": model, "messages": messages, "stream": False, "format": "json"},
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
