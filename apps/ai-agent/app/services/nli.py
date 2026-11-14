"""
Natural Language Inference validation for tutor answers.

For each factual claim in the answer, a judge model reads ONLY the retrieved evidence and labels the claim:
    ENTAILMENT     the evidence supports it
    CONTRADICTION  the evidence says otherwise
    NEUTRAL        the evidence says nothing either way
The model also scores how relevant the whole answer is to the student's question.

The decision (`decide`) is plain, deterministic Python over those labels, with thresholds from settings, so it can
be tested without a model and tuned without a prompt change. The important rules:

  * NEUTRAL IS NOT PROOF. A claim only counts as supported when it is ENTAILED with confidence >= NLI_ENTAIL_THRESHOLD.
    Neutral and low-confidence claims lower the supported ratio and may trigger a qualification note.
  * NO EVIDENCE MEANS UNGROUNDED, never PASS. With no sources, nothing can be entailed, so the verdict is UNGROUNDED:
    the answer is shown with a note that it comes from general knowledge and was not checked against material.
  * A CONTRADICTION at/above NLI_CONTRADICT_THRESHOLD makes the verdict CONTRADICTED regardless of the rest.
  * Off-topic answers (relevance < 0.4) are surfaced as an issue.

Honest limits: the judge is an LLM, not a trained NLI classifier, so labels are probabilistic; it sees at most
MAX_CLAIMS claims and MAX_EVIDENCE_CHARS of evidence; and general-knowledge claims cannot be verified by it.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

ENTAILMENT, CONTRADICTION, NEUTRAL = "ENTAILMENT", "CONTRADICTION", "NEUTRAL"
MAX_CLAIMS = 8
MAX_EVIDENCE_CHARS = 3500

JUDGE_SYSTEM = """You are a strict natural-language-inference judge for a tutoring system.
You get EVIDENCE passages (numbered), an ANSWER's claims (numbered), and the student's QUESTION.
For each claim decide using ONLY the evidence:
  ENTAILMENT = the evidence supports the claim; CONTRADICTION = the evidence conflicts with it; NEUTRAL = the evidence neither supports nor conflicts.
If the evidence does not mention the claim, it is NEUTRAL, even if the claim sounds true. Never use outside knowledge to upgrade NEUTRAL.
Return ONE JSON object:
{"claims": [{"id": 1, "label": "ENTAILMENT|CONTRADICTION|NEUTRAL", "confidence": 0.0-1.0, "evidence": [source numbers]}],
 "relevance": 0.0-1.0 (does the ANSWER address the QUESTION?)}"""


@dataclass
class ClaimResult:
    text: str
    label: str = NEUTRAL
    confidence: float = 0.0
    evidence: List[int] = field(default_factory=list)


@dataclass
class NLIResult:
    verdict: str                       # SUPPORTED | PARTIAL | CONTRADICTED | UNGROUNDED | UNVERIFIED
    supported_ratio: Optional[float]
    relevance: Optional[float]
    claims: List[ClaimResult]
    issues: List[str]
    qualification: str = ""            # shown beside the answer when the reader should be careful

    def public(self) -> Dict[str, Any]:
        return {
            "verdict": self.verdict, "supported_ratio": self.supported_ratio, "relevance": self.relevance,
            "issues": self.issues, "qualification": self.qualification,
            "claims": [{"text": c.text[:200], "label": c.label, "confidence": round(c.confidence, 2), "evidence": c.evidence} for c in self.claims],
        }


_SENT = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\[`*])")


def extract_claims(answer: str) -> List[str]:
    """Heuristic claim extraction (no model call): declarative sentences from prose, skipping code, headings,
    questions and fragments. Strips markdown and citation markers so the judge sees plain statements."""
    text = re.sub(r"```.*?```", " ", answer, flags=re.S)
    claims: List[str] = []
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith(("#", "---", "|", ">")):
            continue
        line = re.sub(r"^[-*\d.)\s]+", "", line)
        line = re.sub(r"\[\d+\]|\*\*|__|`", "", line).strip()
        for sent in _SENT.split(line):
            sent = sent.strip()
            words = sent.split()
            if len(words) < 6 or sent.endswith("?"):
                continue
            if re.match(r"(?i)^(let'?s|here'?s|note that|remember|try|consider|for example|e\.g\.|in summary|to summari[sz]e)\b", sent):
                continue
            claims.append(sent[:300])
    seen, out = set(), []
    for c in claims:
        k = c.lower()
        if k not in seen:
            seen.add(k)
            out.append(c)
    return out[:MAX_CLAIMS]


def decide(claims: List[ClaimResult], relevance: Optional[float], has_evidence: bool,
           entail_min: float, contradict_min: float, min_supported_ratio: float) -> NLIResult:
    issues: List[str] = []
    if relevance is not None and relevance < 0.4:
        issues.append("The answer may not address your question directly.")

    if not has_evidence:
        return NLIResult("UNGROUNDED", None, relevance, claims, issues,
                         "This answer comes from general knowledge and was not checked against your documents or the web.")
    if not claims:
        return NLIResult("UNVERIFIED", None, relevance, claims, issues, "")

    contradicted = [c for c in claims if c.label == CONTRADICTION and c.confidence >= contradict_min]
    supported = [c for c in claims if c.label == ENTAILMENT and c.confidence >= entail_min]
    unsupported = [c for c in claims if c not in supported and c not in contradicted]
    ratio = round(len(supported) / len(claims), 2)

    for c in contradicted[:3]:
        issues.append(f"Conflicts with the sources: {c.text[:140]}")
    if contradicted:
        return NLIResult("CONTRADICTED", ratio, relevance, claims, issues,
                         "Part of this answer conflicts with your sources. Check the sources before relying on it.")
    if ratio >= min_supported_ratio:
        note = "Some details go beyond your sources, so treat those with care." if unsupported else ""
        return NLIResult("SUPPORTED", ratio, relevance, claims, issues, note)
    for c in unsupported[:2]:
        issues.append(f"Not confirmed by the sources: {c.text[:140]}")
    return NLIResult("PARTIAL", ratio, relevance, claims, issues,
                     "Only part of this answer is backed by your sources. The rest comes from general knowledge.")


async def validate(ai: Any, question: str, answer: str, evidence: List[str], settings: Any) -> NLIResult:
    """Run the judge and apply `decide`. Any failure yields UNVERIFIED, never a false PASS."""
    claims_text = extract_claims(answer)
    ev = "\n".join(evidence)[:MAX_EVIDENCE_CHARS]
    has_evidence = bool(ev.strip())
    if not has_evidence or not claims_text:
        return decide([], None, has_evidence, settings.NLI_ENTAIL_THRESHOLD, settings.NLI_CONTRADICT_THRESHOLD, settings.NLI_MIN_SUPPORTED_RATIO)
    prompt = (
        f"QUESTION: {question[:500]}\n\nEVIDENCE:\n{ev}\n\nCLAIMS:\n" + "\n".join(f"{i + 1}. {c}" for i, c in enumerate(claims_text))
    )
    try:
        out = await ai.agenerate_json(prompt, JUDGE_SYSTEM, fast=True, max_tokens=900, temperature=0.0)
    except Exception:
        out = {}
    by_id = {}
    for row in out.get("claims", []) if isinstance(out.get("claims"), list) else []:
        if isinstance(row, dict) and isinstance(row.get("id"), int):
            by_id[row["id"]] = row
    results: List[ClaimResult] = []
    for i, text in enumerate(claims_text, 1):
        row = by_id.get(i, {})
        label = str(row.get("label", NEUTRAL)).upper()
        label = label if label in (ENTAILMENT, CONTRADICTION, NEUTRAL) else NEUTRAL
        try:
            conf = max(0.0, min(1.0, float(row.get("confidence", 0.0))))
        except (TypeError, ValueError):
            conf = 0.0
        ev_ids = [e for e in (row.get("evidence") or []) if isinstance(e, int)][:3]
        results.append(ClaimResult(text, label, conf, ev_ids))
    if not by_id:  # the judge returned nothing usable: say "unverified", not "fine"
        return NLIResult("UNVERIFIED", None, None, results, [], "")
    try:
        relevance = max(0.0, min(1.0, float(out.get("relevance"))))
    except (TypeError, ValueError):
        relevance = None
    return decide(results, relevance, True, settings.NLI_ENTAIL_THRESHOLD, settings.NLI_CONTRADICT_THRESHOLD, settings.NLI_MIN_SUPPORTED_RATIO)
