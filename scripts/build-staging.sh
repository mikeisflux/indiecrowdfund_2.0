#!/bin/bash

# Build to staging directory without affecting the live site
# Usage: ./scripts/build-staging.sh
#
# This script builds in a temp directory to avoid affecting the live .next folder,
# then copies the successful build to .next-staging for deployment.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "🔨 Building to staging directory..."

# Remove any previous staging build
if [ -d ".next-staging" ]; then
  echo "🗑️  Removing previous staging build..."
  rm -rf .next-staging
fi

# Create a temporary build directory
BUILD_DIR=$(mktemp -d)
echo "📁 Using temp build directory: $BUILD_DIR"

cleanup() {
  echo "🧹 Cleaning up temp directory..."
  rm -rf "$BUILD_DIR"
}
trap cleanup EXIT

# Copy necessary files to temp directory (excluding large/unnecessary dirs)
echo "📋 Copying project files..."
rsync -a \
  --exclude='.next' \
  --exclude='.next-staging' \
  --exclude='.next-old' \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='uploads' \
  . "$BUILD_DIR/"

# Install dependencies first to ensure new packages are present
echo "📦 Installing dependencies..."
npm install --production=false

# Copy node_modules to build directory
echo "📦 Copying node_modules..."
cp -r node_modules "$BUILD_DIR/"

# Build in the temp directory
cd "$BUILD_DIR"

echo "📦 Generating Prisma client..."
npx prisma generate

echo "🏗️  Running Next.js build..."
if npm run build; then
  echo "📋 Copying build output to staging..."
  cp -r "$BUILD_DIR/.next" "$PROJECT_DIR/.next-staging"

  # Prisma 7 stamps a unique hash into the generated client on every
  # `prisma generate`, and Next.js bakes that hash into the compiled
  # chunks as `require("@prisma/client-<hash>")`. The hash in the temp
  # BUILD_DIR will not match the hash in the live PROJECT_DIR/node_modules
  # (postinstall also ran prisma generate), so if we ship only .next
  # the site crashes at runtime with `Cannot find module
  # @prisma/client-<hash>`. Stage the generated client alongside .next
  # so deploy.sh can atomically swap both together.
  echo "📋 Copying generated Prisma client to staging..."
  rm -rf "$PROJECT_DIR/.prisma-staging"
  if [ -d "$BUILD_DIR/node_modules/.prisma" ]; then
    cp -r "$BUILD_DIR/node_modules/.prisma" "$PROJECT_DIR/.prisma-staging"
  else
    echo "⚠️  No generated Prisma client found in BUILD_DIR — deploy will fail"
    exit 1
  fi

  cd "$PROJECT_DIR"
  echo ""
  echo "✅ Build successful! Staged in .next-staging + .prisma-staging"
  echo ""
  echo "To deploy, run: npm run deploy"
  echo "Or manually: ./scripts/deploy.sh"
  exit 0
else
  cd "$PROJECT_DIR"
  echo ""
  echo "❌ Build failed!"
  exit 1
fi
