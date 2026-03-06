# Entropy AI Engine - AWS Deployment Guide

## Prerequisites

- AWS account with appropriate permissions
- AWS CLI configured with credentials
- Node.js 18+ for AWS CDK
- Python 3.11+ for Lambda functions
- Docker for local development

## Quick Start (Local Development)

### 1. Clone and Setup

```bash
cd apps/ai-agent
cp .env.example .env
# Edit .env with your configuration
```

### 2. Run with Docker

```bash
docker-compose up -d
```

### 3. Access the API

- API: http://localhost:8000
- Health: http://localhost:8000/health
- Docs: http://localhost:8000/docs

## Production Deployment (AWS)

### Option 1: Using Serverless Framework

#### 1. Install Serverless

```bash
npm install -g serverless
```

#### 2. Configure AWS Credentials

```bash
aws configure
```

#### 3. Deploy

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
