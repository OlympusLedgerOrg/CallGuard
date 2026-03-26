#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# CallGuard – one-command setup
# Usage:  ./setup.sh
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

info()  { printf "${GREEN}✔ %s${NC}\n" "$*"; }
warn()  { printf "${YELLOW}⚠ %s${NC}\n" "$*"; }
error() { printf "${RED}✖ %s${NC}\n" "$*"; exit 1; }

# ── Pre-flight checks ────────────────────────────────────────────────────────
command -v node  >/dev/null 2>&1 || error "Node.js is required. Install it from https://nodejs.org"
command -v npm   >/dev/null 2>&1 || error "npm is required (ships with Node.js)"

NODE_VERSION=$(node -v | grep -oE '^v[0-9]+' | tr -d 'v')
if [ -z "$NODE_VERSION" ] || [ "$NODE_VERSION" -lt 18 ]; then
  error "Node.js 18+ is required (found $(node -v))"
fi

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║       CallGuard – Setup Wizard           ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── Step 1: Root dependencies (Prisma CLI + client) ──────────────────────────
info "Installing root dependencies …"
npm install --silent

# ── Step 2: Server dependencies ──────────────────────────────────────────────
info "Installing server dependencies …"
(cd server && npm install --silent)

# ── Step 3: Environment files ────────────────────────────────────────────────
if [ ! -f .env ]; then
  cp .env.example .env
  warn "Created .env – edit it to set your DATABASE_URL"
else
  info ".env already exists, skipping"
fi

if [ ! -f server/.env ]; then
  cp server/.env.example server/.env
  warn "Created server/.env – edit it to add your Twilio, Google & OpenAI keys"
else
  info "server/.env already exists, skipping"
fi

# ── Step 4: Database migration (only if DATABASE_URL looks real) ─────────────
DB_URL=$(grep -E '^DATABASE_URL=' .env 2>/dev/null | cut -d= -f2- | tr -d '"' || true)

if [ -n "$DB_URL" ] && ! echo "$DB_URL" | grep -qE '(password@localhost|USER:PASSWORD|xxxxx)'; then
  info "Running database migrations …"
  npm run db:migrate
  info "Generating Prisma client …"
  npm run db:generate
else
  warn "Skipping database migration – update DATABASE_URL in .env first, then run:"
  echo "    npm run db:migrate && npm run db:generate"
fi

# ── Done! ────────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║            Setup complete!               ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo ""
echo "  1. Edit .env           → set your PostgreSQL DATABASE_URL"
echo "  2. Edit server/.env    → add Twilio, Google Calendar & OpenAI keys"
echo "  3. Run migrations      → npm run db:migrate && npm run db:generate"
echo "  4. Start the server    → npm start"
echo "  5. Open the dashboard  → http://localhost:3000"
echo ""
echo "Or use Docker:  docker compose up"
echo ""
