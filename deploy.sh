#!/bin/bash

# Seamless deployment script
# Builds in a separate directory, then swaps and restarts PM2

set -e  # Exit on any error

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
HOME_DIR="$(dirname "$REPO_DIR")"
BUILD_DIR="${HOME_DIR}/indiecrowdfund_build"
BACKUP_DIR="${HOME_DIR}/indiecrowdfund_backup"

echo "🚀 Starting seamless deployment..."
echo "=================================="

# Step 1: Create/update build directory
echo ""
echo "📦 Step 1: Preparing build directory..."
if [ -d "$BUILD_DIR" ]; then
    echo "   Updating existing build directory..."
    cd "$BUILD_DIR"
    git fetch origin
    git reset --hard origin/main
else
    echo "   Cloning fresh copy..."
    git clone "$REPO_DIR" "$BUILD_DIR"
    cd "$BUILD_DIR"
fi

# Step 2: Install dependencies
echo ""
echo "📥 Step 2: Installing dependencies..."
npm ci --prefer-offline

# Step 3: Generate Prisma client
echo ""
echo "🔧 Step 3: Generating Prisma client..."
npx prisma generate

# Step 4: Build the application
echo ""
echo "🔨 Step 4: Building application..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed! Aborting deployment."
    exit 1
fi

echo "✅ Build successful!"

# Step 5: Backup current .next directory
echo ""
echo "💾 Step 5: Backing up current build..."
if [ -d "$REPO_DIR/.next" ]; then
    rm -rf "$BACKUP_DIR"
    cp -r "$REPO_DIR/.next" "$BACKUP_DIR"
    echo "   Backup created at $BACKUP_DIR"
fi

# Step 6: Copy new build to production
echo ""
echo "📋 Step 6: Copying new build to production..."
rm -rf "$REPO_DIR/.next"
cp -r "$BUILD_DIR/.next" "$REPO_DIR/.next"

# Step 7: Reload PM2 (rolling restart for zero-downtime in cluster mode)
echo ""
echo "🔄 Step 7: Reloading PM2 (zero-downtime rolling restart)..."
cd "$REPO_DIR"
pm2 reload all --update-env

echo ""
echo "=================================="
echo "✅ Deployment complete!"
echo ""
echo "To rollback if needed, run:"
echo "   cp -r $BACKUP_DIR $REPO_DIR/.next && pm2 restart all"
