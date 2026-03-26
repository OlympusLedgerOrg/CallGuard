#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# CallGuard – one-command setup
# Usage:  ./setup.sh
# No external database needed — SQLite is built in.
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

info()  { printf "${GREEN}✔ %s${NC}\n" "$*"; }
warn()  { printf "${YELLOW}⚠ %s${NC}\n" "$*"; }
error() { printf "${RED}✖ %s${NC}\n" "$*"; exit 1; }

# ── cd to this script's directory (repo root) ────────────────────────────────
cd "$(dirname "$0")"

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
npm install

# ── Step 2: Server dependencies ──────────────────────────────────────────────
info "Installing server dependencies …"
(cd server && npm install)

# ── Step 3: Environment files ────────────────────────────────────────────────
if [ ! -f server/.env ]; then
  cp server/.env.example server/.env
  warn "Created server/.env from template – edit it to add your Twilio, Google & OpenAI keys"
else
  info "server/.env already exists, skipping"
fi

# ── Step 4: Create data directory + database ─────────────────────────────────
mkdir -p data
info "Running database migrations (SQLite — no external DB needed) …"
if npx prisma migrate deploy 2>&1; then
  info "Generating Prisma client …"
  npx prisma generate
else
  warn "Database migration failed. You can retry later:"
  echo "    npx prisma migrate deploy && npx prisma generate"
fi

# ── Done! ────────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║            Setup complete!               ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo ""
echo "  1. Edit server/.env    → add Twilio, Google Calendar & OpenAI keys"
echo "  2. Start the server    → npm start"
echo "  3. Open the dashboard  → http://localhost:3000"
echo ""
echo "No external database needed — CallGuard uses SQLite (data/callguard.db)."
echo ""
echo "Or use Docker:  docker compose up"
echo ""
