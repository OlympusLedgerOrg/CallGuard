# ──────────────────────────────────────────────────────────────────────────────
# CallGuard – Dockerfile
# Multi-stage build: install deps → run migrations → start server
# ──────────────────────────────────────────────────────────────────────────────
FROM node:20-slim AS base
WORKDIR /app

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# ── Stage 1: Install root deps (Prisma) ─────────────────────────────────────
COPY package.json package-lock.json ./
RUN npm ci --silent

# ── Stage 2: Install server deps ────────────────────────────────────────────
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm install --silent

# ── Stage 3: Copy source code ───────────────────────────────────────────────
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY src ./src
COPY server ./server
COPY callguard-app.jsx ./

# Generate Prisma client
RUN npx prisma generate

EXPOSE 3000

# ── Start: migrate + run ────────────────────────────────────────────────────
CMD ["sh", "-c", "npx prisma migrate deploy && node server/src/index.js"]
