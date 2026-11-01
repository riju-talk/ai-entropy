# Entropy AI service: single worker, sized for a 512 MB free-tier instance.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    FASTEMBED_CACHE_PATH=/opt/fastembed

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl libgomp1 libatomic1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install -r requirements.txt

# Prisma query engine for the Postgres client (generate needs placeholder URLs only)
COPY prisma ./prisma
RUN DATABASE_URL=postgresql://x:x@localhost/x DIRECT_URL=postgresql://x:x@localhost/x \
    prisma generate --schema=prisma/schema.prisma

# Bake the embedding model into the image so cold starts never download it
RUN python -c "from fastembed import TextEmbedding; TextEmbedding('BAAI/bge-small-en-v1.5')"

COPY app ./app

EXPOSE 8000
# Render supplies $PORT; default to 8000 locally
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
