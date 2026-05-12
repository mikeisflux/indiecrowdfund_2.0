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

# Step 4b: Route-tree pre-flight check.
# Catches the slug-collision class of error before deploy. Next.js's
# route registration runs at server startup, not at build time, which
# means a build can succeed and still produce code that crash-loops
# on boot. We do the same sibling-slug-name check Next does, ahead of
# build, so the deploy aborts loudly instead of swapping a broken .next.
echo ""
echo "🛣️  Step 4b: Validating route tree..."
ROUTE_VALIDATION=$(node -e '
const fs = require("fs");
const path = require("path");
const issues = [];
function walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  const slugDirs = entries.filter(e =>
    e.isDirectory() && /^\[.+\]$/.test(e.name) && !e.name.startsWith("[...")
  );
  if (slugDirs.length > 1) {
    issues.push(dir + ": conflicting slug names " + slugDirs.map(s => s.name).join(", "));
  }
  for (const e of entries) {
    if (e.isDirectory()) walk(path.join(dir, e.name));
  }
}
walk("src/app");
if (issues.length) {
  console.error("ROUTE TREE INVALID:");
  for (const i of issues) console.error("  " + i);
  process.exit(1);
}
console.log("ok");
' 2>&1)
ROUTE_VALIDATION_EXIT=$?
if [ $ROUTE_VALIDATION_EXIT -eq 0 ]; then
    echo -e "${GREEN}   Route tree OK${NC}"
else
    echo -e "${RED}❌ ERROR: Route tree validation failed!${NC}"
    echo "$ROUTE_VALIDATION"
    echo ""
    echo "Sibling [slug] directories must use the same parameter name."
    echo "Fix the listed paths and re-run."
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

# Step 7: Rolling restart per worker (full kill + respawn, but staggered)
# `pm2 reload all` does a graceful SIGUSR2 reload that keeps the Node
# worker process alive — but Next.js route handlers can stay cached in
# memory across the signal, so newly-deployed code in /api routes
# silently keeps running the older version. `pm2 restart all` would
# fully kill and respawn every worker, guaranteeing fresh code is
# loaded, but it tears them all down at once → ~5s of full downtime.
#
# This loop walks each cluster instance, hard-restarts it, and waits
# 5s before moving to the next. While one worker is restarting the
# others keep serving traffic, so the cluster stays online with at
# most 1/N capacity loss for a few seconds per worker.
echo ""
echo "🔄 Step 7: Rolling restart (one PM2 worker at a time, 5s between)..."
INSTANCE_IDS=$(pm2 jlist 2>/dev/null | node -e '
let raw = "";
process.stdin.on("data", c => raw += c);
process.stdin.on("end", () => {
  try {
    const apps = JSON.parse(raw);
    process.stdout.write(apps.map(a => a.pm_id).join(" "));
  } catch { process.stdout.write(""); }
}')

if [ -z "$INSTANCE_IDS" ]; then
    echo -e "${YELLOW}   No PM2 instances found — falling back to pm2 restart all${NC}"
    pm2 restart all --update-env 2>&1 || true
else
    RESTART_FAILED=0
    for pm_id in $INSTANCE_IDS; do
        echo "   Restarting instance $pm_id..."
        if pm2 restart "$pm_id" --update-env 2>&1; then
            echo -e "${GREEN}   Instance $pm_id back online${NC}"
            sleep 5
        else
            echo -e "${RED}   Instance $pm_id failed to restart${NC}"
            RESTART_FAILED=1
            break
        fi
    done

    if [ $RESTART_FAILED -eq 1 ]; then
        echo -e "${RED}❌ ERROR: Rolling restart failed mid-way!${NC}"
        echo "   Attempting rollback..."
        LATEST_BACKUP=$(ls -dt .next-backup-* 2>/dev/null | head -1)
        if [ -n "$LATEST_BACKUP" ]; then
            rm -rf .next
            mv "$LATEST_BACKUP" .next
            pm2 restart all --update-env
            echo -e "${YELLOW}   Rolled back to ${LATEST_BACKUP}${NC}"
        fi
        exit 1
    fi
    echo -e "${GREEN}   All workers restarted with new build${NC}"
fi

# Step 8: Post-deploy health check.
# `pm2 reload` returns success even if every worker crashes 1 second
# later. We give the cluster 15 seconds to settle, then read PM2's
# JSON state to detect restart-looping workers. If any worker has
# accumulated unstable_restarts > 2 in this window, roll back to the
# previous build. Catches runtime errors that slipped past type-check
# + route validation (missing dep, schema mismatch, etc).
echo ""
echo "🔍 Step 8: Verifying deployment (15s settle)..."
sleep 15

PM2_STATE=$(pm2 jlist 2>/dev/null)
if [ -z "$PM2_STATE" ]; then
    echo -e "${RED}❌ Could not read PM2 state${NC}"
    exit 1
fi

UNSTABLE_COUNT=$(echo "$PM2_STATE" | node -e '
let raw = "";
process.stdin.on("data", c => raw += c);
process.stdin.on("end", () => {
  try {
    const apps = JSON.parse(raw);
    let unstable = 0;
    for (const app of apps) {
      const env = app.pm2_env || {};
      // unstable_restarts counts crashes within the min_uptime window.
      // > 2 in 15s after a deploy means the new build is crash-looping.
      if ((env.unstable_restarts || 0) > 2 || env.status === "errored") {
        unstable++;
      }
    }
    process.stdout.write(String(unstable));
  } catch { process.stdout.write("ERR"); }
});
')

if [ "$UNSTABLE_COUNT" = "0" ]; then
    ONLINE_COUNT=$(echo "$PM2_STATE" | node -e '
let raw = ""; process.stdin.on("data", c => raw += c); process.stdin.on("end", () => {
  try { const apps = JSON.parse(raw); let n=0; for (const a of apps) if (a.pm2_env && a.pm2_env.status === "online") n++; process.stdout.write(String(n)); }
  catch { process.stdout.write("ERR"); }
});
')
    echo -e "${GREEN}   Deployment healthy: ${ONLINE_COUNT} worker(s) online, no restart loops${NC}"
elif [ "$UNSTABLE_COUNT" = "ERR" ]; then
    echo -e "${YELLOW}⚠️  Could not parse PM2 state — proceeding without rollback check${NC}"
else
    echo -e "${RED}❌ ${UNSTABLE_COUNT} worker(s) restart-looping — rolling back!${NC}"
    LATEST_BACKUP=$(ls -dt .next-backup-* 2>/dev/null | head -1)
    if [ -n "$LATEST_BACKUP" ]; then
        rm -rf .next
        mv "$LATEST_BACKUP" .next
        pm2 restart all --update-env
        echo -e "${YELLOW}   Rolled back to ${LATEST_BACKUP}${NC}"
        echo "   New build crashed on startup. Check logs:"
        echo "   tail -100 /var/log/pm2/indiecrowdfund-error-*.log"
    else
        echo -e "${RED}   No backup available to roll back to!${NC}"
    fi
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
