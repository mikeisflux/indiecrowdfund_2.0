#!/bin/bash

# Rollback to previous build
# Usage: ./scripts/rollback.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Check if backup exists
if [ ! -d ".next-old" ]; then
  echo "❌ No .next backup found to rollback to!"
  exit 1
fi

# Both .next and .prisma are paired by Prisma 7's per-generate hash, so
# either both roll back together or neither does. Refuse the rollback if
# we don't have the matching Prisma client.
if [ ! -d ".prisma-old" ]; then
  echo "❌ No .prisma-old backup — cannot safely roll back."
  echo "   .next-old and .prisma-old must be rolled back together, otherwise"
  echo "   you'll hit the @prisma/client-<hash> mismatch crash."
  exit 1
fi

echo "⏪ Rolling back to previous build..."

# Remove current (failed) build + its paired Prisma client
if [ -d ".next" ]; then
  rm -rf .next
fi
if [ -d "node_modules/.prisma" ]; then
  rm -rf node_modules/.prisma
fi

# Restore paired backup
mv .next-old .next
mv .prisma-old node_modules/.prisma

echo ""
echo "✅ Rollback successful!"
echo ""
echo "Restart PM2 to apply:"
echo "  pm2 restart all"
