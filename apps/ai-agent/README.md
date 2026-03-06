# Entropy AI Engine

**Version:** 3.0  
**Status:** Production-Ready for AWS Deployment

Entropy is an AI-powered learning and developer productivity platform that accelerates understanding of complex technical concepts. The platform combines AI explanation workflows, document intelligence, graph-based reasoning, adaptive learning paths, community collaboration, gamification, and multilingual support.

## Features

- **8-Layer AI Brain Architecture** - Structured reasoning with intent detection, concept mapping, graph traversal, reasoning engine, NLI validation, and trust scoring
- **Document Intelligence** - PDF/DOCX/TXT upload with contextual Q&A
- **Knowledge Graph Reasoning** - Concept mapping with prerequisite detection
- **Community Learning** - Subject communities and Q&A
- **Gamification** - XP, entropy coins, levels, achievements, leaderboards
- **Multilingual Support** - 19+ languages including Indian regional languages
- **Anti-Abuse System** - IP clustering, similarity detection, vote analysis
- **Async Event Processing** - Event-driven architecture for scalability

## Tech Stack

### Backend
- **FastAPI** - Python web framework
- **Pydantic v2** - Data validation
- **Mangum** - AWS Lambda adapter

### AI/ML
- **Amazon Bedrock** - Claude 3 Sonnet, Titan Embeddings V2
- **Custom RAG** - No LangChain, custom orchestration
- **8-Layer AI Brain** - Intent detection, concept mapping, graph traversal, reasoning, NLI validation, trust scoring

### Databases
- **Amazon RDS PostgreSQL** - Relational data
- **Amazon DocumentDB** - Document storage
- **Amazon Neo4j** - Knowledge graph

### Infrastructure
- **AWS Lambda** - Serverless compute
- **Amazon API Gateway** - Serverless API
- **Amazon S3** - Document storage
- **Amazon ElastiCache Redis** - Caching
- **Amazon SQS** - Async message queue

## Quick Start

### Local Development

```bash
cd apps/ai-agent

# Install dependencies
pip install -r requirements.txt

# Run with Docker
docker-compose up -d

# Or run directly
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
# Edit .env with your configuration
```

## API Endpoints

### Health
- `GET /health` - Health check

### AI Engine
- `POST /api/reasoning/ask` - Structured reasoning with AI Brain
- `POST /api/evaluation/evaluate` - Rubric-based evaluation
- `POST /api/mastery/attempt` - Mastery tracking
- `GET /api/graph/concepts` - Knowledge graph queries

### Legacy
- `POST /api/qa` - Q&A
- `POST /api/documents/upload` - Document upload
- `POST /api/quiz/generate` - Quiz generation
- `POST /api/mindmap/generate` - Mindmap generation

## AWS Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.

### Required AWS Services

- AWS Lambda
- Amazon API Gateway
- Amazon Bedrock
- Amazon RDS PostgreSQL
- Amazon DocumentDB
- Amazon Neo4j
- Amazon S3
- Amazon ElastiCache Redis
- Amazon SQS
- Amazon CloudFront
- AWS IAM
- AWS KMS
- Amazon WAF
- Amazon CloudWatch

## Project Structure

```
apps/ai-agent/
├── app/
│   ├── api/
│   │   └── routes/
│   │       ├── qa.py
│   │       ├── documents.py
│   │       ├── quiz.py
│   │       ├── mindmap.py
│   │       ├── reasoning.py
│   │       ├── evaluation.py
│   │       ├── mastery.py
│   │       └── graph.py
│   ├── core/
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── llm.py
│   │   └── embeddings.py
│   ├── services/
│   │   ├── ai_brain/          # 8-layer AI Brain
│   │   ├── anti_abuse/        # Anti-abuse detection
│   │   ├── gamification/      # XP, coins, achievements
│   │   ├── events/            # Event bus
│   │   ├── chat_service.py
│   │   ├── knowledge_graph_service.py
│   │   └── ...
│   └── middleware/
│       ├── auth.py
│       ├── observability.py
│       └── rate_limit.py
├── prisma/
│   └── schema.prisma
├── lambda_handler.py
├── serverless.yml
├── Dockerfile
├── docker-compose.yml
└── requirements.txt
```

## Development

### Running Tests

```bash
pytest
```

### Linting

```bash
flake8 app/
mypy app/
```

## Documentation

- [Requirements](requirements.md) - Full requirements specification
- [Design](design.md) - System design document
- [Deployment](DEPLOYMENT.md) - AWS deployment guide
- [AWS Services](AWS_SERVICES_LIST.md) - AWS services required

## License

MIT License

## Support

For issues and questions, please open an issue on GitHub.
