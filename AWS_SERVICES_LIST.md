# Entropy AI Engine — AWS Services for Deployment

> **Stack reality check**: The app uses FastAPI (Python) + Next.js frontend. Database layer is PostgreSQL via Prisma ORM, Neo4j for the knowledge graph, and Redis for caching. LLM calls route to Amazon Bedrock (Claude 3 Sonnet) in production or Google Gemini in local dev.

---

## Compute Services

### AWS Lambda
- **Purpose**: Serverless compute for the FastAPI AI backend
- **Adapter**: `mangum` wraps FastAPI for Lambda compatibility (already in `requirements.txt`)
- **Config**: 1024–3008 MB memory, 60s timeout, x86_64 or arm64
- **Entry point**: `lambda_handler.handler` (see `apps/ai-agent/lambda_handler.py`)

### AWS Amplify
- **Purpose**: Next.js frontend hosting + CI/CD
- **Framework**: Next.js (SSR mode via Amplify Hosting)
- **Features**: Auto-deploy from Git, custom domain, edge CDN, SSL

---

## API & Networking

### Amazon API Gateway HTTP API
- **Purpose**: Public HTTPS endpoint routing to Lambda
- **Config**: JWT authorizer for `/api/reasoning/*`, `/api/mastery/*`, `/api/evaluation/*`; open for `/api/graph` and `/health`
- **CORS**: Configured to allow `entropy-community.vercel.app` and localhost

### Amazon CloudFront
- **Purpose**: CDN for static assets (Next.js `_next/static`)
- **Origins**: S3 (assets) + API Gateway (dynamic)

### Amazon VPC
- **Purpose**: Private subnet for RDS and ElastiCache
- **Note**: Lambda must be placed in the **same VPC** to reach RDS and Redis

---

## AI / ML Services

### Amazon Bedrock
- **Purpose**: Primary LLM in production (`AI_PROVIDER=bedrock`)
- **Model**: `anthropic.claude-3-sonnet-20240229-v1:0`
- **Used by**: `apps/ai-agent/app/core/llm.py` → `_generate_bedrock()`
- **Required IAM**: `bedrock:InvokeModel` on the Claude model ARN
- **Cost**: ~$3/1M input tokens, ~$15/1M output tokens (Claude 3 Sonnet)

---

## Database Services

### Amazon RDS for PostgreSQL
- **Purpose**: Primary relational store — users, doubts, answers, communities, gamification
- **Prisma schema**: `apps/ai-agent/prisma/schema.prisma` and `apps/app/prisma/`
- **Config**: `db.t4g.micro` for dev, `db.t3.medium` for prod (Multi-AZ)
- **Connection**: `DATABASE_URL=postgresql://user:pass@host:5432/entropy`
- **Cost**: ~$17.50/month (t4g.micro)

### Neo4j AuraDB (or self-hosted on EC2)
- **Purpose**: Knowledge graph — concepts, prerequisites, learning paths
- **Used by**: `apps/ai-agent/app/services/knowledge_graph_service.py`
- **Connection**: `NEO4J_URI=bolt://<host>:7687`
- **Self-hosted option**: `neo4j:5.20-community` on `t3.medium` EC2 (~$30/month)
- **AuraDB Free tier**: 200k nodes (sufficient for dev/demo)
- **Note**: "Amazon Neo4j" does not exist — Neo4j is **not** an AWS managed service

### Amazon ElastiCache for Redis
- **Purpose**: Session cache, embedding cache, rate-limit counters
- **Used by**: `apps/ai-agent/app/core/cache.py`
- **Config**: `cache.t4g.micro`, single-node for dev
- **Connection**: `REDIS_URL=redis://<host>:6379`
- **Cost**: ~$12.40/month

---

## Storage

### Amazon S3
- **Purpose**: Uploaded documents (PDFs, DOCX) used by `s3_service.py`
- **Bucket**: `entropy-documents` (set via `S3_BUCKET_NAME` env var)
- **Features**: Server-side encryption (SSE-S3), lifecycle → Glacier after 90d
- **Cost**: ~$0.023/GB standard

---

## Queue & Messaging

### Amazon SQS
- **Purpose**: Async background jobs — document ingestion, graph updates, embedding generation
- **Queue type**: Standard queue with dead-letter queue
- **Cost**: ~$0.40/million requests

---

## Security

### AWS IAM
- **Lambda execution role needs**:
  - `bedrock:InvokeModel` (Claude)
  - `s3:GetObject`, `s3:PutObject` (`entropy-documents/*`)
  - `ssm:GetParameter` (secrets)
  - `ec2:CreateNetworkInterface`, `ec2:DescribeNetworkInterfaces`, `ec2:DeleteNetworkInterface` (VPC access for RDS/Redis)
- **Reference**: `infrastructure/iam/entropy-lambda-policy.json`

### AWS Systems Manager Parameter Store
- **Stores**: `GOOGLE_API_KEY`, `NEXTAUTH_SECRET`, `DATABASE_URL`, `NEO4J_PASSWORD`, `AI_BACKEND_TOKEN`
- **Cost**: Free (first 10,000 standard parameters)

### Amazon WAF
- **Purpose**: Protect API Gateway — SQL injection, XSS, rate limiting
- **Cost**: $5/month + $0.60/million requests

---

## Monitoring

### Amazon CloudWatch
- **Log groups**: `/aws/lambda/entropy-ai-agent`, `/aws/amplify/entropy-frontend`
- **Alarms**: Lambda error rate > 1%, P99 latency > 5s, Bedrock 429 rate
- **Cost**: $0.50/GB ingested

### AWS X-Ray
- **Purpose**: Trace requests through Lambda → RDS → Neo4j → Bedrock
- **Cost**: $5/million traces recorded

---

## Estimated Monthly Costs (Dev / Demo)

| Service | Config | Monthly |
|---------|--------|---------|
| Lambda | 1M req · 1GB mem · 3s avg | ~$20 |
| API Gateway | 1M req | ~$1 |
| CloudFront | 10GB transfer | ~$0.85 |
| RDS PostgreSQL | db.t4g.micro | ~$17.50 |
| Neo4j on EC2 | t3.medium (self-hosted) | ~$30 |
| ElastiCache Redis | cache.t4g.micro | ~$12.40 |
| S3 | 10GB | ~$0.25 |
| SQS | 1M req | ~$0.40 |
| Bedrock (Claude 3 Sonnet) | ~5M tokens | ~$45 |
| CloudWatch | 10GB logs | ~$5 |
| AWS Amplify | 1 app | ~$0 (free tier) |
| **Total** | | **~$132/month** |

---

## Deployment Checklist

### Infrastructure
- [ ] VPC with public + private subnets (2 AZs minimum)
- [ ] RDS PostgreSQL in private subnet
- [ ] ElastiCache Redis in private subnet
- [ ] Neo4j on EC2 (or AuraDB) — note security group: allow 7687 from Lambda SG only
- [ ] S3 bucket `entropy-documents` with SSE enabled
- [ ] SSM parameters for all secrets

### Backend (Lambda)
- [ ] Build Lambda package: `cd apps/ai-agent && pip install -r requirements.txt -t package/ && zip -r function.zip package/ app/ lambda_handler.py`
- [ ] Set handler to `lambda_handler.handler`
- [ ] Set env vars: `AI_PROVIDER=bedrock`, `DATABASE_URL`, `NEO4J_URI`, `REDIS_URL`
- [ ] Attach Lambda to VPC (private subnets), security group allows RDS + Redis ports
- [ ] Request Bedrock model access for `anthropic.claude-3-sonnet-20240229-v1:0` in AWS console
- [ ] Run Prisma migrations: `prisma migrate deploy`
- [ ] Seed knowledge graph: `POST /api/demo/seed-knowledge-graph`

### Frontend (Amplify)
- [ ] Connect GitHub repo to Amplify
- [ ] Set build command: `cd apps/app && npm run build`
- [ ] Set env vars: `DATABASE_URL`, `NEXTAUTH_SECRET`, `GITHUB_*`, `GOOGLE_*`, `AI_AGENT_BACKEND_URL`
- [ ] Configure custom domain

### Validation
- [ ] `GET /health` → `{"status": "healthy"}`
- [ ] `POST /api/reasoning/ask` with sample question → structured JSON response
- [ ] Frontend `/learn` page loads and connects to AI backend
- [ ] CloudWatch logs show no error spikes


## Compute Services

### AWS Lambda
- **Purpose**: Serverless compute for API endpoints
- **Function**: FastAPI backend via Mangum adapter
- **Configuration**: 1024MB memory, 30s timeout, x86_64 architecture
- **Cost**: Pay-per-use based on execution time and requests

### AWS Amplify
- **Purpose**: Frontend hosting and CI/CD
- **Function**: Next.js frontend deployment
- **Features**: Automatic deployments, custom domains, SSL

## API & Networking Services

### Amazon API Gateway HTTP API
- **Purpose**: Serverless API endpoint
- **Function**: Routes requests to Lambda functions
- **Features**: Custom JWT authorizers, CORS, rate limiting
- **Cost**: $1.00 per million requests + $0.09 per GB data transfer

### Amazon CloudFront
- **Purpose**: Content Delivery Network (CDN)
- **Function**: Cache static assets and API responses
- **Features**: Edge locations worldwide, SSL/TLS, WAF integration
- **Cost**: $0.085 per GB (US regions) + $0.00 per requests

### Amazon VPC
- **Purpose**: Private networking
- **Function**: Isolate databases and internal resources
- **Features**: Public/private subnets, NAT gateways, security groups
- **Cost**: Free (no additional charge)

## AI & ML Services

### Amazon Bedrock
- **Purpose**: LLM inference and embeddings
- **Models**:
  - Claude 3 Sonnet (reasoning)
  - Titan Embeddings V2 (vectors)
- **Features**: Managed LLMs, no code required
- **Cost**: Per token usage (Claude: $3.00/1M input, $15.00/1M output)

## Database Services

### Amazon RDS PostgreSQL
- **Purpose**: Primary relational database
- **Function**: Users, profiles, auth, gamification, community data
- **Configuration**: Multi-AZ, automated backups, 20GB storage
- **Cost**: ~$0.024/hour (db.t4g.micro) + storage costs

### Amazon DocumentDB
- **Purpose**: MongoDB-compatible document database
- **Function**: Document chunks, conversation transcripts, AI artifacts
- **Configuration**: Multi-AZ cluster, automated backups
- **Cost**: ~$0.15/hour (db.t4g.medium) + storage costs

### Amazon Neo4j
- **Purpose**: Managed graph database
- **Function**: Knowledge graph (concepts, relationships, learning paths)
- **Configuration**: High availability, automated backups
- **Cost**: ~$0.25/hour (small instance) + storage costs

## Storage Services

### Amazon S3
- **Purpose**: Object storage
- **Function**: Uploaded documents, processed text, static assets
- **Features**: Versioning, encryption, lifecycle policies
- **Cost**: $0.023/GB (standard) + $0.0004/1000 requests

### Amazon ElastiCache Redis
- **Purpose**: In-memory caching
- **Function**: Session cache, embedding cache, recommendation cache
- **Configuration**: Single node, 1GB memory
- **Cost**: ~$0.017/hour (cache.t4g.micro)

## Queue & Messaging Services

### Amazon SQS
- **Purpose**: Async message queue
- **Function**: Background job processing (ingestion, embeddings, graph updates)
- **Features**: Standard queues, message retention, dead-letter queues
- **Cost**: $0.00005 per 100,000 requests

## Security Services

### AWS IAM
- **Purpose**: Identity and access management
- **Function**: Lambda roles, S3 policies, database credentials
- **Features**: Least-privilege access, temporary credentials
- **Cost**: Free

### AWS KMS
- **Purpose**: Encryption at rest
- **Function**: Encrypt RDS, S3, DocumentDB, Neo4j data
- **Features**: Customer-managed keys, audit logging
- **Cost**: $1.00/month per key + $0.03 per 10,000 requests

### Amazon WAF
- **Purpose**: Web application firewall
- **Function**: Protect API Gateway from attacks
- **Features**: SQL injection, XSS protection, rate limiting
- **Cost**: $5.00/month + $0.60 per million requests

## Monitoring & Logging Services

### Amazon CloudWatch
- **Purpose**: Logs, metrics, and alarms
- **Function**: Application monitoring, error tracking, performance metrics
- **Features**: Log groups, metric alarms, dashboards
- **Cost**: $0.50/month per log group + $0.0005 per 100,000 log events

### AWS X-Ray
- **Purpose**: Distributed tracing
- **Function**: Trace requests across services
- **Features**: Request tracing, service map, performance analysis
- **Cost**: $1.00 per million traces

## Configuration Management

### AWS Systems Manager (SSM) Parameter Store
- **Purpose**: Secure configuration storage
- **Function**: Store API keys, database credentials, secrets
- **Features**: Encrypted values, versioning, access policies
- **Cost**: Free (first 10,000 parameters)

## DevOps Services

### AWS CodePipeline
- **Purpose**: CI/CD pipeline
- **Function**: Automated testing and deployment
- **Features**: Source, build, test, deploy stages
- **Cost**: Free (first pipeline)

### AWS CodeBuild
- **Purpose**: Build and test
- **Function**: Run tests, build Docker images
- **Features**: Docker support, caching, artifacts
- **Cost**: $0.005 per build minute

## Estimated Monthly Costs (Development Environment)

| Service | Quantity | Monthly Cost |
|---------|----------|--------------|
| Lambda | 1M requests | ~$20 |
| API Gateway | 1M requests | ~$1 |
| CloudFront | 10GB transfer | ~$0.85 |
| RDS PostgreSQL | db.t4g.micro | ~$17.50 |
| DocumentDB | db.t4g.medium | ~$109.50 |
| Neo4j | small instance | ~$187.50 |
| S3 | 10GB storage | ~$0.23 |
| ElastiCache Redis | cache.t4g.micro | ~$12.40 |
| SQS | 1M requests | ~$0.50 |
| Bedrock | 100M tokens | ~$180 |
| CloudWatch | 10GB logs | ~$3.50 |
| **Total** | | **~$532.53** |

## Production Cost Optimization Strategies

1. **Lambda Power Tuning**: Optimize memory/CPU for each function
2. **Caching**: Use Redis to reduce database and LLM calls
3. **Model Routing**: Route simple queries to cheaper models
4. **Reserved Capacity**: Consider reserved capacity for Neo4j
5. **S3 Lifecycle Policies**: Move old documents to Glacier
6. **Auto-scaling**: Scale down during off-peak hours

## Deployment Checklist

### Pre-Deployment
- [ ] Create AWS account and configure CLI credentials
- [ ] Set up VPC with public/private subnets
- [ ] Create RDS PostgreSQL instance (multi-AZ)
- [ ] Create DocumentDB cluster
- [ ] Create Neo4j instance (high availability)
- [ ] Create S3 buckets for documents
- [ ] Create ElastiCache Redis cluster
- [ ] Configure IAM roles for Lambda
- [ ] Set up SSM parameters for secrets
- [ ] Configure CloudFront distribution
- [ ] Set up CloudWatch alarms

### Deployment
- [ ] Deploy Lambda function using serverless.yml
- [ ] Configure API Gateway with Lambda integration
- [ ] Deploy frontend to AWS Amplify
- [ ] Configure CORS and WAF rules
- [ ] Run database migrations
- [ ] Seed knowledge graph with initial concepts

### Post-Deployment
- [ ] Verify health endpoint returns healthy status
- [ ] Test LLM inference via Bedrock
- [ ] Verify database connections
- [ ] Test Redis caching
- [ ] Run smoke tests for critical paths
- [ ] Configure monitoring dashboards

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

## Support

For issues, check:
- CloudWatch Logs
- Lambda execution logs
- RDS error logs
- Neo4j logs
