#!/bin/bash

# Deploy staged build to production
# Usage: ./scripts/deploy.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Check if staging build exists
if [ ! -d ".next-staging" ]; then
  echo "❌ No staged build found!"
  echo "Run 'npm run build:staging' first to create a staged build."
  exit 1
fi

# The Prisma client staged alongside must also be present — Prisma 7
# bakes a unique hash into both the compiled .next chunks and the
# generated client, and they must be swapped together or the runtime
# crashes with `Cannot find module @prisma/client-<hash>`.
if [ ! -d ".prisma-staging" ]; then
  echo "❌ No staged Prisma client found at .prisma-staging!"
  echo "Re-run 'npm run build:staging' — the updated script stages both."
  exit 1
fi

echo "🚀 Deploying staged build..."

# Remove old backups if they exist
if [ -d ".next-old" ]; then
  echo "🗑️  Removing old .next backup..."
  rm -rf .next-old
fi
if [ -d ".prisma-old" ]; then
  echo "🗑️  Removing old .prisma backup..."
  rm -rf .prisma-old
fi

# Backup current production build + matching Prisma client
if [ -d ".next" ]; then
  echo "📦 Backing up current .next build..."
  mv .next .next-old
fi
if [ -d "node_modules/.prisma" ]; then
  echo "📦 Backing up current Prisma client..."
  mv node_modules/.prisma .prisma-old
fi

# Atomically swap in the staged .next + matching .prisma client
echo "📋 Installing staged build..."
mv .next-staging .next
mv .prisma-staging node_modules/.prisma

echo ""
echo "✅ Deploy successful!"
echo ""
echo "Now restart PM2 to apply changes:"
echo "  pm2 restart all"
echo ""
echo "If something goes wrong, rollback with:"
echo "  npm run rollback"
