#!/bin/bash

# Quick build and swap script
# Backs up current build, builds new one, restarts PM2 on success
# If build fails, reports errors and keeps the old build running

REPO_DIR="/home/user/indiecrowdfund_2.0"
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
echo "📥 Step 1: Pulling latest changes..."
if git pull origin main 2>&1; then
    echo -e "${GREEN}   Git pull successful${NC}"
elif git pull origin $(git branch --show-current) 2>&1; then
    echo -e "${GREEN}   Git pull successful${NC}"
else
    echo -e "${YELLOW}   Skipping git pull (may be on feature branch)${NC}"
fi

# Step 2: Install dependencies
echo ""
echo "📦 Step 2: Installing dependencies..."
if npm ci --prefer-offline 2>&1; then
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
if npx tsc --noEmit 2>&1; then
    echo -e "${GREEN}   Type check passed${NC}"
else
    echo -e "${RED}❌ ERROR: TypeScript errors found!${NC}"
    echo ""
    echo "Run 'npx tsc --noEmit' to see details"
    exit 1
fi

# Step 5: Backup current build
echo ""
echo "💾 Step 5: Backing up current build..."
rm -rf .next-backup
if [ -d ".next" ]; then
    cp -r .next .next-backup
    echo -e "${GREEN}   Backup saved to .next-backup${NC}"
else
    echo -e "${YELLOW}   No existing build to backup${NC}"
fi

# Step 6: Build new version
echo ""
echo "🔨 Step 6: Building new version..."
BUILD_OUTPUT=$(npm run build 2>&1)
BUILD_EXIT_CODE=$?

if [ $BUILD_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ Build successful!${NC}"
else
    echo -e "${RED}❌ BUILD FAILED!${NC}"
    echo ""
    echo "========== BUILD ERRORS =========="
    echo "$BUILD_OUTPUT" | tail -50
    echo "=================================="
    echo ""

    # Restore backup
    if [ -d ".next-backup" ]; then
        echo "🔄 Restoring backup..."
        rm -rf .next
        mv .next-backup .next
        echo -e "${GREEN}   Backup restored. Site is still running.${NC}"
    fi
    exit 1
fi

# Step 7: Restart PM2
echo ""
echo "🔄 Step 7: Restarting PM2..."
if pm2 restart all --update-env 2>&1; then
    echo -e "${GREEN}   PM2 restarted${NC}"
else
    echo -e "${RED}❌ ERROR: PM2 restart failed!${NC}"
    echo "   Attempting rollback..."
    if [ -d ".next-backup" ]; then
        rm -rf .next
        mv .next-backup .next
        pm2 restart all --update-env
        echo -e "${YELLOW}   Rolled back to previous build${NC}"
    fi
    exit 1
fi

# Step 8: Verify app is running
echo ""
echo "🔍 Step 8: Verifying deployment..."
sleep 3
if pm2 status | grep -q "online"; then
    echo -e "${GREEN}   App is running!${NC}"
    rm -rf .next-backup
else
    echo -e "${RED}❌ App may not be running correctly!${NC}"
    echo "   Check: pm2 logs"
    echo "   Keeping backup for potential rollback"
    exit 1
fi

# Done
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "=================================="
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo "   Duration: ${DURATION}s"
echo ""
echo "Commands:"
echo "   View logs:  pm2 logs"
echo "   Rollback:   mv .next-backup .next && pm2 restart all"
