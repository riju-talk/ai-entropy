ARG PYTHON_VERSION=3.13.5

# Builder: build wheels to reduce final image size
FROM python:${PYTHON_VERSION}-slim AS builder
WORKDIR /wheels

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install build deps
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential gcc libssl-dev libffi-dev libxml2-dev libxslt1-dev git curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements from repo (supports building from repository root)
COPY ./apps/ai-agent/requirements.txt /wheels/requirements.txt

# Build wheels
RUN python -m pip install --upgrade pip setuptools wheel
RUN pip wheel --no-cache-dir --wheel-dir /wheels -r /wheels/requirements.txt

# Runtime image
FROM python:${PYTHON_VERSION}-slim AS runtime
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install minimal runtime system packages
RUN apt-get update \
    && apt-get install -y --no-install-recommends libssl-dev libffi-dev libxml2 libxslt1.1 curl \
    && rm -rf /var/lib/apt/lists/*

# Copy wheels and install
COPY --from=builder /wheels /wheels
RUN python -m pip install --upgrade pip
RUN pip install --no-cache-dir /wheels/*.whl || true

# Copy application source from repo (supports building from repository root)
COPY ./apps/ai-agent /app

# Create non-root user
RUN useradd --create-home --shell /bin/bash ai \
    && chown -R ai:ai /app

USER ai

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Default production command using Gunicorn + Uvicorn workers
CMD ["gunicorn", "-k", "uvicorn.workers.UvicornWorker", "app.main:app", "-b", "0.0.0.0:8000", "--workers", "2", "--log-level", "info"]
