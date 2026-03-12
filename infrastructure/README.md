# NOVYRA Infrastructure — AWS-Native

## Stack Overview

```
Frontend   → Next.js on Amplify / CloudFront
Backend    → FastAPI on Lambda (via Mangum)
AI         → Amazon Bedrock (Claude 3 Sonnet + Titan Embeddings V2)
Database   → RDS PostgreSQL (Prisma schema unchanged)
Storage    → S3 (documents + processed text)
API Layer  → API Gateway HTTP API
IaC        → AWS CDK v2 (TypeScript)
```

## Repository Structure

```
infrastructure/
  cdk/
    bin/app.ts              ← CDK entrypoint
    lib/novyra-stack.ts     ← Full stack definition
    cdk.json
    package.json
    tsconfig.json
  iam/
    novyra-lambda-policy.json   ← IAM policy for Lambda role
  lambda/
    build.ps1               ← Package AI agent for Lambda
apps/ai-agent/
  lambda_handler.py         ← Mangum Lambda entry point
  serverless.yml            ← Serverless Framework alternative
  .env.aws.example          ← AWS env var template
  app/services/
    bedrock_service.py      ← Claude 3 Sonnet + Titan Embeddings
    s3_service.py           ← Document upload + presigned URLs
```

---

## Quick Deploy (CDK)

```powershell
# 1. Bootstrap (once per account/region)
cd infrastructure/cdk
npm install
cdk bootstrap aws://<ACCOUNT>/<REGION>

# 2. Set required env vars
$env:AI_BACKEND_TOKEN = "your-shared-secret"
$env:NEO4J_URI        = "bolt://your-neo4j:7687"

# 3. Deploy
$env:STAGE = "dev"
npm run deploy:dev
```

The output prints:
- `ApiEndpoint` → set as `NEXT_PUBLIC_BACKEND_URL` in Amplify
- `DocumentsBucketName` → set as `S3_BUCKET_NAME` in Lambda env

---

## Quick Deploy (Serverless Framework)

```powershell
npm install -g serverless
cd apps/ai-agent
# Set SSM params first (see .env.aws.example)
serverless deploy --stage dev --region ap-northeast-1
```

---

## Bedrock Service Usage

```python
from app.services.bedrock_service import (
    generate_text,
    generate_structured,
    embed_text,
    embed_batch,
)

# LLM
answer = generate_text("Explain entropy in 3 levels of complexity")

# Structured JSON
result = generate_structured(
    prompt="Analyze knowledge gaps in: ...",
    output_schema='{"gaps": [...], "mastery_score": 0-100}'
)

# Embeddings (1536-dim, Titan V2)
vector = embed_text("What is information entropy?")
```

## S3 Service Usage

```python
from app.services.s3_service import get_s3_service

s3 = get_s3_service()

# Upload from FastAPI UploadFile
result = s3.upload_fileobj(
    file_obj=upload.file,
    filename=upload.filename,
    user_id=current_user.id,
    content_type=upload.content_type,
)
# result = { s3_key, doc_id, bucket, url }

# Presigned GET for frontend
url = s3.get_presigned_url(result["s3_key"])

# Store extracted text for RAG
s3.store_processed_text(user_id, doc_id, extracted_text)
```

---

## 24-Hour Sprint Checklist

### Phase 1 — Lambda + Bedrock (Hours 1–8)
- [ ] `pip install boto3 mangum` in ai-agent venv
- [ ] Set `AI_PROVIDER=bedrock` in Lambda env
- [ ] Test `bedrock_service.py` locally with `aws configure`
- [ ] Replace `EmbeddingService` imports with `bedrock_service.embed_text`
- [ ] Replace Gemini LLM calls in `langchain_service.py` with `bedrock_service.generate_text`
- [ ] Test RAG flow end-to-end

### Phase 2 — S3 + Lambda Deploy (Hours 8–16)
- [ ] Create S3 bucket: `aws s3 mb s3://novyra-documents-dev-<ACCOUNT>`
- [ ] Add `s3_service.upload_fileobj` to documents upload route
- [ ] Store processed text via `s3_service.store_processed_text`
- [ ] Run `infrastructure/lambda/build.ps1`
- [ ] Deploy: `serverless deploy --stage dev`
- [ ] Update `NEXT_PUBLIC_BACKEND_URL` in apps/app with Lambda URL
- [ ] Test proxy pattern: Next.js → API Gateway → Lambda → Bedrock

### Phase 3 — CDK + Docs (Hours 16–24)
- [ ] `cd infrastructure/cdk && npm install && cdk synth`
- [ ] Deploy RDS: `cdk deploy --stage dev`
- [ ] Point `DATABASE_URL` to RDS, re-run `prisma db push`
- [ ] Generate Kiro system spec for PPT
- [ ] Record demo video

---

## Critical Rules

1. **Never rewrite Prisma schema** — it works with RDS as-is
2. **Never remove the proxy pattern** — Next.js always goes through `/api/ai-agent`
3. **Bedrock is the only AI provider** — set `AI_PROVIDER=bedrock`
4. **Keep gamification logic** — mastery + XP event bus untouched
5. **boto3/botocore** — exclude from Lambda zip (provided by runtime)
