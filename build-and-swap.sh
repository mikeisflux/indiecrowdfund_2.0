#!/bin/bash

# Quick build and swap script
# Backs up current build, builds new one, restarts PM2 on success
# If build fails, reports errors and keeps the old build running

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

# Step 5: Clean up any previous failed build attempts
echo ""
echo "🧹 Step 5: Cleaning up previous build attempts..."
if [ -d ".next-new" ]; then
    rm -rf .next-new
    echo -e "${GREEN}   Cleaned up .next-new${NC}"
else
    echo -e "${GREEN}   No cleanup needed${NC}"
fi

# Also clean stale .next/types (only used for TS checking, not runtime)
if [ -d ".next/types" ]; then
    rm -rf .next/types
    echo -e "${GREEN}   Cleaned stale .next/types${NC}"
fi

# Step 6: Build new version to separate directory (zero-downtime)
# NOTE: We call next build directly instead of npm run build because
# npm run build includes "rm -rf .next" which would break the live site
echo ""
echo "🔨 Step 6: Building new version to .next-new (site stays live)..."
BUILD_OUTPUT=$(NEXT_BUILD_OUTPUT=.next-new npx next build --webpack 2>&1)
BUILD_EXIT_CODE=$?

if [ $BUILD_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ Build successful!${NC}"

    # Step 6b: Atomic swap - backup old, swap in new
    echo ""
    echo "🔄 Step 6b: Swapping build directories..."
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)

    if [ -d ".next" ]; then
        # Move old build to backup
        mv .next ".next-backup-${TIMESTAMP}"
        echo "   Backed up old build to .next-backup-${TIMESTAMP}"
    fi

    # Move new build into place
    mv .next-new .next
    echo -e "${GREEN}   New build is now live!${NC}"

    # Keep only the 2 most recent backups, delete older ones
    BACKUP_COUNT=$(ls -dt .next-backup-* 2>/dev/null | wc -l)
    if [ "$BACKUP_COUNT" -gt 2 ]; then
        echo "   Cleaning old backups (keeping last 2)..."
        ls -dt .next-backup-* | tail -n +3 | xargs rm -rf
        echo -e "${GREEN}   Old backups removed${NC}"
    fi
else
    echo -e "${RED}❌ BUILD FAILED!${NC}"
    echo ""
    echo "========== BUILD ERRORS =========="
    echo "$BUILD_OUTPUT" | tail -50
    echo "=================================="
    echo ""
    echo -e "${GREEN}   Site is still running with old build.${NC}"

    # Clean up failed build attempt
    rm -rf .next-new
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
BACKUP_LIST=$(ls -dt .next-backup-* 2>/dev/null | head -2)

echo ""
echo "=================================="
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo "   Duration: ${DURATION}s"
echo ""
echo "Available backups:"
for backup in $BACKUP_LIST; do
    echo "   - $backup"
done
echo ""
echo "Commands:"
echo "   View logs:  pm2 logs"
echo "   Rollback:   cp -r .next-backup-TIMESTAMP .next && pm2 restart all"
