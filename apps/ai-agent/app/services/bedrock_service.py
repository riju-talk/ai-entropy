"""
Entropy AI Bedrock Service
======================
Drop-in replacement for Gemini + Pinecone.

  LLM  : Amazon Bedrock — Amazon Nova Premier
  Embed: Amazon Bedrock — Titan Embeddings V2

Usage example:
    from app.services.bedrock_service import (
        generate_text,
        generate_structured,
        embed_text,
        embed_batch,
        BedrockService,
    )
"""

from __future__ import annotations

import json
import logging
import os
from functools import lru_cache
from typing import Any, Dict, List, Optional, Type, TypeVar

import boto3
import numpy as np
from botocore.config import Config

logger = logging.getLogger(__name__)

CLAUDE_MODEL_ID   = os.getenv("BEDROCK_CLAUDE_MODEL",  "eu.anthropic.claude-3-7-sonnet-20250219-v1:0")
TITAN_EMBED_ID    = os.getenv("BEDROCK_TITAN_EMBED",   "amazon.titan-embed-text-v2:0")
AWS_REGION        = os.getenv("AWS_REGION",             "ap-northeast-1")


@lru_cache(maxsize=1)
def _get_client() -> Any:
    """Return a cached boto3 bedrock-runtime client."""
    cfg = Config(
        region_name=AWS_REGION,
        retries={"max_attempts": 3, "mode": "adaptive"},
    )
    return boto3.client("bedrock-runtime", config=cfg)

    
class BedrockService:
    """Thin wrapper around Claude 3 Sonnet and Titan Embeddings."""

    def __init__(
        self,
        model_id: str = CLAUDE_MODEL_ID,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ):
        self.model_id   = model_id
        self.temperature = temperature
        self.max_tokens  = max_tokens
        self._client     = _get_client()

    # â”€â”€ LLM helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    def generate(
        self,
        prompt: str,
        system: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> str:
        """
        Simple text generation. Returns the assistant's reply as a string.

        Parameters
        ----------
        prompt      : user message
        system      : optional system prompt
        temperature : overrides instance default
        max_tokens  : overrides instance default
        """
        messages = [{"role": "user", "content": prompt}]
        return self._invoke_messages(
            messages=messages,
            system=system,
            temperature=temperature or self.temperature,
            max_tokens=max_tokens or self.max_tokens,
        )

    def generate_with_history(
        self,
        messages: List[Dict[str, str]],
        system: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> str:
        """Multi-turn conversation. `messages` is a list of {role, content} dicts."""
        return self._invoke_messages(
            messages=messages,
            system=system,
            temperature=temperature or self.temperature,
            max_tokens=max_tokens or self.max_tokens,
        )

    def generate_structured(
        self,
        prompt: str,
        output_schema: str,
        system: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Ask Claude to reply as strict JSON matching `output_schema`.
        Returns parsed dict. Falls back to raw string on parse error.
        """
        json_system = (
            (system + "\n\n" if system else "")
            + "IMPORTANT: You must reply ONLY with valid JSON that matches this schema:\n"
            + output_schema
            + "\nDo not include markdown fences or explanations."
        )
        raw = self.generate(prompt, system=json_system, temperature=0.3)
        # Strip accidental markdown fences
        raw = raw.strip()
        if raw.startswith("```"):
            raw = "\n".join(raw.split("\n")[1:])
            raw = raw.rstrip("`").strip()
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            logger.warning("generate_structured: JSON parse failed, returning raw text")
            return {"raw_response": raw}

    def _invoke_messages(
        self,
        messages: List[Dict[str, Any]],
        system: Optional[str],
        temperature: float,
        max_tokens: int,
    ) -> str:
        # Amazon Nova uses {"text": "..."} content blocks (no "type" field),
        # inferenceConfig for token/temperature params, and a different response shape.
        normalized: List[Dict[str, Any]] = []
        for msg in messages:
            content = msg["content"]
            if isinstance(content, str):
                content = [{"text": content}]
            elif isinstance(content, list):
                # Convert Claude-style {"type": "text", "text": ...} → {"text": ...}
                nova_blocks = []
                for block in content:
                    if isinstance(block, dict) and block.get("type") == "text":
                        nova_blocks.append({"text": block["text"]})
                    else:
                        nova_blocks.append(block)
                content = nova_blocks
            normalized.append({"role": msg["role"], "content": content})

        body: Dict[str, Any] = {
            "messages": normalized,
            "inferenceConfig": {
                "maxTokens": max_tokens,
                "temperature": temperature,
            },
        }
        if system:
            body["system"] = [{"text": system}]

        response = self._client.invoke_model(
            modelId=self.model_id,
            contentType="application/json",
            accept="application/json",
            body=json.dumps(body),
        )
        result = json.loads(response["body"].read())
        return result["output"]["message"]["content"][0]["text"]

    # â”€â”€ Embedding helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    def embed(self, text: str) -> np.ndarray:
        """
        Generate a 1536-dim embedding using Titan Embed Text V1.
        """
        if not text or not text.strip():
            raise ValueError("Cannot embed empty text.")
        body = json.dumps({"inputText": text})
        response = self._client.invoke_model(
            modelId=TITAN_EMBED_ID,
            contentType="application/json",
            accept="application/json",
            body=body,
        )
        result = json.loads(response["body"].read())
        return np.array(result["embedding"], dtype=np.float32)

    def embed_batch(self, texts: List[str]) -> np.ndarray:
        """Embed multiple texts. Titan doesn't support batch natively â€” sequenced."""
        if not texts:
            raise ValueError("embed_batch expects a non-empty list.")
        return np.stack([self.embed(t) for t in texts])
    # ── Vision ────────────────────────────────────────────────────────────────

    def describe_image_bytes(self, image_bytes: bytes, media_type: str = "image/jpeg") -> str:
        """
        Use Claude 3 vision to extract all text from an image (OCR) and describe
        any diagrams / charts found.  Returns extracted content as plain text.

        Parameters
        ----------
        image_bytes : raw bytes of the image (PNG or JPEG)
        media_type  : MIME type — "image/png" or "image/jpeg"
        """
        import base64
        b64 = base64.standard_b64encode(image_bytes).decode("utf-8")
        # Nova image format: {"image": {"format": "jpeg"|"png", "source": {"bytes": b64}}}
        fmt = media_type.split("/")[-1]  # "jpeg" or "png"
        messages = [
            {
                "role": "user",
                "content": [
                    {
                        "image": {
                            "format": fmt,
                            "source": {"bytes": b64},
                        },
                    },
                    {
                        "text": (
                            "Extract ALL text visible in this image, preserving layout as much as possible. "
                            "If the image contains diagrams, charts, tables, or illustrations, describe them "
                            "concisely after the extracted text. Return only the content — no preamble."
                        ),
                    },
                ],
            }
        ]
        body: Dict[str, Any] = {
            "messages": messages,
            "inferenceConfig": {"maxTokens": 2048},
        }
        response = self._client.invoke_model(
            modelId=self.model_id,
            contentType="application/json",
            accept="application/json",
            body=json.dumps(body),
        )
        result = json.loads(response["body"].read())
        return result["output"]["message"]["content"][0]["text"]
    def similarity(self, text1: str, text2: str) -> float:
        """Cosine similarity between two texts (already normalized)."""
        e1 = self.embed(text1)
        e2 = self.embed(text2)
        denom = np.linalg.norm(e1) * np.linalg.norm(e2)
        return float(np.dot(e1, e2) / denom) if denom > 0 else 0.0


@lru_cache(maxsize=1)
def get_bedrock_service() -> BedrockService:
    """Returns a cached BedrockService instance."""
    return BedrockService(
        model_id    = CLAUDE_MODEL_ID,
        temperature = float(os.getenv("LLM_TEMPERATURE", "0.7")),
        max_tokens  = int(os.getenv("LLM_MAX_TOKENS",   "2048")),
    )

def generate_text(prompt: str, system: Optional[str] = None) -> str:
    """Direct call â€” returns plain text string."""
    return get_bedrock_service().generate(prompt, system=system)


def generate_structured(
    prompt: str,
    output_schema: str,
    system: Optional[str] = None,
) -> Dict[str, Any]:
    """Direct call â€” returns parsed dict."""
    return get_bedrock_service().generate_structured(prompt, output_schema, system)


def embed_text(text: str) -> np.ndarray:
    """Direct call â€” returns 1536-dim numpy array."""
    return get_bedrock_service().embed(text)


def embed_batch(texts: List[str]) -> np.ndarray:
    """Direct call â€” returns (N, 1536) numpy array."""
    return get_bedrock_service().embed_batch(texts)
