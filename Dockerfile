# ──────────────────────────────────────────────────────────────────────────────
# CallGuard – Dockerfile
# Multi-stage build: install deps → run migrations → start server
# No external database needed — uses SQLite (file-based).
# ──────────────────────────────────────────────────────────────────────────────
FROM node:20-slim AS base
WORKDIR /app

# ── Stage 1: Install root deps (Prisma) ─────────────────────────────────────
COPY package.json package-lock.json ./
RUN npm ci --silent

# ── Stage 2: Install server deps ────────────────────────────────────────────
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm install --silent

# ── Stage 3: Copy source code ───────────────────────────────────────────────
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY config ./config
COPY src ./src
COPY server ./server
COPY callguard-app.jsx ./

# Create data directory for SQLite and generate Prisma client
RUN mkdir -p data && npx prisma generate

EXPOSE 3000

# ── Start: migrate + run ────────────────────────────────────────────────────
CMD ["sh", "-c", "npx prisma migrate deploy && node server/src/index.js"]
