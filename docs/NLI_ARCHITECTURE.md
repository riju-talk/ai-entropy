# NLI Fact-Check Architecture - NOVYRA Validation Layer

## Overview

The NLI (Natural Language Inference) Fact-Check System is a **lightweight, CPU-optimized validation layer** that verifies AI-generated claims against retrieved context to prevent misinformation. It operates in real-time (<150ms per claim) using quantized ONNX models.

---

## Design Requirements

### Performance Constraints
- ✅ **Model size**: ≤ 200MB (deploy with Python backend)
- ✅ **Inference time**: ≤ 150ms per claim on CPU
- ✅ **Throughput**: ≥ 100 claims/second
- ✅ **Memory**: ≤ 512MB RAM during inference

### Accuracy Targets
- ✅ **Precision**: ≥ 80% (few false positives)
- ✅ **Recall**: ≥ 75% (catch most contradictions)
- ✅ **F1 Score**: ≥ 0.77 on academic content

---

## Architecture

### Model Selection

**Chosen Model:** DistilRoBERTa Base fine-tuned on MNLI (Multi-Genre NLI)

**Rationale:**
- **Distilled**: 40% smaller than RoBERTa, 2× faster
- **Strong baseline**: 91% accuracy on MNLI validation set
- **Open source**: MIT license, no API costs
- **Quantizable**: Works well with INT8 quantization

**Alternatives Considered:**
- ❌ **BERT Base**: 110M params, too slow on CPU
- ❌ **MiniLM-L6**: Fast but lower accuracy (87% MNLI)
- ❌ **API-based (OpenAI/Anthropic)**: Cost + latency concerns

---

## NLI Task Definition

### Input Format

**Premise:** The retrieved context (ground truth)  
**Hypothesis:** The AI-generated claim to verify

**Example:**
```
Premise: "Binary search requires a sorted array and has O(log n) time complexity."

Hypothesis: "Binary search works on unsorted arrays."
```

### Output Labels

```python
class NLILabel(Enum):
    ENTAILMENT = "entailment"        # Hypothesis follows from premise
    CONTRADICTION = "contradiction"  # Hypothesis conflicts with premise
    NEUTRAL = "neutral"              # Cannot determine from premise
```

**Label Semantics:**
- **ENTAILMENT**: Claim is supported by context → ✅ Display
- **CONTRADICTION**: Claim conflicts with context → ❌ Block or flag
- **NEUTRAL**: Claim is not addressed in context → ⚠️ Display with caveat

---

## Model Pipeline

### 1. Model Export (ONNX)

```python
from transformers import AutoModelForSequenceClassification, AutoTokenizer
import torch
import onnx
from onnxruntime.quantization import quantize_dynamic, QuantType

# Load pretrained model
model_name = "cross-encoder/nli-distilroberta-base"
model = AutoModelForSequenceClassification.from_pretrained(model_name)
tokenizer = AutoTokenizer.from_pretrained(model_name)

# Export to ONNX
dummy_input = tokenizer(
    "Premise text", "Hypothesis text",
    return_tensors="pt",
    padding=True,
    truncation=True
)

torch.onnx.export(
    model,
    (dummy_input["input_ids"], dummy_input["attention_mask"]),
    "nli_model.onnx",
    input_names=["input_ids", "attention_mask"],
    output_names=["logits"],
    dynamic_axes={
        "input_ids": {0: "batch", 1: "sequence"},
        "attention_mask": {0: "batch", 1: "sequence"}
    },
    opset_version=14
)

# Quantize to INT8
quantize_dynamic(
    model_input="nli_model.onnx",
    model_output="nli_model_quantized.onnx",
    weight_type=QuantType.QInt8
)

# Result: ~50MB model (original: 135MB base model)
```

### 2. Inference Runtime

```python
import onnxruntime as ort
import numpy as np
from transformers import AutoTokenizer

class NLIInferenceEngine:
    def __init__(self, model_path: str, tokenizer_name: str):
        # Load ONNX model
        self.session = ort.InferenceSession(
            model_path,
            providers=['CPUExecutionProvider']  # CPU-only
        )
        
        # Load tokenizer
        self.tokenizer = AutoTokenizer.from_pretrained(tokenizer_name)
        
        # Label mapping
        self.labels = ["contradiction", "neutral", "entailment"]
    
    def predict(self, premise: str, hypothesis: str) -> NLIResult:
        """
        Run inference on a single premise-hypothesis pair.
        """
        # Tokenize
        inputs = self.tokenizer(
            premise, hypothesis,
            return_tensors="np",
            padding=True,
            truncation=True,
            max_length=256  # Truncate long texts
        )
        
        # Run inference
        outputs = self.session.run(
            None,
            {
                "input_ids": inputs["input_ids"].astype(np.int64),
                "attention_mask": inputs["attention_mask"].astype(np.int64)
            }
        )
        
        # Get logits and apply softmax
        logits = outputs[0][0]
        probs = self.softmax(logits)
        
        # Get prediction
        label_idx = np.argmax(probs)
        label = self.labels[label_idx]
        confidence = float(probs[label_idx])
        
        return NLIResult(
            label=NLILabel(label),
            confidence=confidence,
            probabilities={
                "contradiction": float(probs[0]),
                "neutral": float(probs[1]),
                "entailment": float(probs[2])
            }
        )
    
    def predict_batch(
        self,
        premises: List[str],
        hypotheses: List[str]
    ) -> List[NLIResult]:
        """
        Batch inference for multiple pairs (more efficient).
        """
        # Tokenize batch
        inputs = self.tokenizer(
            premises, hypotheses,
            return_tensors="np",
            padding=True,
            truncation=True,
            max_length=256
        )
        
        # Run inference
        outputs = self.session.run(
            None,
            {
                "input_ids": inputs["input_ids"].astype(np.int64),
                "attention_mask": inputs["attention_mask"].astype(np.int64)
            }
        )
        
        # Process results
        logits = outputs[0]
        results = []
        
        for i in range(len(premises)):
            probs = self.softmax(logits[i])
            label_idx = np.argmax(probs)
            label = self.labels[label_idx]
            confidence = float(probs[label_idx])
            
            results.append(NLIResult(
                label=NLILabel(label),
                confidence=confidence,
                probabilities={
                    "contradiction": float(probs[0]),
                    "neutral": float(probs[1]),
                    "entailment": float(probs[2])
                }
            ))
        
        return results
    
    @staticmethod
    def softmax(x: np.ndarray) -> np.ndarray:
        exp_x = np.exp(x - np.max(x))
        return exp_x / exp_x.sum()


# Global singleton instance
nli_engine = None

def get_nli_engine() -> NLIInferenceEngine:
    global nli_engine
    if nli_engine is None:
        nli_engine = NLIInferenceEngine(
            model_path="models/nli_model_quantized.onnx",
            tokenizer_name="cross-encoder/nli-distilroberta-base"
        )
    return nli_engine
```

---

## Claim Extraction

### Sentence Segmentation

```python
import spacy

# Load SpaCy for sentence segmentation
nlp = spacy.load("en_core_web_sm")

def extract_claims(text: str) -> List[Claim]:
    """
    Extract factual claims from generated text.
    """
    doc = nlp(text)
    claims = []
    
    for i, sent in enumerate(doc.sents):
        sent_text = sent.text.strip()
        
        # Filter out non-factual sentences
        if is_factual_claim(sent):
            claims.append(Claim(
                text=sent_text,
                index=i,
                source="generated"
            ))
    
    return claims

def is_factual_claim(sent: spacy.tokens.Span) -> bool:
    """
    Heuristic to identify factual statements.
    """
    # Skip questions
    if sent.text.endswith("?"):
        return False
    
    # Skip imperatives (commands)
    if sent[0].pos_ == "VERB" and sent[0].tag_ == "VB":
        return False
    
    # Require a verb (factual statements have predicates)
    has_verb = any(token.pos_ == "VERB" for token in sent)
    if not has_verb:
        return False
    
    # Skip very short sentences (likely fragments)
    if len(sent) < 4:
        return False
    
    return True
```

---

## Fact-Check Pipeline

### Full Validation Flow

```python
@dataclass
class FactCheckResult:
    claims_checked: int
    entailment_count: int
    contradiction_count: int
    neutral_count: int
    overall_confidence: float
    safe_to_display: bool
    checks: List[ClaimCheck]

@dataclass
class ClaimCheck:
    claim: str
    label: NLILabel
    confidence: float
    premise_used: str

async def fact_check_response(
    generated_text: str,
    context: str,
    confidence_threshold: float = 0.7
) -> FactCheckResult:
    """
    Validate all claims in generated text against context.
    """
    # Extract claims
    claims = extract_claims(generated_text)
    
    if not claims:
        # No factual claims to check
        return FactCheckResult(
            claims_checked=0,
            entailment_count=0,
            contradiction_count=0,
            neutral_count=0,
            overall_confidence=1.0,
            safe_to_display=True,
            checks=[]
        )
    
    # Run NLI in batch
    nli = get_nli_engine()
    premises = [context] * len(claims)
    hypotheses = [c.text for c in claims]
    
    results = nli.predict_batch(premises, hypotheses)
    
    # Aggregate results
    checks = []
    entailment_count = 0
    contradiction_count = 0
    neutral_count = 0
    confidences = []
    
    for claim, nli_result in zip(claims, results):
        checks.append(ClaimCheck(
            claim=claim.text,
            label=nli_result.label,
            confidence=nli_result.confidence,
            premise_used=context[:200] + "..."  # Truncate for storage
        ))
        
        if nli_result.label == NLILabel.ENTAILMENT:
            entailment_count += 1
        elif nli_result.label == NLILabel.CONTRADICTION:
            contradiction_count += 1
        else:
            neutral_count += 1
        
        confidences.append(nli_result.confidence)
    
    # Calculate overall confidence
    overall_confidence = sum(confidences) / len(confidences)
    
    # Determine if safe to display
    has_contradiction = contradiction_count > 0
    low_confidence = overall_confidence < confidence_threshold
    
    safe_to_display = not has_contradiction and not low_confidence
    
    return FactCheckResult(
        claims_checked=len(claims),
        entailment_count=entailment_count,
        contradiction_count=contradiction_count,
        neutral_count=neutral_count,
        overall_confidence=overall_confidence,
        safe_to_display=safe_to_display,
        checks=checks
    )
```

---

## Integration with AI Brain

### Validation Checkpoint

```python
async def generate_reasoning_with_validation(
    query: str,
    context: str,
    user_id: str
) -> ValidatedReasoning:
    """
    Generate reasoning and validate before returning to user.
    """
    # Generate reasoning (Layer 6)
    reasoning = await generate_reasoning(query, context)
    
    # Fact-check (Layer 7)
    fact_check = await fact_check_response(
        generated_text=reasoning.to_text(),
        context=context
    )
    
    if not fact_check.safe_to_display:
        # Log issue
        await log_validation_failure(user_id, query, fact_check)
        
        # Decide on fallback
        if fact_check.contradiction_count > 0:
            # Hard contradiction - regenerate with constraints
            reasoning = await regenerate_with_constraints(
                query=query,
                context=context,
                avoid_claims=[c.claim for c in fact_check.checks if c.label == NLILabel.CONTRADICTION]
            )
            
            # Re-validate
            fact_check = await fact_check_response(reasoning.to_text(), context)
        
        if not fact_check.safe_to_display:
            # Still failing - return error
            raise ValidationError("Unable to generate validated response")
    
    return ValidatedReasoning(
        reasoning=reasoning,
        fact_check=fact_check,
        validation_passed=True
    )
```

---

## Optimization Strategies

### 1. Caching

```python
from functools import lru_cache
import hashlib

def cache_key(premise: str, hypothesis: str) -> str:
    """Generate cache key from inputs."""
    combined = f"{premise}|||{hypothesis}"
    return hashlib.md5(combined.encode()).hexdigest()

# In-memory cache (LRU)
@lru_cache(maxsize=10000)
def predict_cached(premise: str, hypothesis: str) -> NLIResult:
    """Cached NLI prediction."""
    nli = get_nli_engine()
    return nli.predict(premise, hypothesis)
```

### 2. Batch Processing

```python
async def fact_check_multiple_responses(
    responses: List[str],
    contexts: List[str]
) -> List[FactCheckResult]:
    """
    Process multiple responses in parallel with batching.
    """
    # Extract claims from all responses
    all_claims = []
    claim_to_response = {}
    
    for i, response in enumerate(responses):
        claims = extract_claims(response)
        for claim in claims:
            all_claims.append((contexts[i], claim.text))
            claim_to_response[claim.text] = i
    
    # Batch NLI inference
    premises, hypotheses = zip(*all_claims)
    nli = get_nli_engine()
    results = nli.predict_batch(list(premises), list(hypotheses))
    
    # Group results by response
    response_checks = [[] for _ in responses]
    for (premise, hypothesis), result in zip(all_claims, results):
        response_idx = claim_to_response[hypothesis]
        response_checks[response_idx].append(ClaimCheck(
            claim=hypothesis,
            label=result.label,
            confidence=result.confidence,
            premise_used=premise[:200] + "..."
        ))
    
    # Build final results
    return [
        build_fact_check_result(checks)
        for checks in response_checks
    ]
```

### 3. Async Validation (Non-Blocking)

```python
async def generate_reasoning_async_validation(
    query: str,
    context: str,
    user_id: str
) -> ReasoningWithPendingValidation:
    """
    Return reasoning immediately, validate in background.
    """
    # Generate reasoning
    reasoning = await generate_reasoning(query, context)
    
    # Start validation in background
    validation_task = asyncio.create_task(
        fact_check_response(reasoning.to_text(), context)
    )
    
    # Return immediately with pending validation
    return ReasoningWithPendingValidation(
        reasoning=reasoning,
        validation_task=validation_task,
        validated=False
    )

# User sees response immediately
# If validation fails, show warning banner asynchronously
```

---

## Confidence Thresholding

### Threshold Tuning

```python
class ValidationThresholds:
    # Minimum confidence to display without warning
    SAFE_THRESHOLD = 0.75
    
    # Minimum confidence to display with warning
    WARNING_THRESHOLD = 0.60
    
    # Below this: block completely
    BLOCK_THRESHOLD = 0.60

def determine_action(fact_check: FactCheckResult) -> ValidationAction:
    """
    Decide what to do with fact-check results.
    """
    if fact_check.contradiction_count > 0:
        # Any contradiction is serious
        return ValidationAction.BLOCK
    
    if fact_check.overall_confidence >= ValidationThresholds.SAFE_THRESHOLD:
        return ValidationAction.DISPLAY
    
    elif fact_check.overall_confidence >= ValidationThresholds.WARNING_THRESHOLD:
        return ValidationAction.DISPLAY_WITH_WARNING
    
    else:
        return ValidationAction.BLOCK
```

---

## Storage Schema

### Fact-Check Log

```prisma
model FactCheckLog {
  id                String   @id @default(cuid())
  userId            String?
  generatedText     String   @db.Text
  contextUsed       String   @db.Text
  claimsChecked     Int
  entailmentCount   Int
  contradictionCount Int
  neutralCount      Int
  overallConfidence Float
  safeToDisplay     Boolean
  checks            Json     // Array of ClaimCheck
  createdAt         DateTime @default(now())
  
  @@index([userId, createdAt])
  @@index([safeToDisplay])
}
```

---

## API Endpoints

### POST /api/nli/validate
```python
Request:
{
  "text": str,           # Text to validate
  "context": str,        # Context to validate against
  "threshold": float     # Optional: custom confidence threshold
}

Response:
{
  "safe_to_display": bool,
  "overall_confidence": float,
  "claims_checked": int,
  "checks": [
    {
      "claim": str,
      "label": "entailment" | "contradiction" | "neutral",
      "confidence": float
    }
  ],
  "action": "DISPLAY" | "DISPLAY_WITH_WARNING" | "BLOCK"
}
```

---

## Performance Benchmarks

### Target Metrics (Single Claim)
- **Tokenization**: 5ms
- **ONNX Inference**: 120ms (CPU)
- **Post-processing**: 10ms
- **Total**: ~135ms ✅

### Batch Performance
- **10 claims**: 450ms (45ms/claim) ✅
- **50 claims**: 1.8s (36ms/claim) ✅

### Memory Usage
- **Model loaded**: 150MB RAM
- **Peak inference**: 400MB RAM ✅

---

## Testing & Validation

### Unit Tests

```python
def test_nli_entailment():
    nli = get_nli_engine()
    result = nli.predict(
        premise="The sky is blue.",
        hypothesis="The sky has a blue color."
    )
    assert result.label == NLILabel.ENTAILMENT
    assert result.confidence > 0.8

def test_nli_contradiction():
    nli = get_nli_engine()
    result = nli.predict(
        premise="Python is a programming language.",
        hypothesis="Python is a type of animal."
    )
    assert result.label == NLILabel.CONTRADICTION
    assert result.confidence > 0.7

def test_nli_neutral():
    nli = get_nli_engine()
    result = nli.predict(
        premise="Paris is the capital of France.",
        hypothesis="London has great museums."
    )
    assert result.label == NLILabel.NEUTRAL
```

### Integration Tests

```python
async def test_fact_check_pipeline():
    text = "Binary search has O(n) complexity and works on sorted arrays."
    context = "Binary search requires a sorted array and has O(log n) time complexity."
    
    result = await fact_check_response(text, context)
    
    assert result.claims_checked == 2
    assert result.contradiction_count == 1  # O(n) contradicts O(log n)
    assert not result.safe_to_display
```

### Performance Tests

```python
import time

def test_inference_latency():
    nli = get_nli_engine()
    
    start = time.time()
    for _ in range(100):
        nli.predict(
            "Test premise for performance.",
            "Test hypothesis for latency measurement."
        )
    end = time.time()
    
    avg_latency = (end - start) / 100 * 1000  # Convert to ms
    assert avg_latency < 150, f"Latency too high: {avg_latency}ms"
```

---

## Error Handling

### Fallback Strategy

```python
async def fact_check_with_fallback(text: str, context: str) -> FactCheckResult:
    """
    Attempt fact-check with graceful degradation.
    """
    try:
        return await fact_check_response(text, context, timeout=5.0)
    
    except TimeoutError:
        logger.warning("NLI timeout - allowing with warning")
        return FactCheckResult(
            claims_checked=0,
            safe_to_display=True,  # Allow but log
            overall_confidence=0.5,
            checks=[],
            fallback_used=True
        )
    
    except Exception as e:
        logger.error(f"NLI error: {e}")
        # Fail open (allow content but log)
        await emit_event("NLI_ERROR", {"error": str(e)})
        return FactCheckResult(
            claims_checked=0,
            safe_to_display=True,
            overall_confidence=0.0,
            checks=[],
            fallback_used=True
        )
```

---

## Deployment

### Model Files
```
models/
  nli_model_quantized.onnx      # ~50MB
  tokenizer_config.json
  vocab.txt
```

### Dependencies
```txt
onnxruntime==1.16.0
transformers==4.35.0  # For tokenizer only
numpy==1.24.0
spacy==3.7.0
```

### Docker Integration
```dockerfile
# Install ONNX Runtime (CPU)
RUN pip install onnxruntime==1.16.0

# Download SpaCy model
RUN python -m spacy download en_core_web_sm

# Copy NLI model files
COPY models/ /app/models/
```

---

**Document Version:** 1.0  
**Last Updated:** 2026-02-27  
**Status:** ✅ Ready for Implementation
