# NOVYRA Deployment Guide

Complete guide to deploying the NOVYRA AI platform.

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Setup](#database-setup)
4. [Knowledge Graph Setup](#knowledge-graph-setup)
5. [Application Deployment](#application-deployment)
6. [Testing](#testing)
7. [Monitoring](#monitoring)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Software Requirements
- **Node.js**: 18.x or higher
- **Python**: 3.11 or higher
- **PostgreSQL**: 14.x or higher
- **Neo4j**: 5.x or higher
- **Redis**: 7.x or higher (optional, for production)
- **Docker**: 24.x or higher (for containerized deployment)

### API Keys
- Google Gemini API key (for LLM)
- OAuth credentials (Google, GitHub)

---

## Environment Setup

### 1. Clone Repository
```bash
git clone <repository-url>
cd NOVYRA
```

### 2. Create Environment Files

**Backend (.env for ai-agent)**
```bash
# File: apps/ai-agent/.env

# Database
DATABASE_URL=postgresql://novyra_user:novyra_pass@localhost:5432/novyra_db

# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_neo4j_password

# LLM
GOOGLE_API_KEY=your_google_gemini_api_key
LLM_MODEL=gemini-1.5-flash

# Redis (optional)
REDIS_URL=redis://localhost:6379

# App
PORT=8000
LOG_LEVEL=INFO
```

**Frontend (.env.local for Next.js app)**
```bash
# File: apps/app/.env.local

# Database (same as backend)
DATABASE_URL=postgresql://novyra_user:novyra_pass@localhost:5432/novyra_db

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret_min_32_chars

# OAuth
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_secret
GITHUB_ID=your_github_oauth_client_id
GITHUB_SECRET=your_github_oauth_secret

# Backend API
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 3. Install Dependencies

**Frontend**
```bash
cd apps/app
npm install
```

**Backend**
```bash
cd apps/ai-agent
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

---

## Database Setup

### Option 1: Docker Compose (Recommended)

**Create docker-compose.yml** (if not exists):
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:14
    environment:
      POSTGRES_USER: novyra_user
      POSTGRES_PASSWORD: novyra_pass
      POSTGRES_DB: novyra_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  neo4j:
    image: neo4j:5
    environment:
      NEO4J_AUTH: neo4j/your_neo4j_password
      NEO4J_PLUGINS: '["apoc"]'
    ports:
      - "7474:7474"  # Web UI
      - "7687:7687"  # Bolt
    volumes:
      - neo4j_data:/data

  redis:
    image: redis:7
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  neo4j_data:
  redis_data:
```

**Start Services**:
```bash
docker-compose up -d
```

### Option 2: Local Installation

**PostgreSQL**:
```bash
# macOS
brew install postgresql@14
brew services start postgresql@14

# Ubuntu
sudo apt-get install postgresql-14
sudo systemctl start postgresql

# Create database
createdb novyra_db
psql novyra_db -c "CREATE USER novyra_user WITH PASSWORD 'novyra_pass';"
psql novyra_db -c "GRANT ALL PRIVILEGES ON DATABASE novyra_db TO novyra_user;"
```

**Neo4j**:
```bash
# macOS
brew install neo4j

# Ubuntu
wget -O - https://debian.neo4j.com/neotechnology.gpg.key | sudo apt-key add -
echo 'deb https://debian.neo4j.com stable latest' | sudo tee /etc/apt/sources.list.d/neo4j.list
sudo apt-get update
sudo apt-get install neo4j

# Start
neo4j start

# Set password (first time)
cypher-shell -u neo4j -p neo4j
# Will prompt to change password
```

### 3. Run Prisma Migrations

```bash
cd apps/app
npx prisma migrate dev --name initial_setup
npx prisma generate
```

**Verify Schema**:
```bash
npx prisma db push
npx prisma studio  # Opens web UI to browse database
```

---

## Knowledge Graph Setup

### Auto-Seed on Startup
The application auto-seeds the knowledge graph if it has fewer than 10 concepts.

### Manual Seeding
```bash
# Start backend first
cd apps/ai-agent
uvicorn app.main:app --reload

# In another terminal, trigger seeding
curl -X POST http://localhost:8000/api/demo/seed-knowledge-graph
```

### Verify Neo4j
Open Neo4j Browser: http://localhost:7474

Run query:
```cypher
MATCH (c:Concept) RETURN c.name, c.difficulty LIMIT 10;
MATCH ()-[r:REQUIRES]->() RETURN count(r);
```

---

## Application Deployment

### Development Mode

**Backend (FastAPI)**:
```bash
cd apps/ai-agent
source venv/bin/activate  # Windows: venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

**Frontend (Next.js)**:
```bash
cd apps/app
npm run dev
```

Access:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Production Mode

**Backend**:
```bash
cd apps/ai-agent
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

**Frontend**:
```bash
cd apps/app
npm run build
npm start
```

### Docker Deployment

**Build Images**:
```bash
# Backend
docker build -t novyra-backend apps/ai-agent

# Frontend
docker build -t novyra-frontend apps/app
```

**Run Containers**:
```bash
docker run -d --name novyra-backend \
  -p 8000:8000 \
  --env-file apps/ai-agent/.env \
  novyra-backend

docker run -d --name novyra-frontend \
  -p 3000:3000 \
  --env-file apps/app/.env.local \
  novyra-frontend
```

---

## Testing

### Backend Tests
```bash
cd apps/ai-agent
pytest tests/ -v

# With coverage
pytest tests/ --cov=app --cov-report=html
open htmlcov/index.html
```

### Frontend Tests
```bash
cd apps/app
npm test

# E2E tests (if configured)
npm run test:e2e
```

### Integration Testing
```bash
# Start all services
docker-compose up -d

# Run integration tests
cd apps/ai-agent
pytest tests/test_integration.py -v
```

### Manual Testing

**Health Check**:
```bash
curl http://localhost:8000/health
```

**Test Reasoning Endpoint**:
```bash
curl -X POST http://localhost:8000/api/reasoning/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is binary search?",
    "user_id": "test-user",
    "language": "en"
  }'
```

**Test Gamification**:
```bash
# Get XP
curl http://localhost:8000/api/gamification/xp/test-user

# Get Achievements
curl http://localhost:8000/api/gamification/achievements/test-user
```

---

## Monitoring

### Health Checks
```bash
# Application health
curl http://localhost:8000/health

# Expected response:
{
  "status": "healthy",
  "postgres_connected": true,
  "neo4j_connected": true,
  "event_bus_active": true,
  "event_handlers": 12
}
```

### Logs

**Backend Logs**:
```bash
# Docker
docker logs -f novyra-backend

# Local
tail -f logs/app.log
```

**Frontend Logs**:
```bash
# Docker
docker logs -f novyra-frontend

# Local (Next.js outputs to console)
npm run dev
```

### Metrics (Production)

**Prometheus + Grafana** (optional):
```yaml
# Add to docker-compose.yml
prometheus:
  image: prom/prometheus
  ports:
    - "9090:9090"
  volumes:
    - ./prometheus.yml:/etc/prometheus/prometheus.yml

grafana:
  image: grafana/grafana
  ports:
    - "3001:3000"
  volumes:
    - grafana_data:/var/lib/grafana
```

---

## Troubleshooting

### Database Connection Issues

**Problem**: `Could not connect to PostgreSQL`

**Solutions**:
1. Verify PostgreSQL is running: `docker ps` or `systemctl status postgresql`
2. Check DATABASE_URL in .env
3. Test connection: `psql $DATABASE_URL`
4. Check firewall: `sudo ufw allow 5432`

### Neo4j Connection Issues

**Problem**: `Neo4j unreachable`

**Solutions**:
1. Verify Neo4j is running: `neo4j status`
2. Check credentials in .env
3. Test connection: `cypher-shell -u neo4j -p password`
4. Check logs: `docker logs neo4j` or `/var/log/neo4j/neo4j.log`

### LLM API Errors

**Problem**: `Google API key invalid`

**Solutions**:
1. Verify API key: https://aistudio.google.com/app/apikey
2. Check quota: https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas
3. Enable API: https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com

### Rate Limiting Issues

**Problem**: `429 Too Many Requests`

**Solutions**:
1. Check rate limits in `apps/ai-agent/app/middleware/rate_limit.py`
2. Increase limits for testing (edit RATE_LIMITS dict)
3. Wait for rate limit window to expire (check `retry_after` in response)
4. Use Redis for production rate limiting

### Prisma Migration Issues

**Problem**: `Migration failed`

**Solutions**:
```bash
# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Force apply
npx prisma db push --accept-data-loss

# Check migration status
npx prisma migrate status
```

### Event Bus Issues

**Problem**: `No event handlers registered`

**Solutions**:
1. Check import in `app/main.py`: `import app.services.events.event_handlers`
2. Verify handlers use `@event_handler` decorator
3. Check logs for handler registration count

---

## Performance Optimization

### Backend
1. **Enable Redis caching**:
   ```python
   # In app/core/cache.py
   from redis import Redis
   cache = Redis.from_url(os.getenv("REDIS_URL"))
   ```

2. **Database indexing**:
   ```sql
   CREATE INDEX idx_user_id ON xp_ledger(user_id);
   CREATE INDEX idx_content_hash ON content_embedding(content_hash);
   CREATE INDEX idx_voter_target ON vote_graph(voter_id, target_user_id);
   ```

3. **Connection pooling**:
   ```python
   # In DATABASE_URL
   DATABASE_URL=postgresql://user:pass@host:5432/db?pool_size=20&max_overflow=0
   ```

### Frontend
1. **Enable Next.js caching**:
   ```js
   // next.config.js
   module.exports = {
     swcMinify: true,
     compress: true,
     poweredByHeader: false
   }
   ```

2. **Image optimization**: Use Next.js Image component
3. **Route caching**: Use `revalidate` in API routes

---

## Security Hardening

### Production Checklist
- [ ] Change all default passwords
- [ ] Enable HTTPS (use Let's Encrypt)
- [ ] Set secure cookie flags in NextAuth
- [ ] Enable CORS only for trusted origins
- [ ] Use environment-specific secrets
- [ ] Enable database SSL connections
- [ ] Set up firewall rules (only expose 80, 443)
- [ ] Enable rate limiting in production
- [ ] Set up automated backups
- [ ] Enable audit logging

### SSL Certificate (Let's Encrypt)
```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### Firewall (Ubuntu)
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22   # SSH
sudo ufw allow 80   # HTTP
sudo ufw allow 443  # HTTPS
sudo ufw enable
```

---

## Backup & Recovery

### Database Backup
```bash
# PostgreSQL
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restore
psql $DATABASE_URL < backup_20250101.sql
```

### Neo4j Backup
```bash
# Export
neo4j-admin dump --database=neo4j --to=/backups/neo4j-backup.dump

# Restore
neo4j-admin load --database=neo4j --from=/backups/neo4j-backup.dump
```

### Automated Backups (Cron)
```bash
# Add to crontab (crontab -e)
0 2 * * * /path/to/backup-script.sh
```

---

## Scaling Considerations

### Horizontal Scaling
1. Deploy multiple backend instances behind load balancer
2. Use Redis for shared rate limiting
3. Use Redis for event queue (replace in-memory)
4. Shared PostgreSQL with connection pooling

### Vertical Scaling
1. Increase PostgreSQL memory (shared_buffers)
2. Increase Neo4j heap size (dbms.memory.heap.max_size)
3. Increase worker processes (gunicorn -w)

### CDN
Use Cloudflare or AWS CloudFront for:
- Static assets
- API response caching
- DDoS protection

---

## Support & Resources

- **Documentation**: See /docs folder
- **API Reference**: http://localhost:8000/docs
- **GitHub Issues**: [Repository issues]
- **Slack/Discord**: [Community link]

---

**End of Deployment Guide**
