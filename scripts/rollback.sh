#!/bin/bash

# Rollback to previous build
# Usage: ./scripts/rollback.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Check if backup exists
if [ ! -d ".next-old" ]; then
  echo "❌ No backup build found to rollback to!"
  exit 1
fi

echo "⏪ Rolling back to previous build..."

# Remove current (failed) build
if [ -d ".next" ]; then
  rm -rf .next
fi

# Restore backup
mv .next-old .next

echo ""
echo "✅ Rollback successful!"
echo ""
echo "Restart PM2 to apply:"
echo "  pm2 restart all"
