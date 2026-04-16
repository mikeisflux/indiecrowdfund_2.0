#!/bin/bash

# Quick build and swap script
# Builds to .next-new while site stays live, then swaps + restarts PM2
# Scales down PM2 during build to free RAM for Turbopack

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

# Step 6: Scale down PM2 to free RAM for the build
# Turbopack needs ~2-3GB during compilation. With 4 PM2 instances each
# using ~500MB, the server can OOM. Scale to 1 instance during build
# so there's enough headroom, then scale back up after.
echo ""
echo "⚡ Step 6: Scaling down PM2 for build (1 instance keeps site live)..."
pm2 scale indiecrowdfund 1 2>/dev/null || true
echo -e "${GREEN}   PM2 scaled to 1 instance${NC}"

# Step 7: Build new version to separate directory (site stays live on 1 instance)
echo ""
echo "🔨 Step 7: Building new version to .next-new..."
BUILD_OUTPUT=$(NEXT_BUILD_OUTPUT=.next-new npx next build 2>&1)
BUILD_EXIT_CODE=$?

# Extract compile time from build output
COMPILE_TIME=$(echo "$BUILD_OUTPUT" | grep -oP 'Compiled successfully in \K[0-9.]+s' || echo "unknown")

if [ $BUILD_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ Build successful! (compiled in ${COMPILE_TIME})${NC}"

    # Step 8: Atomic swap - backup old, swap in new
    echo ""
    echo "🔄 Step 8: Swapping build directories..."
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)

    if [ -d ".next" ]; then
        # Move old build to backup
        mv .next ".next-backup-${TIMESTAMP}"
        echo "   Backed up old build to .next-backup-${TIMESTAMP}"
    fi

    # Move new build into place
    mv .next-new .next
    echo -e "${GREEN}   New build is now live!${NC}"

    # Keep only the 3 most recent backups, delete older ones
    BACKUP_COUNT=$(ls -dt .next-backup-* 2>/dev/null | wc -l)
    if [ "$BACKUP_COUNT" -gt 3 ]; then
        echo "   Cleaning old backups (keeping last 3)..."
        ls -dt .next-backup-* | tail -n +4 | xargs rm -rf
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

    # Scale PM2 back up before exiting
    echo "   Scaling PM2 back to 4 instances..."
    pm2 scale indiecrowdfund 4 2>/dev/null || true
    exit 1
fi

# Step 9: Scale PM2 back up and reload with new build
echo ""
echo "🔄 Step 9: Reloading PM2 (scaling back to 4 instances)..."
if pm2 scale indiecrowdfund 4 --update-env 2>&1 && pm2 reload all --update-env 2>&1; then
    echo -e "${GREEN}   PM2 reloaded with 4 instances${NC}"
else
    echo -e "${RED}❌ ERROR: PM2 reload failed!${NC}"
    echo "   Attempting rollback..."
    LATEST_BACKUP=$(ls -dt .next-backup-* 2>/dev/null | head -1)
    if [ -n "$LATEST_BACKUP" ]; then
        rm -rf .next
        mv "$LATEST_BACKUP" .next
        pm2 scale indiecrowdfund 4 2>/dev/null || true
        pm2 reload all --update-env
        echo -e "${YELLOW}   Rolled back to ${LATEST_BACKUP}${NC}"
    fi
    exit 1
fi

# Step 10: Verify app is running
echo ""
echo "🔍 Step 10: Verifying deployment..."
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
