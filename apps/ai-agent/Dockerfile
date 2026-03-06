ARG PYTHON_VERSION=3.12

# Builder: build wheels to reduce final image size
FROM python:${PYTHON_VERSION}-slim AS builder
WORKDIR /wheels

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential gcc libssl-dev libffi-dev libxml2-dev libxslt1-dev git curl \
    && rm -rf /var/lib/apt/lists/*

COPY ./apps/ai-agent/requirements.txt /wheels/requirements.txt

RUN python -m pip install --upgrade pip setuptools wheel
RUN pip wheel --no-cache-dir --wheel-dir /wheels -r /wheels/requirements.txt

# Runtime image
FROM python:${PYTHON_VERSION}-slim AS runtime
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends libssl-dev libffi-dev libxml2 libxslt1.1 curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /wheels /wheels
RUN python -m pip install --upgrade pip
RUN pip install --no-cache-dir /wheels/*.whl || true

COPY ./apps/ai-agent /app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
