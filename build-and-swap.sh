#!/bin/bash

# Quick build and swap script (Turbopack edition)
# Backs up current build, builds in-place with Turbopack cache, restarts PM2
# If build fails, rolls back from backup automatically
#
# Turbopack's filesystem cache lives inside .next/ — building in-place
# lets subsequent builds reuse the cache (~2s compile vs ~43s cold).
# The backup is taken BEFORE building so rollback is always available.

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🚀 Starting build and swap..."
echo "=================================="
START_TIME=$(date +%s)

# Step 1: Pull latest changes
echo ""
echo "📥 Step 1: Pull latest changes..."

CURRENT_BRANCH=$(git branch --show-current)
echo ""
echo "   Current branch: ${CURRENT_BRANCH}"
echo ""
echo "Available remote branches:"
git branch -r | grep -v "HEAD" | head -20
echo ""
read -p "Enter branch to pull from [${CURRENT_BRANCH}]: " PULL_BRANCH
PULL_BRANCH="${PULL_BRANCH:-$CURRENT_BRANCH}"

echo ""
echo "   Pulling from: ${PULL_BRANCH}"

if git fetch origin "$PULL_BRANCH" 2>&1 && git pull origin "$PULL_BRANCH" 2>&1; then
    echo -e "${GREEN}   Git pull successful${NC}"
else
    echo -e "${YELLOW}   Could not pull (continuing with local code)${NC}"
fi

# Step 2: Install dependencies
echo ""
echo "📦 Step 2: Installing dependencies..."
if npm install --prefer-offline 2>&1; then
    echo -e "${GREEN}   Dependencies installed${NC}"
else
    echo -e "${RED}❌ ERROR: Failed to install dependencies${NC}"
    exit 1
fi

# Step 3: Generate Prisma client
echo ""
echo "🔧 Step 3: Generating Prisma client..."
if npx prisma generate 2>&1; then
    echo -e "${GREEN}   Prisma client generated${NC}"
else
    echo -e "${RED}❌ ERROR: Failed to generate Prisma client${NC}"
    exit 1
fi

# Step 4: Run type check
echo ""
echo "🔍 Step 4: Running type check..."
# Use tsconfig.build.json which excludes .next to avoid stale type references
if npx tsc --noEmit --project tsconfig.build.json 2>&1; then
    echo -e "${GREEN}   Type check passed${NC}"
else
    echo -e "${RED}❌ ERROR: TypeScript errors found!${NC}"
    echo ""
    echo "Run 'npx tsc --noEmit --project tsconfig.build.json' to see details"
    exit 1
fi

# Step 5: Backup current build BEFORE building in-place
# This is the key change: we build directly into .next so Turbopack's
# filesystem cache is reused (~2s compile instead of ~43s). The backup
# ensures we can always roll back.
echo ""
echo "🧹 Step 5: Backing up current build..."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Clean up any previous failed build attempts
if [ -d ".next-new" ]; then
    rm -rf .next-new
    echo -e "${GREEN}   Cleaned up stale .next-new${NC}"
fi

# Backup current live build
if [ -d ".next" ]; then
    cp -al .next ".next-backup-${TIMESTAMP}"
    echo -e "${GREEN}   Backed up to .next-backup-${TIMESTAMP} (hardlink copy, instant)${NC}"
else
    echo -e "${YELLOW}   No existing build to backup${NC}"
fi

# Clean stale .next/types (only used for TS checking, not runtime)
if [ -d ".next/types" ]; then
    rm -rf .next/types
    echo -e "${GREEN}   Cleaned stale .next/types${NC}"
fi

# Keep only the 2 most recent backups
BACKUP_COUNT=$(ls -dt .next-backup-* 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt 3 ]; then
    echo "   Cleaning old backups (keeping last 3)..."
    ls -dt .next-backup-* | tail -n +4 | xargs rm -rf
    echo -e "${GREEN}   Old backups removed${NC}"
fi

# Step 6: Build in-place with Turbopack cache
# Building directly into .next means Turbopack reuses its filesystem
# cache from the previous build. Only changed modules recompile.
echo ""
echo "⚡ Step 6: Building with Turbopack (in-place, cached)..."
BUILD_OUTPUT=$(npx next build 2>&1)
BUILD_EXIT_CODE=$?

if [ $BUILD_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ Build successful!${NC}"

    # Show compile time from build output
    COMPILE_TIME=$(echo "$BUILD_OUTPUT" | grep -oP 'Compiled successfully in \K[0-9.]+s' || echo "unknown")
    echo "   Compile time: ${COMPILE_TIME}"
else
    echo -e "${RED}❌ BUILD FAILED!${NC}"
    echo ""
    echo "========== BUILD ERRORS =========="
    echo "$BUILD_OUTPUT" | tail -50
    echo "=================================="
    echo ""

    # Roll back from backup
    LATEST_BACKUP=$(ls -dt .next-backup-* 2>/dev/null | head -1)
    if [ -n "$LATEST_BACKUP" ]; then
        echo "   Rolling back to ${LATEST_BACKUP}..."
        rm -rf .next
        mv "$LATEST_BACKUP" .next
        echo -e "${GREEN}   Rolled back. Site is still running with previous build.${NC}"
    else
        echo -e "${RED}   No backup available for rollback!${NC}"
    fi
    exit 1
fi

# Step 7: Reload PM2 (rolling restart for zero-downtime in cluster mode)
echo ""
echo "🔄 Step 7: Reloading PM2 (zero-downtime rolling restart)..."
if pm2 reload all --update-env 2>&1; then
    echo -e "${GREEN}   PM2 reloaded${NC}"
else
    echo -e "${RED}❌ ERROR: PM2 reload failed!${NC}"
    echo "   Attempting rollback..."
    LATEST_BACKUP=$(ls -dt .next-backup-* 2>/dev/null | head -1)
    if [ -n "$LATEST_BACKUP" ]; then
        rm -rf .next
        mv "$LATEST_BACKUP" .next
        pm2 reload all --update-env
        echo -e "${YELLOW}   Rolled back to ${LATEST_BACKUP}${NC}"
    fi
    exit 1
fi

# Step 8: Verify app is running
echo ""
echo "🔍 Step 8: Verifying deployment..."
sleep 3
if pm2 status | grep -q "online"; then
    echo -e "${GREEN}   App is running!${NC}"
else
    echo -e "${RED}❌ App may not be running correctly!${NC}"
    echo "   Check: pm2 logs"
    exit 1
fi

# Done
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# List available backups
BACKUP_LIST=$(ls -dt .next-backup-* 2>/dev/null | head -3)

echo ""
echo "=================================="
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo "   Duration: ${DURATION}s"
echo "   Compile:  ${COMPILE_TIME}"
echo ""
echo "Available backups (rollback targets):"
for backup in $BACKUP_LIST; do
    echo "   - $backup"
done
echo ""
echo "Commands:"
echo "   View logs:  pm2 logs"
echo "   Rollback:   rm -rf .next && mv .next-backup-TIMESTAMP .next && pm2 restart all"
