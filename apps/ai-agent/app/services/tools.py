"""
Tool layer for the tutor harness: a small registry, a permission boundary, and an MCP client.

Why a boundary matters: the model (and the text it reads) is untrusted. So the harness - not the model - decides
what may run:
  * only tools in the registry run, and MCP tools only when named in MCP_TOOL_ALLOWLIST (default: none);
  * every tool is READ-ONLY by construction (no tool here writes, sends, or deletes anything);
  * at most MAX_CALLS tools per question, each with its own timeout;
  * tools receive only the arguments they declare, validated against their schema, never user ids or secrets;
  * results are redacted, length-capped and fenced as data before the model or the UI sees them.

MCP (Model Context Protocol): `McpClient` speaks the streamable-HTTP transport (JSON-RPC 2.0: initialize,
tools/list, tools/call; replies may be JSON or an SSE stream). Configure endpoints with MCP_SERVER_URLS.
Tool results from MCP servers are treated exactly like web text: untrusted data.
"""
from __future__ import annotations

import ast
import asyncio
import json
import logging
import operator
import re
import time
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Dict, List, Optional
from urllib.parse import urlparse

import httpx

from app.services.guardrails import clean_text, redact_secrets, scrub_source_text

logger = logging.getLogger(__name__)

MAX_CALLS = 3
MAX_ARG_CHARS = 1500
RESULT_CHARS = 1200      # what the model may see
SUMMARY_CHARS = 220      # what the timeline shows


@dataclass
class Tool:
    name: str
    description: str
    input_schema: Dict[str, Any]
    run: Callable[[Dict[str, Any]], Awaitable[str]]
    kind: str = "builtin"          # "builtin" | "mcp"
    timeout: float = 6.0
    origin: str = ""               # MCP server host, for display only


@dataclass
class ToolOutcome:
    name: str
    kind: str
    status: str                    # ok | error | timeout | denied
    ms: int
    summary: str                   # sanitized, short, safe to show a student
    text: str = ""                 # sanitized, bounded, fed to the model as DATA
    args: Dict[str, Any] = field(default_factory=dict)


# ── safe calculator (no eval) ────────────────────────────────────────────────────────────────

_BINOPS: Dict[type, Callable[[Any, Any], Any]] = {
    ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul, ast.Div: operator.truediv,
    ast.Pow: operator.pow, ast.Mod: operator.mod, ast.FloorDiv: operator.floordiv}
_UNOPS: Dict[type, Callable[[Any], Any]] = {ast.USub: operator.neg, ast.UAdd: operator.pos}
_EXPR = re.compile(r"(?<![\w.])(?:\d+(?:\.\d+)?|\([\d\s+\-*/^%().]+\))(?:\s*[-+*/^%]\s*(?:\d+(?:\.\d+)?|\([\d\s+\-*/^%().]+\)))+")


def safe_eval(expr: str) -> float:
    expr = expr.replace("^", "**")

    def ev(n: ast.AST) -> float:
        if isinstance(n, ast.Constant) and isinstance(n.value, (int, float)) and not isinstance(n.value, bool):
            return n.value
        if isinstance(n, ast.BinOp) and type(n.op) in _BINOPS:
            a, b = ev(n.left), ev(n.right)
            if isinstance(n.op, ast.Pow) and (abs(b) > 64 or abs(a) > 1e6):
                raise ValueError("exponent too large")
            return _BINOPS[type(n.op)](a, b)
        if isinstance(n, ast.UnaryOp) and type(n.op) in _UNOPS:
            return _UNOPS[type(n.op)](ev(n.operand))
        raise ValueError("unsupported expression")

    if len(expr) > 200:
        raise ValueError("expression too long")
    return ev(ast.parse(expr, mode="eval").body)


async def _calculator(args: Dict[str, Any]) -> str:
    expr = str(args.get("expression", ""))
    val = safe_eval(expr)
    return f"{expr} = {round(val, 10):g}" if isinstance(val, float) else f"{expr} = {val}"


async def _search_documents(args: Dict[str, Any]) -> str:
    from app.core.vector_store import get_vector_store

    hits = await get_vector_store().query(str(args.get("collection") or "default"), str(args["query"]), k=4)
    rows = [f"- {h.get('source') or 'Document'}: {(h.get('text') or '').strip()[:300]}" for h in hits if h.get("score", 0) >= 0.3]
    return "\n".join(rows) or "No matching passages in the learner's documents."


async def _web_search(args: Dict[str, Any]) -> str:
    from app.services.tavily_service import get_tavily_service

    svc = get_tavily_service()
    if not svc.available:
        raise RuntimeError("web search is not configured")
    results = await svc.search(str(args["query"]), max_results=4) or []
    return "\n".join(f"- {r.get('title', 'Result')} ({r.get('url', '')}): {(r.get('snippet') or r.get('content') or '')[:260]}" for r in results) or "No web results."


BUILTIN: Dict[str, Tool] = {
    "calculator": Tool("calculator", "Evaluate an arithmetic expression exactly.",
                       {"type": "object", "properties": {"expression": {"type": "string"}}, "required": ["expression"]}, _calculator, timeout=2),
    "search_documents": Tool("search_documents", "Search the learner's uploaded study material.",
                             {"type": "object", "properties": {"query": {"type": "string"}, "collection": {"type": "string"}}, "required": ["query"]}, _search_documents, timeout=5),
    "web_search": Tool("web_search", "Search the web for current facts.",
                       {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}, _web_search, timeout=5),
}


# ── MCP client (streamable HTTP) ─────────────────────────────────────────────────────────────

class McpClient:
    def __init__(self, url: str, timeout: float = 8.0):
        self.url = url
        self.timeout = timeout
        self.session_id: Optional[str] = None
        self._id = 0
        self._ready = False

    @property
    def host(self) -> str:
        return urlparse(self.url).netloc

    async def _rpc(self, http: httpx.AsyncClient, method: str, params: Optional[dict] = None, notify: bool = False) -> Any:
        self._id += 1
        body: Dict[str, Any] = {"jsonrpc": "2.0", "method": method, "params": params or {}}
        if not notify:
            body["id"] = self._id
        headers = {"Accept": "application/json, text/event-stream", "Content-Type": "application/json"}
        if self.session_id:
            headers["Mcp-Session-Id"] = self.session_id
        r = await http.post(self.url, json=body, headers=headers)
        r.raise_for_status()
        self.session_id = r.headers.get("mcp-session-id", self.session_id)
        if notify or not r.content:
            return None
        payload = _parse_rpc(r)
        if "error" in payload:
            raise RuntimeError(str(payload["error"].get("message", "MCP error"))[:200])
        return payload.get("result")

    async def _ensure(self, http: httpx.AsyncClient) -> None:
        if self._ready:
            return
        await self._rpc(http, "initialize", {"protocolVersion": "2025-03-26", "capabilities": {}, "clientInfo": {"name": "entropy-tutor", "version": "1.0"}})
        await self._rpc(http, "notifications/initialized", notify=True)
        self._ready = True

    async def list_tools(self) -> List[Dict[str, Any]]:
        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=False) as http:
            await self._ensure(http)
            return (await self._rpc(http, "tools/list") or {}).get("tools", [])

    async def call(self, name: str, arguments: Dict[str, Any]) -> str:
        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=False) as http:
            await self._ensure(http)
            res = await self._rpc(http, "tools/call", {"name": name, "arguments": arguments}) or {}
        text = "\n".join(c.get("text", "") for c in res.get("content", []) if isinstance(c, dict) and c.get("type") == "text")
        if res.get("isError"):
            raise RuntimeError(text[:200] or "tool reported an error")
        return text


def _parse_rpc(r: httpx.Response) -> Dict[str, Any]:
    if "text/event-stream" in r.headers.get("content-type", ""):
        for line in r.text.splitlines():
            if line.startswith("data:"):
                try:
                    return json.loads(line[5:].strip())
                except json.JSONDecodeError:
                    continue
        raise RuntimeError("empty MCP event stream")
    return r.json()


_mcp_cache: Dict[str, Any] = {"at": 0.0, "tools": {}}


async def mcp_tools() -> Dict[str, Tool]:
    """Allowlisted tools from configured MCP servers (cached 5 minutes). Unlisted tools are never exposed."""
    from app.core.config import settings

    urls = [u.strip() for u in settings.MCP_SERVER_URLS.split(",") if u.strip()]
    allow = {t.strip() for t in settings.MCP_TOOL_ALLOWLIST.split(",") if t.strip()}
    if not urls or not allow:
        return {}
    if time.time() - _mcp_cache["at"] < 300:
        return _mcp_cache["tools"]
    found: Dict[str, Tool] = {}
    for url in urls:
        if urlparse(url).scheme not in ("http", "https"):
            continue
        client = McpClient(url, settings.MCP_TIMEOUT_SECONDS)
        try:
            for t in await client.list_tools():
                name = t.get("name", "")
                if name in allow and name not in BUILTIN and name not in found:
                    found[name] = Tool(name, str(t.get("description", ""))[:300], t.get("inputSchema") or {"type": "object"},
                                       (lambda c, n: (lambda a: c.call(n, a)))(client, name), kind="mcp",
                                       timeout=settings.MCP_TIMEOUT_SECONDS, origin=client.host)
        except Exception as exc:
            logger.warning("MCP server %s unavailable: %s", client.host, exc)
    _mcp_cache.update(at=time.time(), tools=found)
    return found


def reset_mcp_cache() -> None:
    _mcp_cache.update(at=0.0, tools={})


# ── the permission boundary ──────────────────────────────────────────────────────────────────

def validate_args(tool: Tool, args: Any) -> Dict[str, Any]:
    """Only declared properties survive; required ones must be present; strings are cleaned and bounded."""
    if not isinstance(args, dict):
        raise ValueError("arguments must be an object")
    props = (tool.input_schema or {}).get("properties", {}) or {}
    out: Dict[str, Any] = {}
    for k, v in args.items():
        if k not in props:
            continue
        if isinstance(v, str):
            v = clean_text(v, MAX_ARG_CHARS)
        elif not isinstance(v, (int, float, bool)):
            continue
        out[k] = v
    missing = [r for r in (tool.input_schema or {}).get("required", []) if r not in out]
    if missing:
        raise ValueError("missing: " + ", ".join(missing))
    return out


def sanitize_output(text: str, limit: int) -> str:
    text, _ = scrub_source_text(text or "")      # drop instruction-like lines
    text, _ = redact_secrets(text)               # drop credentials
    return clean_text(text, limit)


async def execute(tool: Tool, args: Dict[str, Any]) -> ToolOutcome:
    t0 = time.perf_counter()

    def ms() -> int:
        return round((time.perf_counter() - t0) * 1000)

    try:
        clean_args = validate_args(tool, args)
        raw = await asyncio.wait_for(tool.run(clean_args), timeout=tool.timeout)
        text = sanitize_output(str(raw), RESULT_CHARS)
        return ToolOutcome(tool.name, tool.kind, "ok", ms(), sanitize_output(text, SUMMARY_CHARS), text, _preview(clean_args))
    except asyncio.TimeoutError:
        return ToolOutcome(tool.name, tool.kind, "timeout", ms(), "Took too long, skipped.", args=_preview(args if isinstance(args, dict) else {}))
    except asyncio.CancelledError:
        raise
    except Exception as exc:
        logger.info("tool %s failed: %s", tool.name, exc)
        return ToolOutcome(tool.name, tool.kind, "error", ms(), sanitize_output(f"Could not run: {exc}", SUMMARY_CHARS), args=_preview(args if isinstance(args, dict) else {}))


def _preview(args: Dict[str, Any]) -> Dict[str, Any]:
    return {k: (v[:80] if isinstance(v, str) else v) for k, v in list(args.items())[:4]}


def find_arithmetic(question: str) -> Optional[str]:
    m = _EXPR.search(question)
    return m.group(0).strip() if m else None
