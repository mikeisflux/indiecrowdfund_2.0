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

echo "🚀 Deploying staged build..."

# Remove old backup if exists
if [ -d ".next-old" ]; then
  echo "🗑️  Removing old backup..."
  rm -rf .next-old
fi

# Backup current production build
if [ -d ".next" ]; then
  echo "📦 Backing up current build..."
  mv .next .next-old
fi

# Move staging to production
echo "📋 Copying staged build to production..."
mv .next-staging .next

echo ""
echo "✅ Deploy successful!"
echo ""
echo "Now restart PM2 to apply changes:"
echo "  pm2 restart all"
echo ""
echo "If something goes wrong, rollback with:"
echo "  npm run rollback"
