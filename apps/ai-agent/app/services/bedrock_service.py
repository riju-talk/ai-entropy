"""
Entropy AI Bedrock Service
======================
Drop-in replacement for Gemini + Pinecone.

  LLM  : Amazon Bedrock — Amazon Nova Premier
  Embed: Amazon Bedrock — Titan Embeddings V2

Public API
----------
    from app.services.bedrock_service import (
        # LLM
        generate_text,
        generate_structured,
        # Embedding (single / parallel batch)
        embed_text,
        embed_batch,            # parallel via ThreadPoolExecutor
        # Chunking
        chunk_text,             # fast pure-Python recursive splitter
        chunk_and_embed,        # chunk + embed in one call
        # Pinecone
        upsert_to_pinecone,     # embed texts + upsert vectors in parallel
        BedrockService,
    )
"""

from __future__ import annotations

import json
import logging
import os
import random
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from functools import lru_cache
from threading import Semaphore
from typing import Any, Dict, List, Optional, Tuple

import boto3
import numpy as np
from botocore.config import Config
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

# Read model IDs from the pydantic Settings object so dotenv is guaranteed loaded
def _settings():
    from app.core.config import settings
    return settings


def _claude_model_id() -> str:
    return _settings().BEDROCK_CLAUDE_MODEL


def _titan_embed_id() -> str:
    return _settings().BEDROCK_TITAN_EMBED


def _aws_region() -> str:
    return _settings().AWS_REGION


# Maximum concurrent Bedrock embed calls.
# Keep at or below your Bedrock TPS quota for Titan Embeddings.
_EMBED_MAX_WORKERS: int = int(os.getenv("BEDROCK_EMBED_WORKERS", "10"))


@lru_cache(maxsize=1)
def _get_client() -> Any:
    """Return a cached boto3 bedrock-runtime client.

    max_pool_connections is set to match _EMBED_MAX_WORKERS so urllib3 never
    discards connections (the root cause of the 'Connection pool is full'
    warnings seen when workers > pool size).
    """
    pool_size = max(_EMBED_MAX_WORKERS + 4, 16)  # headroom for LLM calls
    cfg = Config(
        region_name=_aws_region(),
        retries={"max_attempts": 3, "mode": "adaptive"},
        max_pool_connections=pool_size,
    )
    return boto3.client("bedrock-runtime", config=cfg)

    
class BedrockService:
    """Thin wrapper around Claude 3 Sonnet and Titan Embeddings."""

    def __init__(
        self,
        model_id: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ):
        self.model_id   = model_id or _claude_model_id()
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
            + "IMPORTANT: You must reply ONLY with a raw JSON object that matches this schema:\n"
            + output_schema
            + "\n- Do NOT wrap the JSON in ```json code fences."
            + "\n- String values inside the JSON (e.g. final_solution) MUST use markdown"
            + " formatting (## headings, **bold**, lists, ---) exactly as instructed."
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

    # ── Embedding ─────────────────────────────────────────────────────────────────────

    def embed(self, text: str, _max_retries: int = 6) -> np.ndarray:
        """Single embedding via Titan Embed Text V2 (1536-dim).

        Retries up to `_max_retries` times on ThrottlingException with
        full-jitter exponential backoff (cap 60 s) so parallel workers
        recover automatically without failing the whole batch.
        """
        if not text or not text.strip():
            raise ValueError("Cannot embed empty text.")
        body = json.dumps({"inputText": text[:8192]})  # Titan hard limit
        delay = 1.0
        for attempt in range(_max_retries + 1):
            try:
                response = self._client.invoke_model(
                    modelId=_titan_embed_id(),
                    contentType="application/json",
                    accept="application/json",
                    body=body,
                )
                result = json.loads(response["body"].read())
                return np.array(result["embedding"], dtype=np.float32)
            except ClientError as exc:
                code = exc.response["Error"]["Code"]
                if code in ("ThrottlingException", "TooManyRequestsException") and attempt < _max_retries:
                    sleep = random.uniform(0, min(delay, 60.0))  # full jitter
                    logger.warning(
                        "Bedrock ThrottlingException (attempt %d/%d) — retrying in %.1fs",
                        attempt + 1, _max_retries, sleep,
                    )
                    time.sleep(sleep)
                    delay *= 2
                else:
                    raise

    def embed_batch(
        self,
        texts: List[str],
        max_workers: int = _EMBED_MAX_WORKERS,
    ) -> np.ndarray:
        """
        Embed multiple texts in parallel using a ThreadPoolExecutor.

        Concurrency is capped by a Semaphore so we never exceed
        `max_workers` simultaneous in-flight Bedrock calls regardless of
        how many threads the executor itself has allocated.

        Default `max_workers` reads from the BEDROCK_EMBED_WORKERS env var
        (default 10). Raise it carefully — Titan's TPS quota is the limit.

        Returns np.ndarray of shape (N, 1536).
        """
        if not texts:
            raise ValueError("embed_batch expects a non-empty list.")
        workers = min(max_workers, len(texts))
        sem = Semaphore(workers)  # hard cap on simultaneous in-flight calls
        results: List[Optional[np.ndarray]] = [None] * len(texts)

        def _embed_one(idx: int, text: str) -> None:
            with sem:
                results[idx] = self.embed(text)

        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = [pool.submit(_embed_one, i, t) for i, t in enumerate(texts)]
            for future in as_completed(futures):
                future.result()  # re-raise any non-throttle exception immediately

        return np.stack(results)  # (N, 1536)

    # ── Chunking ──────────────────────────────────────────────────────────────────────

    @staticmethod
    def chunk_text(
        text: str,
        chunk_size: int = 512,
        overlap: int = 64,
        separators: Optional[List[str]] = None,
    ) -> List[str]:
        """
        Fast pure-Python recursive text chunker.

        Splits on separators in priority order (paragraph -> sentence ->
        word -> character) so chunks never straddle a sentence when avoidable.

        Parameters
        ----------
        text       : raw input text
        chunk_size : max characters per chunk (default 512)
        overlap    : characters of overlap between consecutive chunks (default 64)
        separators : override split hierarchy; defaults to ["\\n\\n","\\n"," ",""]

        Returns
        -------
        List[str] of non-empty chunks, each <= chunk_size chars
        """
        if not text or not text.strip():
            return []
        seps = separators or ["\n\n", "\n", " ", ""]

        def _split(txt: str, sep_idx: int) -> List[str]:
            if len(txt) <= chunk_size or sep_idx >= len(seps):
                return [txt] if txt.strip() else []
            sep = seps[sep_idx]
            parts = txt.split(sep) if sep else list(txt)
            chunks: List[str] = []
            current = ""
            for part in parts:
                candidate = (current + sep + part) if current else part
                if len(candidate) <= chunk_size:
                    current = candidate
                else:
                    if current.strip():
                        chunks.extend(_split(current, sep_idx + 1))
                    current = part
            if current.strip():
                chunks.extend(_split(current, sep_idx + 1))
            return chunks

        raw_chunks = _split(text.strip(), 0)
        if overlap <= 0 or len(raw_chunks) <= 1:
            return raw_chunks

        overlapped: List[str] = [raw_chunks[0]]
        for i in range(1, len(raw_chunks)):
            tail = raw_chunks[i - 1][-overlap:]
            overlapped.append(tail + raw_chunks[i])
        return overlapped

    # ── chunk + embed ─────────────────────────────────────────────────────────────────

    def chunk_and_embed(
        self,
        text: str,
        chunk_size: int = 512,
        overlap: int = 64,
        max_workers: int = 30,
    ) -> Tuple[List[str], np.ndarray]:
        """
        Chunk `text` then embed all chunks concurrently.

        Returns
        -------
        (chunks, embeddings) where embeddings.shape == (N, 1536)
        """
        chunks = self.chunk_text(text, chunk_size=chunk_size, overlap=overlap)
        if not chunks:
            return [], np.empty((0, 1536), dtype=np.float32)
        return chunks, self.embed_batch(chunks, max_workers=max_workers)

    # ── Pinecone upsert ──────────────────────────────────────────────────────────────

    def upsert_to_pinecone(
        self,
        texts: List[str],
        namespace: str = "default",
        metadata: Optional[List[Dict[str, Any]]] = None,
        batch_size: int = 100,
        max_embed_workers: int = 30,
        max_upsert_workers: int = 10,
        id_prefix: str = "",
    ) -> int:
        """
        Embed `texts` in parallel then upsert all vectors to Pinecone.

        Pipeline
        --------
        1. Parallel embed   : fan out N Bedrock Titan calls via ThreadPoolExecutor
        2. Build records    : {id, values (float list), metadata}
        3. Parallel upsert  : split records into batches of `batch_size`,
                              upsert each batch concurrently

        Parameters
        ----------
        texts              : list of text strings to embed and upsert
        namespace          : Pinecone namespace
        metadata           : optional per-text metadata dicts (one per text)
        batch_size         : vectors per Pinecone upsert call (Pinecone max = 100)
        max_embed_workers  : thread pool size for the embedding phase
        max_upsert_workers : thread pool size for the upsert phase
        id_prefix          : optional string prefix on generated vector IDs

        Returns
        -------
        int — total vectors upserted
        """
        try:
            from pinecone import Pinecone  # type: ignore
        except ImportError as exc:
            raise RuntimeError(
                "pinecone-client not installed. Run: pip install pinecone-client"
            ) from exc

        s = _settings()
        if not s.PINECONE_API_KEY:
            raise RuntimeError("PINECONE_API_KEY is not configured.")
        if not texts:
            return 0

        meta_list = metadata or [{}] * len(texts)
        if len(meta_list) != len(texts):
            raise ValueError("metadata length must match texts length.")

        # 1. Embed in parallel
        logger.info(
            "[upsert_to_pinecone] Embedding %d chunks (workers=%d)...",
            len(texts), max_embed_workers,
        )
        embeddings = self.embed_batch(texts, max_workers=max_embed_workers)

        # 2. Build vector records
        ALLOWED = (str, int, float, bool)
        vectors: List[Dict[str, Any]] = []
        for text, emb, meta in zip(texts, embeddings, meta_list):
            safe_meta = {k: v for k, v in meta.items() if isinstance(v, ALLOWED)}
            safe_meta["text"] = text[:2000]  # stored for retrieval
            vectors.append({
                "id":       f"{id_prefix}{uuid.uuid4()}",
                "values":   emb.tolist(),
                "metadata": safe_meta,
            })

        # 3. Upsert in parallel batches
        pc    = Pinecone(api_key=s.PINECONE_API_KEY)
        index = pc.Index(host=s.PINECONE_HOST) if s.PINECONE_HOST else pc.Index(s.PINECONE_INDEX_NAME)
        batches = [vectors[i: i + batch_size] for i in range(0, len(vectors), batch_size)]

        logger.info(
            "[upsert_to_pinecone] Upserting %d vectors in %d batch(es) to ns='%s'...",
            len(vectors), len(batches), namespace,
        )

        def _upsert(batch: List[Dict[str, Any]]) -> None:
            index.upsert(vectors=batch, namespace=namespace)

        with ThreadPoolExecutor(max_workers=min(max_upsert_workers, len(batches))) as pool:
            futures = [pool.submit(_upsert, b) for b in batches]
            for f in as_completed(futures):
                f.result()  # re-raise any exception

        logger.info("[upsert_to_pinecone] Done — %d vectors upserted.", len(vectors))
        return len(vectors)

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
        model_id    = _claude_model_id(),
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
    """Returns a 1536-dim numpy array for a single text."""
    return get_bedrock_service().embed(text)


def embed_batch(texts: List[str], max_workers: int = 30) -> np.ndarray:
    """Returns (N, 1536) numpy array — parallel Bedrock calls."""
    return get_bedrock_service().embed_batch(texts, max_workers=max_workers)


def chunk_text(
    text: str,
    chunk_size: int = 512,
    overlap: int = 64,
    separators: Optional[List[str]] = None,
) -> List[str]:
    """Chunk text using the fast pure-Python recursive splitter."""
    return BedrockService.chunk_text(text, chunk_size=chunk_size, overlap=overlap, separators=separators)


def chunk_and_embed(
    text: str,
    chunk_size: int = 512,
    overlap: int = 64,
    max_workers: int = 30,
) -> Tuple[List[str], np.ndarray]:
    """Chunk text and embed all chunks concurrently. Returns (chunks, embeddings)."""
    return get_bedrock_service().chunk_and_embed(text, chunk_size=chunk_size, overlap=overlap, max_workers=max_workers)


def upsert_to_pinecone(
    texts: List[str],
    namespace: str = "default",
    metadata: Optional[List[Dict[str, Any]]] = None,
    batch_size: int = 100,
    max_embed_workers: int = 30,
    max_upsert_workers: int = 10,
    id_prefix: str = "",
) -> int:
    """Embed texts in parallel and upsert all vectors to Pinecone. Returns total upserted."""
    return get_bedrock_service().upsert_to_pinecone(
        texts=texts,
        namespace=namespace,
        metadata=metadata,
        batch_size=batch_size,
        max_embed_workers=max_embed_workers,
        max_upsert_workers=max_upsert_workers,
        id_prefix=id_prefix,
    )
