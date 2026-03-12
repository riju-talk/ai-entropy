# Entropy AI Engine — AWS Deployment Guide

---

## 1. System Overview (Full Architecture)

### What This Is

**Entropy** is an AI-powered academic learning platform. Users post doubts (questions), answer others' doubts, vote on content, and earn XP/achievements as they learn. An AI backend handles natural language reasoning, knowledge-graph traversal, mastery scoring, and fact-checking. Everything flows through an event-driven architecture with strict anti-gaming and trust-scoring built in.

---

### Monorepo Layout

```
ai-entropy/
├── apps/
│   ├── app/                  # Next.js 14 frontend (TypeScript)
│   └── ai-agent/             # FastAPI Python backend
├── infrastructure/
│   └── cdk/                  # AWS CDK (TypeScript) — all infra as code
├── packages/                 # Shared ESLint + TypeScript + UI configs
├── amplify.yml               # AWS Amplify CI/CD for the frontend
└── turbo.json                # Turborepo monorepo orchestration
```

---

### Service Map

```
┌──────────────────────────────────────────────────────────────┐
│              Browser / Mobile                                │
│  Next.js 14 App (TypeScript · Tailwind · shadcn/ui)          │
│  AWS Amplify — Git-triggered CI/CD, SSR, edge CDN            │
└────────────────────────┬─────────────────────────────────────┘
                         │ HTTPS (REST + Server Actions)
                         ▼
┌──────────────────────────────────────────────────────────────┐
│  Amazon API Gateway HTTP API                                 │
│  → routes ALL requests to Main API Lambda (proxy)           │
└────────────────────────┬─────────────────────────────────────┘
                         │ Lambda invocation
                         ▼
┌──────────────────────────────────────────────────────────────┐
│  Lambda: EntropyApiFunction  (Python 3.11 · FastAPI · Mangum)│
│  handler: lambda_handler.handler                             │
│  Memory: 1 024 MB · Timeout: 30 s · VPC: private subnet     │
│                                                              │
│  Invokes (async fan-out):                                    │
│  ├── Lambda: RagWorker     (Pinecone semantic search)        │
│  └── Lambda: TavilyWorker  (live web search)                 │
│                                                              │
│  Enqueues to SQS:                                            │
│  ├── mastery-queue    → Lambda: MasteryWorker               │
│  └── gamification-queue → Lambda: GamificationWorker        │
└──┬───────────────────────────────────────────────────────────┘
   │
   ├──► Amazon RDS PostgreSQL 15   (primary data store, VPC private)
   │     Prisma ORM from both Next.js and Python
   │
   ├──► Amazon ElastiCache Redis   (sessions, rate-limits, caches)
   │
   ├──► Neo4j AuraDB / EC2         (knowledge graph, concept graph)
   │     bolt:// connection from Lambda
   │
   ├──► Amazon Bedrock             (Claude 3 Sonnet — LLM reasoning)
   │     (amazon.titan-embed-text-v2 — embeddings)
   │
   ├──► Pinecone                   (vector store for RAG)
   │
   ├──► Tavily API                 (live web search augmentation)
   │
   └──► Amazon S3                  (PDFs and documents uploaded by users)
```

---

### Lambda Functions (all Python 3.11, same VPC)

| Name | Handler | Memory | Timeout | Trigger |
|------|---------|--------|---------|---------|
| `EntropyApiFunction` | `lambda_handler.handler` | 1 024 MB | 30 s | API Gateway (all routes) |
| `RagWorker` | `app.workers.rag_worker.handler` | 1 024 MB | 15 s | Sync invoke from API Lambda |
| `TavilyWorker` | `app.workers.tavily_worker.handler` | 512 MB | 10 s | Sync invoke from API Lambda |
| `MasteryWorker` | `app.workers.mastery_worker.handler` | 256 MB | 30 s | SQS `mastery-queue` |
| `GamificationWorker` | `app.workers.gamification_worker.handler` | 256 MB | 30 s | SQS `gamification-queue` |

---

### Auth

NextAuth.js (Next.js side) with two OAuth providers:
- **Google** — `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- **GitHub** — `GITHUB_ID` / `GITHUB_SECRET`

Prisma Adapter stores sessions in PostgreSQL.

---

### Infrastructure as Code

All AWS resources are defined in `infrastructure/cdk/lib/entropy-stack.ts` (AWS CDK TypeScript).  
Deploy with `cdk deploy --context stage=prod`.

---

## 2. Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| AWS CLI | v2 | deploy + SSM |
| AWS CDK | v2 | infrastructure |
| Node.js | 18+ | CDK + Amplify build |
| Python | 3.11 | Lambda packaging |
| pnpm | 8+ | frontend build |
| Docker | 24+ | local dev |

```bash
# Install CDK globally
npm install -g aws-cdk

# Verify AWS identity
aws sts get-caller-identity
```

---

## 3. Step-by-Step AWS Deployment

### Step 1 — Store Secrets in SSM Parameter Store

The CDK stack reads every secret from SSM at deploy time.  
Create **all** of these before running `cdk deploy`:

```bash
STAGE=prod   # or dev
REGION=ap-northeast-1   # match your AWS region

# PostgreSQL (RDS endpoint — available after Step 3, but create placeholder now)
aws ssm put-parameter --name "/entropy/$STAGE/DATABASE_URL" \
  --value "postgresql://entropy_admin:<PASSWORD>@<RDS_HOST>:5432/entropy" \
  --type SecureString --region $REGION

# Neo4j AuraDB (or EC2 bolt endpoint)
aws ssm put-parameter --name "/entropy/$STAGE/NEO4J_URI" \
  --value "bolt://<neo4j-host>:7687" --type String --region $REGION
aws ssm put-parameter --name "/entropy/$STAGE/NEO4J_USER" \
  --value "neo4j" --type String --region $REGION
aws ssm put-parameter --name "/entropy/$STAGE/NEO4J_PASSWORD" \
  --value "<NEO4J_PASSWORD>" --type SecureString --region $REGION

# Redis (ElastiCache endpoint — available after Step 3)
aws ssm put-parameter --name "/entropy/$STAGE/REDIS_HOST" \
  --value "<ELASTICACHE_HOST>" --type String --region $REGION
aws ssm put-parameter --name "/entropy/$STAGE/REDIS_PORT" \
  --value "6379" --type String --region $REGION

# App secrets
aws ssm put-parameter --name "/entropy/$STAGE/JWT_SECRET_KEY" \
  --value "<32-char-random-secret>" --type SecureString --region $REGION
aws ssm put-parameter --name "/entropy/$STAGE/TAVILY_API_KEY" \
  --value "<TAVILY_API_KEY>" --type SecureString --region $REGION
```

---

### Step 2 — Bootstrap CDK (first time only)

```bash
cd infrastructure/cdk
npm install
cdk bootstrap aws://<ACCOUNT_ID>/<REGION>
```

---

### Step 3 — Deploy the CDK Stack

This creates: VPC, RDS PostgreSQL, ElastiCache Redis, S3 bucket, SQS queues, all Lambda functions, API Gateway, CloudWatch alarms, IAM roles.

```bash
cd infrastructure/cdk
cdk deploy --context stage=prod --require-approval never
```

**After deploy**, CDK outputs:

```
EntropyStack.ApiUrl          = https://xxxxxxxxxx.execute-api.<region>.amazonaws.com/prod/
EntropyStack.DatabaseEndpoint = entropy-db-prod.<xxxxx>.rds.amazonaws.com
EntropyStack.DocumentsBucketName = entropy-documents-prod
EntropyStack.MasteryQueueUrl = https://sqs.<region>.amazonaws.com/<account>/entropy-mastery-queue-prod
EntropyStack.GamificationQueueUrl = ...
```

Save these — you will need `ApiUrl` for Amplify env vars.

---

### Step 4 — Update SSM with Real Endpoints

Once CDK outputs the RDS hostname and ElastiCache endpoint, update their SSM parameters:

```bash
# Update DATABASE_URL with real RDS endpoint + generated password
DB_HOST=$(aws cloudformation describe-stacks --stack-name EntropyStack \
  --query "Stacks[0].Outputs[?OutputKey=='DatabaseEndpoint'].OutputValue" \
  --output text)

# Retrieve the auto-generated DB password from Secrets Manager
DB_PASS=$(aws secretsmanager get-secret-value \
  --secret-id "entropy/prod/db-credentials" \
  --query SecretString --output text | python3 -c "import sys,json; print(json.load(sys.stdin)['password'])")

aws ssm put-parameter --name "/entropy/prod/DATABASE_URL" \
  --value "postgresql://entropy_admin:${DB_PASS}@${DB_HOST}:5432/entropy" \
  --type SecureString --overwrite
```

---

### Step 5 — Build and Deploy Lambda Package

The CDK stack uses `lambda.Code.fromAsset(appRoot)` — it packages `apps/ai-agent/` directly.  
If you are deploying code changes manually (outside CDK), build the zip:

```bash
cd apps/ai-agent
pip install -r requirements.txt -t package/
cp -r app lambda_handler.py package/
cd package && zip -r9 ../function.zip . && cd ..

aws lambda update-function-code \
  --function-name entropy-api-prod \
  --zip-file fileb://function.zip \
  --region $REGION
```

---

### Step 6 — Run Prisma Migrations

Prisma migrations must run against the RDS instance. Do this from a machine (or EC2 bastion) inside the VPC, or via an RDS proxy with VPC tunnel:

```bash
cd apps/ai-agent
# Ensure DATABASE_URL points to prod RDS
DATABASE_URL="postgresql://entropy_admin:<PASSWORD>@<RDS_HOST>:5432/entropy"

prisma migrate deploy
# or if using the Node.js side schema:
cd ../../apps/app
npx prisma migrate deploy --schema=./prisma/schema.prisma
```

---

### Step 7 — Request Bedrock Model Access

In the AWS Console:
1. Go to **Amazon Bedrock → Model access** in region `ap-northeast-1`
2. Request access for:
   - `anthropic.claude-3-sonnet-20240229-v1:0`
   - `amazon.titan-embed-text-v2:0`
3. Wait for approval (usually instant for Titan, minutes for Claude)

---

### Step 8 — Deploy Frontend via AWS Amplify

#### 8a. Connect GitHub repo

1. AWS Console → **AWS Amplify → New app → Host web app**
2. Connect GitHub → select the `ai-entropy` repo → branch `main`
3. Amplify detects `amplify.yml` automatically

#### 8b. Set environment variables in Amplify Console

Go to **App settings → Environment variables** and add:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `postgresql://entropy_admin:<pass>@<rds-host>:5432/entropy` |
| `DIRECT_URL` | same as `DATABASE_URL` |
| `NEXTAUTH_URL` | `https://<your-amplify-domain>` |
| `NEXTAUTH_SECRET` | 32-char random secret |
| `JWT_SECRET_KEY` | same as `NEXTAUTH_SECRET` |
| `GITHUB_ID` | GitHub OAuth App client ID |
| `GITHUB_SECRET` | GitHub OAuth App client secret |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `BACKEND_URL` | API Gateway URL from Step 3 output |
| `BACKEND_URL` | same as `BACKEND_URL` |
| `AI_BACKEND_TOKEN` | 32-char random shared secret (must match Lambda `JWT_SECRET_KEY`) |

#### 8c. Trigger build

Push any commit or click **Redeploy** in the Amplify console.

The `amplify.yml` build runs:
```yaml
preBuild:  npm install --cache .npm --prefer-offline && npm run db:generate
build:     npm run build
output:    apps/app/.next
```

---

### Step 9 — Validate

```bash
# 1. Backend health
curl https://<api-gateway-url>/health
# Expected: {"status": "healthy", "version": "3.0.0"}

# 2. Ask the AI
curl -X POST https://<api-gateway-url>/api/reasoning/ask \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <AI_BACKEND_TOKEN>" \
  -d '{"question": "What is dynamic programming?"}'

# 3. Leaderboard (from Next.js API)
curl https://<amplify-domain>/api/leaderboard
```

---

## 4. Environment Variable Reference

### Lambda / Python Backend

| Variable | Required | Description |
|----------|----------|-------------|
| `AI_PROVIDER` | ✅ | `bedrock` in production |
| `BEDROCK_CLAUDE_MODEL` | ✅ | `anthropic.claude-3-sonnet-20240229-v1:0` |
| `BEDROCK_TITAN_EMBED` | ✅ | `amazon.titan-embed-text-v2:0` |
| `AWS_REGION` | ✅ | e.g. `ap-northeast-1` |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `NEO4J_URI` | ✅ | `bolt://<host>:7687` |
| `NEO4J_USER` | ✅ | Neo4j username |
| `NEO4J_PASSWORD` | ✅ | Neo4j password |
| `REDIS_HOST` | ✅ | ElastiCache endpoint |
| `REDIS_PORT` | ✅ | `6379` |
| `JWT_SECRET_KEY` | ✅ | Shared secret for auth tokens |
| `TAVILY_API_KEY` | ✅ | Tavily search API key |
| `S3_BUCKET_NAME` | ✅ | `entropy-documents-prod` |
| `MASTERY_QUEUE_URL` | ✅ | SQS queue URL (from CDK output) |
| `GAMIFICATION_QUEUE_URL` | ✅ | SQS queue URL (from CDK output) |
| `RAG_WORKER_FUNCTION` | ✅ | Lambda function name for RAG worker |
| `TAVILY_WORKER_FUNCTION` | ✅ | Lambda function name for Tavily worker |
| `PINECONE_API_KEY` | Optional | Pinecone vector store |
| `PINECONE_INDEX_NAME` | Optional | Pinecone index name |

### Next.js Frontend (Amplify)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `DIRECT_URL` | ✅ | Same as `DATABASE_URL` (Prisma direct) |
| `NEXTAUTH_URL` | ✅ | Full domain (e.g. `https://app.example.com`) |
| `NEXTAUTH_SECRET` | ✅ | Random 32+ char secret |
| `JWT_SECRET_KEY` | ✅ | Same as Lambda `JWT_SECRET_KEY` |
| `GITHUB_ID` | ✅ | GitHub OAuth App ID |
| `GITHUB_SECRET` | ✅ | GitHub OAuth App Secret |
| `GOOGLE_CLIENT_ID` | ✅ | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | ✅ | Google OAuth Client Secret |
| `BACKEND_URL` | ✅ | API Gateway URL |
| `BACKEND_URL` | ✅ | Same as `BACKEND_URL` |
| `AI_BACKEND_TOKEN` | ✅ | Shared secret (matches Lambda `JWT_SECRET_KEY`) |

---

## 5. IAM Permissions Summary

The Lambda execution role (`EntropyLambdaRole`) needs:

```json
{
  "bedrock:InvokeModel",
  "bedrock:InvokeModelWithResponseStream",
  "s3:GetObject", "s3:PutObject", "s3:DeleteObject",
  "sqs:SendMessage", "sqs:ReceiveMessage", "sqs:DeleteMessage",
  "ssm:GetParameter", "ssm:GetParameters",
  "secretsmanager:GetSecretValue",
  "ec2:CreateNetworkInterface",
  "ec2:DescribeNetworkInterfaces",
  "ec2:DeleteNetworkInterface",
  "logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents",
  "lambda:InvokeFunction"   // for RagWorker + TavilyWorker fan-out
}
```

Full policy: [`infrastructure/iam/entropy-lambda-policy.json`](infrastructure/iam/entropy-lambda-policy.json)

---

## 6. Estimated Monthly Cost (Production)

| Service | Config | Est. Cost |
|---------|--------|-----------|
| AWS Lambda (5 functions) | ~1M req, avg 1 GB·s | ~$20 |
| Amazon API Gateway | 1M requests | ~$1 |
| Amazon RDS PostgreSQL | `db.t3.small` Multi-AZ | ~$35 |
| Amazon ElastiCache Redis | `cache.t4g.micro` | ~$12 |
| Amazon Bedrock — Claude 3 Sonnet | ~5M tokens/month | ~$45 |
| Amazon Bedrock — Titan Embed | ~10M tokens/month | ~$1 |
| Neo4j AuraDB Free / EC2 t3.medium | self-hosted | ~$30 |
| Amazon S3 | 10 GB documents | ~$0.25 |
| Amazon SQS | 1M messages | ~$0.40 |
| Amazon CloudFront + Amplify | 10 GB transfer | ~$1 |
| CloudWatch Logs | 10 GB/month | ~$5 |
| **Total** | | **~$151/month** |

---

## 7. Local Development

```bash
# 1. Start all infrastructure (PostgreSQL, Neo4j, Redis) via Docker
docker-compose up -d

# 2. Install deps
pnpm install

# 3. Run Prisma migrations
cd apps/app && npx prisma migrate dev

# 4. Start Python backend
cd apps/ai-agent
python -m venv .venv && .venv\Scripts\activate   # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 5. Start Next.js frontend (separate terminal)
cd apps/app
npm run dev   # runs on port 5000
```

Access:
- Frontend: http://localhost:5000
- API: http://localhost:8000
- API Docs: http://localhost:8000/docs
- Prisma Studio: `cd apps/app && npx prisma studio`

```bash
cd apps/ai-agent
serverless deploy --stage prod --region ap-northeast-1
```

### Option 2: Using AWS CDK

#### 1. Install CDK

```bash
npm install -g aws-cdk
```

#### 2. Bootstrap CDK

```bash
cdk bootstrap aws://ACCOUNT_ID/ap-northeast-1
```

#### 3. Deploy

```bash
cd infrastructure/cdk
cdk deploy --stage prod
```

### Option 3: Manual Deployment

#### 1. Create S3 Bucket

```bash
aws s3 mb s3://entropy-documents-prod
```

#### 2. Create RDS PostgreSQL

```bash
aws rds create-db-instance \
  --db-instance-identifier entropy-db \
  --db-instance-class db.t4g.medium \
  --engine postgres \
  --allocated-storage 20 \
  --master-username entropy_admin \
  --master-user-password <password> \
  --multi-az \
  --vpc-security-group-ids <sg-id> \
  --db-subnet-group-name <subnet-group>
```

#### 3. Create Neo4j Instance

Use AWS Console or CLI to create Neo4j instance.

#### 4. Create Lambda Function

```bash
cd apps/ai-agent
pip install -r requirements.txt -t python/
zip -r function.zip python/ lambda_handler.py app/

aws lambda create-function \
  --function-name entropy-api \
  --runtime python3.11 \
  --handler lambda_handler.handler \
  --zip-file fileb://function.zip \
  --role arn:aws:iam::ACCOUNT_ID:role/entropy-lambda-role \
  --environment Variables="{APP_ENV=prod,AI_PROVIDER=bedrock}"
```

#### 5. Configure API Gateway

Create API Gateway with Lambda integration.

## Environment Variables

### Required Variables

```bash
# AWS
AWS_REGION=ap-northeast-1
AWS_ACCESS_KEY_ID=<your-key>
AWS_SECRET_ACCESS_KEY=<your-secret>

# AI Provider
AI_PROVIDER=bedrock
BEDROCK_CLAUDE_MODEL=anthropic.claude-3-sonnet-20240229-v1:0
BEDROCK_TITAN_EMBED=amazon.titan-embed-text-v2:0

# Database
DATABASE_URL=postgresql://user:pass@host:5432/entropy
NEO4J_URI=bolt://host:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=<password>

# Redis
REDIS_HOST=<redis-host>
REDIS_PORT=6379
REDIS_PASSWORD=<password>

# S3
S3_BUCKET_NAME=entropy-documents-prod

# Security
AI_BACKEND_TOKEN=<generate-random-token>
JWT_SECRET_KEY=<generate-secure-random-key>
```

## Monitoring

### CloudWatch Logs

```bash
aws logs tail /aws/lambda/entropy-api --follow
```

### Health Check

```bash
curl https://api.entropy.ai/health
```

### Metrics

- Lambda invocations
- API Gateway 4xx/5xx errors
- RDS CPU utilization
- Neo4j connection count
- Redis memory usage

## Troubleshooting

### Lambda Cold Start

- Increase provisioned concurrency
- Optimize deployment package size

### Database Connection Issues

- Verify security group rules
- Check VPC routing
- Ensure RDS is publicly accessible (if needed)

### Bedrock Access

- Verify IAM role has Bedrock permissions
- Check model access in Bedrock console
- Request quota increase if needed

## Cost Optimization

1. Use reserved capacity for Neo4j
2. Implement aggressive caching
3. Use spot instances for batch processing
4. Set up auto-scaling
5. Monitor and right-size resources

## Maintenance

### Daily
- Monitor CloudWatch alarms
- Review Lambda error logs
- Check database connection pool

### Weekly
- Review security logs
- Check backup status
- Monitor S3 storage usage

### Monthly
- Review and optimize costs
- Update dependencies
- Run disaster recovery drills

## Support

For issues, check:
- CloudWatch Logs
- Lambda execution logs
- RDS error logs
- Neo4j logs
