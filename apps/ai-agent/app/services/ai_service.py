"""
Entropy AI service: Groq (via LangChain) for generation, fastembed for embeddings.

  LLM   : Groq through langchain-groq (a 70B model for generation, an 8B model for routing)
  Embed : fastembed (local ONNX, BAAI/bge-small-en-v1.5, 384 dimensions)

Public API
----------
    from app.services.ai_service import get_ai_service
    svc = get_ai_service()
    svc.generate(prompt, system=...)              -> str
    svc.generate_with_history(messages, ...)      -> str
    svc.generate_structured(prompt, schema_str)   -> dict
    svc.embed(text) / svc.embed_batch(texts)      -> np.ndarray
    svc.chunk_text / chunk_and_embed / upsert_to_pinecone
"""

from __future__ import annotations

import json
import logging
import os
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from functools import lru_cache
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)


def _settings():
    from app.core.config import settings
    return settings


class AINotConfigured(RuntimeError):
    """Raised when a provider key is missing; the API maps it to HTTP 503."""


class AIService:
    """Groq chat models plus local embeddings behind one small interface."""

    def __init__(self, temperature: Optional[float] = None, max_tokens: Optional[int] = None):
        s = _settings()
        self.temperature = s.LLM_TEMPERATURE if temperature is None else temperature
        self.max_tokens = max_tokens or s.LLM_MAX_TOKENS
        self.dimensions = s.EMBEDDING_DIMENSIONS
        self._chat_models: Dict[Tuple[str, float, int, bool], Any] = {}
        self._embedder: Any = None
        self._embed_lock = threading.Lock()

    # -- LLM -------------------------------------------------------------------

    def _chat(self, fast: bool, temperature: float, max_tokens: int, json_mode: bool = False):
        s = _settings()
        if not s.GROQ_API_KEY:
            raise AINotConfigured("GROQ_API_KEY is not configured.")
        model = s.GROQ_FAST_MODEL if fast else s.GROQ_MODEL
        key = (model, temperature, max_tokens, json_mode)
        if key not in self._chat_models:
            from langchain_groq import ChatGroq

            kwargs: Dict[str, Any] = {}
            extra: Dict[str, Any] = {"top_p": s.LLM_TOP_P}  # via model_kwargs: a field on newer langchain-groq, extra on older
            if json_mode:
                extra["response_format"] = {"type": "json_object"}
            effort = s.GROQ_FAST_REASONING_EFFORT if fast else s.GROQ_REASONING_EFFORT
            if model.startswith(("openai/gpt-oss", "qwen/")) and effort:
                kwargs["reasoning_effort"] = effort  # reasoning models: fewer hidden tokens = faster answers
            kwargs["model_kwargs"] = extra
            self._chat_models[key] = ChatGroq(
                model=model,
                api_key=s.GROQ_API_KEY,
                temperature=temperature,
                max_tokens=max_tokens,
                max_retries=1 if fast else s.LLM_MAX_RETRIES,  # a stalled helper call should fall back, not sleep through rate limits
                timeout=s.LLM_TIMEOUT_SECONDS,
                **kwargs,
            )
        return self._chat_models[key]

    def warm_up(self) -> None:
        """Import the Groq client and build both chat models now, so the first student does not pay ~5 s for it."""
        s = _settings()
        if not s.GROQ_API_KEY:
            return
        self._chat(False, self.temperature, self.max_tokens)
        self._chat(True, 0.2, 300, json_mode=True)

    @staticmethod
    def _to_lc_messages(messages: List[Dict[str, Any]], system: Optional[str]):
        from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

        out: List[Any] = [SystemMessage(content=system)] if system else []
        for m in messages:
            role, content = m.get("role", "user"), m.get("content", "")
            if isinstance(content, list):  # tolerate block-style content
                content = "".join(b.get("text", "") for b in content if isinstance(b, dict))
            if role == "system":
                out.append(SystemMessage(content=content))
            elif role == "assistant":
                out.append(AIMessage(content=content))
            else:
                out.append(HumanMessage(content=content))
        return out

    def generate_with_history(
        self,
        messages: List[Dict[str, Any]],
        system: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        fast: bool = False,
        json_mode: bool = False,
    ) -> str:
        """Multi-turn conversation. `messages` is a list of {role, content} dicts."""
        chat = self._chat(
            fast,
            self.temperature if temperature is None else temperature,
            max_tokens or self.max_tokens,
            json_mode,
        )
        return chat.invoke(self._to_lc_messages(messages, system)).content

    def generate(
        self,
        prompt: str,
        system: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        fast: bool = False,
    ) -> str:
        """Single-turn text generation."""
        return self.generate_with_history(
            [{"role": "user", "content": prompt}],
            system=system, temperature=temperature, max_tokens=max_tokens, fast=fast,
        )

    def generate_structured(
        self,
        prompt: str,
        output_schema: str,
        system: Optional[str] = None,
        fast: bool = False,
    ) -> Dict[str, Any]:
        """Reply as a JSON object matching `output_schema` (Groq JSON mode)."""
        json_system = (
            (system + "\n\n" if system else "")
            + "Reply ONLY with a single JSON object that matches this schema:\n"
            + output_schema
            + "\nString values may use markdown (## headings, **bold**, lists)."
        )
        raw = self.generate_with_history(
            [{"role": "user", "content": prompt}],
            system=json_system, temperature=0.3, fast=fast, json_mode=True,
        ).strip()
        if raw.startswith("```"):
            raw = "\n".join(raw.split("\n")[1:]).rstrip("`").strip()
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            logger.warning("generate_structured: JSON parse failed, returning raw text")
            return {"raw_response": raw}

    # -- Native async (used by the pipeline harness: no thread hop, real token streaming) --------

    async def astream_segments(
        self,
        messages: List[Dict[str, Any]],
        system: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        fast: bool = False,
    ):
        """Yield ("token", text) for each piece and a final ("finish", reason) for ONE generation call.

        `reason` is Groq's finish_reason: "stop" (complete) or "length" (hit max_tokens, so the answer is cut off).
        Closing the generator (client disconnect, task cancel) closes the HTTP stream to Groq.
        """
        chat = self._chat(fast, self.temperature if temperature is None else temperature, max_tokens or self.max_tokens)
        stream = chat.astream(self._to_lc_messages(messages, system))
        finish = "stop"
        try:
            async for chunk in stream:
                if chunk.content:
                    yield "token", chunk.content
                reason = (getattr(chunk, "response_metadata", None) or {}).get("finish_reason")
                if reason:
                    finish = reason
        finally:
            aclose = getattr(stream, "aclose", None)
            if aclose:
                await aclose()
        yield "finish", finish

    async def astream(
        self,
        messages: List[Dict[str, Any]],
        system: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        fast: bool = False,
    ):
        """Yield the full reply token by token, continuing across token-limit cut-offs (see astream_complete)."""
        async for kind, value in self.astream_complete(messages, system, temperature, max_tokens, fast):
            if kind == "token":
                yield value

    async def astream_complete(
        self,
        messages: List[Dict[str, Any]],
        system: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        fast: bool = False,
    ):
        """Stream a reply and never silently clip it.

        When a segment ends with finish_reason == "length", ask the model to continue from exactly where it
        stopped (the text so far is sent back as an assistant turn) up to LLM_MAX_CONTINUATIONS times.
        Yields ("token", text), ("continuation", n) before each extra segment, and ("done", info) at the end where
        info = {"finish_reason", "continuations", "truncated"}. `truncated` is True only when the cap was reached
        and the answer is still unfinished, so callers can tell the user instead of pretending it is complete.
        """
        limit = _settings().LLM_MAX_CONTINUATIONS
        produced = ""            # everything the caller has been given
        convo = list(messages)
        finish, continuations = "stop", 0
        while True:
            held = ""            # trailing partial word of this segment, not yet shown
            fresh_segment = True
            async for kind, value in self.astream_segments(convo, system, temperature, max_tokens, fast):
                if kind != "token":
                    finish = value
                    continue
                # Show only whole words. If this segment stops at the token limit, its last word is almost always
                # cut mid-way ("...12, 1" for 13); a model asked to continue from there garbles the splice. So the
                # last partial word is held back and either flushed (clean stop) or dropped and regenerated (cut).
                text = held + value
                cut = max(text.rfind(" "), text.rfind(chr(10)), text.rfind(chr(9))) + 1  # last space / newline / tab
                held, text = text[cut:], text[:cut]
                if continuations and fresh_segment and text:
                    text = _strip_overlap(produced, text)       # the model sometimes re-writes the tail it was given
                if text:
                    fresh_segment = False
                    produced += text
                    yield "token", text
            if finish != "length":
                if held:
                    yield "token", held if not (continuations and fresh_segment) else _strip_overlap(produced, held)
                    produced += held
                break
            if continuations >= limit:
                if held:                     # out of continuations: show the partial word rather than silently lose it
                    yield "token", held
                    produced += held
                break
            continuations += 1
            yield "continuation", continuations
            convo = list(messages) + [
                {"role": "assistant", "content": produced},
                {"role": "user", "content": "Continue exactly where you stopped. Do not repeat anything already written and do not restart."},
            ]
        yield "done", {"finish_reason": finish, "continuations": continuations, "truncated": finish == "length"}

    async def agenerate_json(
        self,
        prompt: str,
        system: str,
        fast: bool = True,
        max_tokens: int = 700,
        temperature: float = 0.2,
    ) -> Dict[str, Any]:
        """One JSON-mode call. Returns {} when the model returns something unparseable."""
        chat = self._chat(fast, temperature, max_tokens, json_mode=True)
        msg = await chat.ainvoke(self._to_lc_messages([{"role": "user", "content": prompt}], system + "\nReply with one JSON object only."))
        raw = (msg.content or "").strip()
        if raw.startswith("```"):
            raw = "\n".join(raw.split("\n")[1:]).rstrip("`").strip()
        try:
            out = json.loads(raw)
            return out if isinstance(out, dict) else {}
        except json.JSONDecodeError:
            logger.warning("agenerate_json: unparseable reply: %.120s", raw)
            return {}

    # -- Embeddings (fastembed, loaded lazily so cold start stays light) -------

    def _get_embedder(self):
        if self._embedder is None:
            with self._embed_lock:
                if self._embedder is None:
                    from fastembed import TextEmbedding

                    name = _settings().EMBEDDING_MODEL
                    logger.info("Loading embedding model %s", name)
                    self._embedder = TextEmbedding(model_name=name, threads=max(1, min(os.cpu_count() or 1, _settings().EMBED_THREADS)))
        return self._embedder

    def embed(self, text: str) -> np.ndarray:
        """Embed one text; returns a float32 vector of length `dimensions`."""
        if not text or not text.strip():
            raise ValueError("Cannot embed empty text.")
        return self.embed_batch([text])[0]

    def embed_batch(self, texts: List[str], max_workers: int = 0) -> np.ndarray:
        """Embed many texts; returns an (N, dimensions) array. `max_workers` is ignored (kept for callers)."""
        if not texts:
            raise ValueError("embed_batch expects a non-empty list.")
        # Embed in length order: each batch is padded to its longest text, so similar lengths waste far less compute.
        order = sorted(range(len(texts)), key=lambda i: len(texts[i]))
        vectors = list(self._get_embedder().embed([texts[i] for i in order], batch_size=64))
        out = np.empty((len(texts), len(vectors[0])), dtype=np.float32)
        for pos, i in enumerate(order):
            out[i] = vectors[pos]
        return out

    # -- Chunking and Pinecone ---------------------------------------------------

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
        (chunks, embeddings) where embeddings.shape == (N, self.dimensions)
        """
        chunks = self.chunk_text(text, chunk_size=chunk_size, overlap=overlap)
        if not chunks:
            return [], np.empty((0, self.dimensions), dtype=np.float32)
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
        1. Parallel embed   : fan out N embedding calls via ThreadPoolExecutor
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

    def similarity(self, text1: str, text2: str) -> float:
        """Cosine similarity between two texts."""
        e1, e2 = self.embed(text1), self.embed(text2)
        denom = np.linalg.norm(e1) * np.linalg.norm(e2)
        return float(np.dot(e1, e2) / denom) if denom > 0 else 0.0


def _strip_overlap(produced: str, fresh: str, window: int = 60) -> str:
    """Remove a repeated prefix: if `fresh` starts with text that already ends `produced`, cut it off."""
    tail = produced[-window:]
    for k in range(min(len(tail), len(fresh)), 7, -1):
        if tail.endswith(fresh[:k]):
            return fresh[k:]
    return fresh


@lru_cache(maxsize=1)
def get_ai_service() -> AIService:
    """Process-wide AIService instance."""
    return AIService()
