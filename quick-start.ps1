# NOVYRA Quick Start Script
# Starts all services for local development

Write-Host "=================================" -ForegroundColor Cyan
Write-Host "   NOVYRA Quick Start" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
Write-Host "[1/6] Checking Docker..." -ForegroundColor Yellow
$dockerRunning = docker ps 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ❌ Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}
Write-Host "  ✅ Docker is running" -ForegroundColor Green

# Check if docker-compose.yml exists
if (-not (Test-Path "docker-compose.yml")) {
    Write-Host "  ℹ️  docker-compose.yml not found. Creating..." -ForegroundColor Yellow
    
    $dockerComposeContent = @"
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
      NEO4J_AUTH: neo4j/novyra_neo4j_pass
      NEO4J_PLUGINS: '["apoc"]'
    ports:
      - "7474:7474"
      - "7687:7687"
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
"@
    
    $dockerComposeContent | Out-File -FilePath "docker-compose.yml" -Encoding UTF8
    Write-Host "  ✅ docker-compose.yml created" -ForegroundColor Green
}

# Start Docker services
Write-Host ""
Write-Host "[2/6] Starting Docker services..." -ForegroundColor Yellow
docker-compose up -d postgres neo4j redis

# Wait for services to be ready
Write-Host "  ⏳ Waiting for services to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Check PostgreSQL
$pgReady = $false
for ($i = 0; $i -lt 30; $i++) {
    $pgTest = docker exec -it (docker ps -q -f name=postgres) pg_isready 2>$null
    if ($LASTEXITCODE -eq 0) {
        $pgReady = $true
        break
    }
    Start-Sleep -Seconds 1
}

if ($pgReady) {
    Write-Host "  ✅ PostgreSQL is ready" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  PostgreSQL may not be ready yet" -ForegroundColor Yellow
}

# Check Neo4j
Write-Host "  ✅ Neo4j is starting (will be ready in ~10s)" -ForegroundColor Green
Write-Host "  ℹ️  Neo4j Browser: http://localhost:7474" -ForegroundColor Cyan

# Check if .env files exist
Write-Host ""
Write-Host "[3/6] Checking environment files..." -ForegroundColor Yellow

$backendEnvPath = "apps\ai-agent\.env"
if (-not (Test-Path $backendEnvPath)) {
    Write-Host "  ℹ️  Backend .env not found. Creating..." -ForegroundColor Yellow
    
    $backendEnv = @"
# Database
DATABASE_URL=postgresql://novyra_user:novyra_pass@localhost:5432/novyra_db

# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=novyra_neo4j_pass

# LLM (you need to add your Google API key)
GOOGLE_API_KEY=your_google_gemini_api_key_here
LLM_MODEL=gemini-1.5-flash

# Redis
REDIS_URL=redis://localhost:6379

# App
PORT=8000
LOG_LEVEL=INFO
"@
    
    $backendEnv | Out-File -FilePath $backendEnvPath -Encoding UTF8
    Write-Host "  ⚠️  Created $backendEnvPath" -ForegroundColor Yellow
    Write-Host "  ⚠️  Please add your GOOGLE_API_KEY!" -ForegroundColor Red
}
Write-Host "  ✅ Backend .env exists" -ForegroundColor Green

$frontendEnvPath = "apps\app\.env.local"
if (-not (Test-Path $frontendEnvPath)) {
    Write-Host "  ℹ️  Frontend .env.local not found. Creating..." -ForegroundColor Yellow
    
    $frontendEnv = @"
# Database
DATABASE_URL=postgresql://novyra_user:novyra_pass@localhost:5432/novyra_db

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=$(New-Guid)

# OAuth (you need to add your OAuth credentials)
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_secret
GITHUB_ID=your_github_oauth_client_id
GITHUB_SECRET=your_github_oauth_secret

# Backend API
NEXT_PUBLIC_API_URL=http://localhost:8000
"@
    
    $frontendEnv | Out-File -FilePath $frontendEnvPath -Encoding UTF8
    Write-Host "  ⚠️  Created $frontendEnvPath" -ForegroundColor Yellow
    Write-Host "  ⚠️  Please add your OAuth credentials!" -ForegroundColor Red
}
Write-Host "  ✅ Frontend .env.local exists" -ForegroundColor Green

# Run Prisma migrations
Write-Host ""
Write-Host "[4/6] Running Prisma migrations..." -ForegroundColor Yellow
Push-Location apps\app
if (Test-Path "node_modules") {
    npx prisma generate
    npx prisma db push --accept-data-loss
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ Database schema updated" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Prisma migration had warnings (check above)" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ⚠️  node_modules not found. Run 'npm install' first." -ForegroundColor Yellow
}
Pop-Location

# Check Python environment
Write-Host ""
Write-Host "[5/6] Checking Python environment..." -ForegroundColor Yellow
Push-Location apps\ai-agent
if (Test-Path "venv") {
    Write-Host "  ✅ Python virtual environment exists" -ForegroundColor Green
} else {
    Write-Host "  ℹ️  Creating Python virtual environment..." -ForegroundColor Yellow
    python -m venv venv
    Write-Host "  ✅ Virtual environment created" -ForegroundColor Green
}

Write-Host "  ℹ️  Activating virtual environment..." -ForegroundColor Yellow
& "venv\Scripts\Activate.ps1"

if (Test-Path "requirements.txt") {
    Write-Host "  ℹ️  Installing Python dependencies..." -ForegroundColor Yellow
    pip install -r requirements.txt --quiet
    Write-Host "  ✅ Dependencies installed" -ForegroundColor Green
}
Pop-Location

# Summary
Write-Host ""
Write-Host "[6/6] Setup Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "=================================" -ForegroundColor Cyan
Write-Host "   Services Running" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host "  PostgreSQL:  localhost:5432" -ForegroundColor White
Write-Host "  Neo4j UI:    http://localhost:7474" -ForegroundColor White
Write-Host "  Neo4j Bolt:  bolt://localhost:7687" -ForegroundColor White
Write-Host "  Redis:       localhost:6379" -ForegroundColor White
Write-Host ""
Write-Host "=================================" -ForegroundColor Cyan
Write-Host "   Next Steps" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Add API keys to .env files:" -ForegroundColor Yellow
Write-Host "   - apps\ai-agent\.env (GOOGLE_API_KEY)" -ForegroundColor White
Write-Host "   - apps\app\.env.local (OAuth credentials)" -ForegroundColor White
Write-Host ""
Write-Host "2. Start Backend (AI Agent):" -ForegroundColor Yellow
Write-Host "   cd apps\ai-agent" -ForegroundColor White
Write-Host "   venv\Scripts\Activate.ps1" -ForegroundColor White
Write-Host "   uvicorn app.main:app --reload" -ForegroundColor White
Write-Host ""
Write-Host "3. Start Frontend (Next.js):" -ForegroundColor Yellow
Write-Host "   cd apps\app" -ForegroundColor White
Write-Host "   npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "4. Access Application:" -ForegroundColor Yellow
Write-Host "   Frontend:    http://localhost:3000" -ForegroundColor White
Write-Host "   Backend API: http://localhost:8000" -ForegroundColor White
Write-Host "   API Docs:    http://localhost:8000/docs" -ForegroundColor White
Write-Host ""
Write-Host "=================================" -ForegroundColor Cyan
Write-Host "   Useful Commands" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host "  Stop services:   docker-compose down" -ForegroundColor White
Write-Host "  View logs:       docker-compose logs -f" -ForegroundColor White
Write-Host "  Reset database:  docker-compose down -v" -ForegroundColor White
Write-Host "  Run tests:       pytest apps/ai-agent/tests/" -ForegroundColor White
Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
