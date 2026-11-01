# Entropy web app (Next.js). Build context is the repo root: docker build -f apps/app/Dockerfile .
FROM node:20-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /repo

# Install dependencies first so source edits don't bust this layer
COPY package.json package-lock.json ./
COPY apps/app/package.json apps/app/.npmrc apps/app/
COPY apps/ai-agent/package.json apps/ai-agent/
RUN npm ci --workspace=@entropy/app --include-workspace-root --legacy-peer-deps

COPY apps/app apps/app
WORKDIR /repo/apps/app

# Generate the Prisma client and build; no database is needed at build time
ENV NEXT_TELEMETRY_DISABLED=1 SKIP_DB=true
RUN DATABASE_URL=postgresql://x:x@localhost/x DIRECT_URL=postgresql://x:x@localhost/x npx prisma generate --schema=prisma/schema.prisma \
    && npx next build
ENV SKIP_DB=

EXPOSE 5000
CMD ["npx", "next", "start", "-p", "5000"]
