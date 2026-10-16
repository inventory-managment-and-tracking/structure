#!/usr/bin/env bash
# ClothTrack Auto-Deploy Script for VPS
# Strictly isolated to ClothTrack (/home/d3l1v3ry/htdocs/clothtrack)
# Never touches or affects the delivery platform
# Auto-deployment active via GitHub Webhook

set -e

REPO_DIR="/home/d3l1v3ry/htdocs/clothtrack"
LOG_FILE="$REPO_DIR/deploy.log"

# Fallback if running from current directory
if [ ! -d "$REPO_DIR" ]; then
  REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  LOG_FILE="$REPO_DIR/deploy.log"
fi

exec >> "$LOG_FILE" 2>&1

echo ""
echo "=================================================="
echo "Deployment started: $(date '+%Y-%m-%d %H:%M:%S')"
echo "Working directory: $REPO_DIR"
echo "=================================================="

cd "$REPO_DIR"

# 1. Fetch & pull latest main branch
echo "[1/4] Pulling latest changes from Git..."
git fetch origin main
git reset --hard origin/main

# 2. Update backend dependencies if needed
echo "[2/4] Updating backend dependencies..."
cd "$REPO_DIR/backend"
npm install --production

# 3. Build frontend application
echo "[3/4] Building frontend..."
cd "$REPO_DIR/frontend"
npm install --include=dev
npm run build
chmod -R o+rx "$REPO_DIR/frontend/dist"

# 4. Reload backend in PM2 (at the very end so restarts cannot interrupt the build)
echo "[4/4] Reloading PM2 process 'clothtrack-backend'..."
cd "$REPO_DIR/backend"
if pm2 list | grep -q "clothtrack-backend"; then
  pm2 restart clothtrack-backend --update-env
else
  pm2 start server.js --name clothtrack-backend --update-env
fi
pm2 save

echo "=================================================="
echo "Deployment completed successfully: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=================================================="
