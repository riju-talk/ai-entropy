"""
Local knowledge graph: an in-process fallback that makes graph retrieval work with NO external database.

The Neo4j graph (knowledge_graph_service) stays the primary store when it is configured and reachable. When it is
not (e.g. the free Render deployment has no Neo4j), the harness uses this module instead, so the tutor still gets
prerequisites, "what this unlocks" and related concepts. It is seeded from the same curated map as Neo4j
(concept_seeder.CONCEPTS) and keeps learning from answers while the process runs.

What it does, per the graph checklist:
  entity extraction      concepts arrive from the harness's `understand` stage (LLM) and `grow` (review stage)
  normalization          lower-case, strip punctuation/articles, collapse whitespace, naive plural folding,
                         plus an alias table ("ml" -> "machine learning", "bst" -> "binary search tree"...)
  deduplication          one node per normalized key; aliases and sources merge into it
  relationship storage   PREREQUISITE_OF and RELATED_TO edges; prerequisite edges can never form a cycle
  traversal              transitive prerequisites (depth-limited, ordered foundational -> advanced), direct unlocks
  semantic retrieval     lexical similarity: token overlap + character-trigram cosine. NOT embedding-based; it is
                         deterministic and needs no model download. Good for name variants, not for paraphrases.
  context ranking        neighbours are ranked by edge confidence (more independent sources first), then by how close
                         their difficulty is to the concept's, and capped
  provenance             every edge keeps the set of sources that asserted it ("seed", "answer", ...)

Limits: state is per process and lost on restart (Neo4j is the persistent option); learned edges are only as good as
the model that proposed them, so they start with one source and rank below curated ones.
"""
from __future__ import annotations

import math
import re
import threading
from collections import Counter
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple

PREREQ, RELATED = "PREREQUISITE_OF", "RELATED_TO"

ALIASES = {
    "ml": "machine learning", "ai": "artificial intelligence", "dl": "deep learning", "nn": "neural network",
    "bst": "binary search tree", "dp": "dynamic programming", "oop": "object oriented programming",
    "dfs": "depth first search", "bfs": "breadth first search", "nlp": "natural language processing",
    "sgd": "stochastic gradient descent", "db": "database", "os": "operating system",
}
_STOP = {"a", "an", "the", "of", "in", "to", "and", "for", "on", "is", "what", "how", "about", "explain", "define"}


def normalize(name: str) -> str:
    """Canonical key for a concept name. Same key = same node."""
    s = re.sub(r"[^a-z0-9\s]", " ", (name or "").lower().replace("&", " and "))
    words = [w for w in s.split() if w not in _STOP or len(s.split()) == 1]
    s = " ".join(words)
    s = ALIASES.get(s, s)
    out = []
    for w in s.split():
        if len(w) > 3 and w.endswith("ies"):
            w = w[:-3] + "y"
        elif len(w) > 3 and w.endswith("s") and not w.endswith(("ss", "us", "is")):
            w = w[:-1]
        out.append(w)
    return " ".join(out)


def _trigrams(s: str) -> Counter:
    p = f"  {s} "
    return Counter(p[i:i + 3] for i in range(len(p) - 2))


def similarity(a: str, b: str) -> float:
    """0..1. Blend of token containment and trigram cosine, so 'gradient descent algorithm' ~ 'gradient descent'."""
    ta, tb = set(a.split()), set(b.split())
    if not ta or not tb:
        return 0.0
    contain = len(ta & tb) / min(len(ta), len(tb))
    ga, gb = _trigrams(a), _trigrams(b)
    dot = sum(ga[k] * gb[k] for k in ga.keys() & gb.keys())
    cos = dot / (math.sqrt(sum(v * v for v in ga.values())) * math.sqrt(sum(v * v for v in gb.values())) or 1)
    return 0.55 * contain + 0.45 * cos


@dataclass
class Node:
    key: str
    name: str
    domain: str = ""
    description: str = ""
    difficulty: int = 5
    aliases: Set[str] = field(default_factory=set)


class LocalGraph:
    MATCH_THRESHOLD = 0.72

    def __init__(self) -> None:
        self.nodes: Dict[str, Node] = {}
        self.edges: Dict[Tuple[str, str, str], Set[str]] = {}   # (src, dst, rel) -> sources
        self._out: Dict[str, Set[Tuple[str, str]]] = {}          # src -> {(dst, rel)}
        self._in: Dict[str, Set[Tuple[str, str]]] = {}           # dst -> {(src, rel)}
        self._lock = threading.RLock()
        self._seeded = False

    # -- write ----------------------------------------------------------------------------
    def add_concept(self, name: str, domain: str = "", description: str = "", difficulty: int = 5) -> Optional[Node]:
        key = normalize(name)
        if len(key) < 2:
            return None
        with self._lock:
            node = self.nodes.get(key)
            if node is None:
                node = self.nodes[key] = Node(key, name.strip(), domain, description, difficulty)
            else:  # dedupe: keep the richer fields, remember the other spelling
                if name.strip() != node.name:
                    node.aliases.add(name.strip())
                node.domain = node.domain or domain
                node.description = node.description or description
            return node

    def link(self, a: str, b: str, rel: str, source: str) -> bool:
        """Add edge a -> b. Returns False for self-links and for prerequisite edges that would create a cycle."""
        ka, kb = normalize(a), normalize(b)
        if ka == kb or ka not in self.nodes or kb not in self.nodes:
            return False
        with self._lock:
            if rel == PREREQ and self._reaches(kb, ka):
                return False
            self.edges.setdefault((ka, kb, rel), set()).add(source)
            self._out.setdefault(ka, set()).add((kb, rel))
            self._in.setdefault(kb, set()).add((ka, rel))
            return True

    def _reaches(self, start: str, goal: str) -> bool:
        """Is `goal` reachable from `start` along PREREQUISITE_OF edges?"""
        seen, stack = set(), [start]
        while stack:
            cur = stack.pop()
            if cur == goal:
                return True
            if cur in seen:
                continue
            seen.add(cur)
            stack.extend(d for d, r in self._out.get(cur, ()) if r == PREREQ)
        return False

    def seed(self) -> None:
        if self._seeded:
            return
        with self._lock:
            if self._seeded:
                return
            from app.services.concept_seeder import CONCEPTS

            for name, desc, domain, diff, _ in CONCEPTS:
                self.add_concept(name, domain, desc, diff)
            for name, _d, _dom, _diff, prereqs in CONCEPTS:
                for p in prereqs:
                    self.link(p, name, PREREQ, "seed")
            self._seeded = True

    def grow(self, concept: str, prerequisites: List[str], related: List[str], domain: str = "", source: str = "answer") -> int:
        """Learn from an answer. Returns how many new edges were stored."""
        self.seed()
        node = self.add_concept(concept, domain)
        if not node:
            return 0
        added = 0
        for p in prerequisites[:5]:
            if p and self.add_concept(p, domain) and self.link(p, node.name, PREREQ, source):
                added += 1
        for r in related[:5]:
            if r and self.add_concept(r, domain) and self.link(node.name, r, RELATED, source):
                added += 1
        return added

    # -- read -----------------------------------------------------------------------------
    def resolve(self, query: str) -> Optional[Node]:
        """Exact key, then alias, then best lexical match above MATCH_THRESHOLD."""
        self.seed()
        key = normalize(query)
        if len(key) < 2:
            return None
        if key in self.nodes:
            return self.nodes[key]
        for node in self.nodes.values():
            if key in {normalize(a) for a in node.aliases}:
                return node
        best, score = None, 0.0
        for node in self.nodes.values():
            s = similarity(key, node.key)
            if s > score:
                best, score = node, s
        return best if best is not None and score >= self.MATCH_THRESHOLD else None

    def _rank(self, node: Node, neighbours: List[Tuple[str, Set[str]]]) -> List[Node]:
        scored = []
        for key, sources in neighbours:
            n = self.nodes[key]
            confidence = len(sources) + (1.0 if "seed" in sources else 0.0)   # curated edges outrank a single model guess
            closeness = 1.0 / (1 + abs((n.difficulty or 5) - (node.difficulty or 5)))
            scored.append((confidence + 0.5 * closeness, n))
        scored.sort(key=lambda t: (-t[0], t[1].name))
        return [n for _, n in scored]

    def prerequisites(self, node: Node, depth: int = 2, limit: int = 6) -> List[Node]:
        """Prerequisites up to `depth` hops, foundational first (a sensible study order), de-duplicated."""
        levels: List[List[Node]] = []
        frontier, seen = [node], {node.key}
        for _ in range(depth):
            nxt: List[Node] = []
            for cur in frontier:
                direct = [(s, self.edges[(s, cur.key, PREREQ)]) for s, r in self._in.get(cur.key, ()) if r == PREREQ and s not in seen]
                for n in self._rank(cur, direct):
                    if n.key not in seen:
                        seen.add(n.key)
                        nxt.append(n)
            if not nxt:
                break
            levels.append(nxt)
            frontier = nxt
        ordered = [n for level in reversed(levels) for n in level]  # deepest (most foundational) first
        return ordered[:limit]

    def context(self, name: str, user_id: Optional[str] = None) -> Optional[dict]:
        """Same shape as knowledge_graph_service.get_graph_context, plus `source` and `provenance`."""
        node = self.resolve(name)
        if not node:
            return None
        pre = self.prerequisites(node)
        deps = self._rank(node, [(d, self.edges[(node.key, d, PREREQ)]) for d, r in self._out.get(node.key, ()) if r == PREREQ])[:5]
        rel_keys = {d for d, r in self._out.get(node.key, ()) if r == RELATED} | {s for s, r in self._in.get(node.key, ()) if r == RELATED}
        rel = self._rank(node, [(k, self.edges.get((node.key, k, RELATED)) or self.edges.get((k, node.key, RELATED)) or set()) for k in rel_keys])[:5]
        sources = set()
        for n in pre + deps + rel:
            for (a, b, _r), srcs in self.edges.items():
                if node.key in (a, b) and n.key in (a, b):
                    sources |= srcs
        return {
            "id": node.key, "name": node.name, "description": node.description, "difficulty": node.difficulty,
            "prerequisites": [{"name": n.name, "id": n.key, "mastered": False} for n in pre],
            "dependents": [{"name": n.name, "id": n.key} for n in deps],
            "related": [{"name": n.name, "id": n.key} for n in rel],
            "mastery": None, "source": "local", "provenance": sorted(sources),
        }

    def mentioned_in(self, question: str, limit: int = 3) -> List[str]:
        """Concept names that literally appear in the question (longest first, so 'binary search tree' beats 'tree')."""
        self.seed()
        q = f" {normalize(question)} "
        hits = [n.name for k, n in self.nodes.items() if len(k) >= 4 and f" {k} " in q]
        return sorted(set(hits), key=lambda x: -len(x))[:limit]

    def all_nodes(self) -> dict:
        """Same shape as knowledge_graph_service.get_all_nodes (no per-learner mastery: the local graph has none)."""
        self.seed()
        return {
            "nodes": [{"id": n.name, "label": n.name, "mastery": 0.0, "domain": n.domain, "difficulty": n.difficulty} for n in self.nodes.values()],
            "edges": [{"from": self.nodes[a].name, "to": self.nodes[b].name, "strength": 1.0} for (a, b, r) in self.edges if r == PREREQ],
        }

    def disciplines(self) -> dict:
        """Same shape as knowledge_graph_service.get_disciplines."""
        self.seed()
        by: Dict[str, List[Node]] = {}
        for n in self.nodes.values():
            if n.domain:
                by.setdefault(n.domain, []).append(n)
        internal: Dict[str, int] = {}
        cross: Dict[str, int] = {}
        bridges: Dict[Tuple[str, str], int] = {}
        for (a, b, _r) in self.edges:
            da, db = self.nodes[a].domain, self.nodes[b].domain
            if not da or not db:
                continue
            if da == db:
                internal[da] = internal.get(da, 0) + 1
            else:
                for d in (da, db):
                    cross[d] = cross.get(d, 0) + 1
                bridges[(da, db)] = bridges.get((da, db), 0) + 1
        rows = [
            {
                "name": d, "concepts": len(ns),
                "avg_difficulty": round(sum(n.difficulty or 0 for n in ns) / len(ns), 1),
                "max_difficulty": max(n.difficulty or 0 for n in ns),
                "internal_links": internal.get(d, 0), "cross_links": cross.get(d, 0),
                "learner": {"studied": 0, "mastered": 0, "avg_mastery": 0.0},
            }
            for d, ns in by.items()
        ]
        rows.sort(key=lambda r: (-r["concepts"], r["name"]))
        return {
            "disciplines": rows,
            "bridges": [{"from": a, "to": b, "links": n} for (a, b), n in sorted(bridges.items(), key=lambda kv: -kv[1])[:40]],
            "totals": {"concepts": sum(r["concepts"] for r in rows), "disciplines": len(rows), "relationships": len(self.edges)},
        }

    def stats(self) -> Dict[str, int]:
        self.seed()
        return {"concepts": len(self.nodes), "edges": len(self.edges)}


_graph = LocalGraph()


def get_local_graph() -> LocalGraph:
    return _graph
