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
#
# This script git-pulls itself here. If that pull updates build-and-swap.sh,
# bash keeps executing the stale in-memory copy — it reads the script by
# byte offset, so a changed file mid-run runs old or corrupted content.
# (That's exactly why a fixed Step 7 still ran broken until the *next*
# deploy.) After the pull we hash-compare this script and re-exec the
# fresh copy if it changed. BUILD_SWAP_REEXECED guards the second pass so
# it doesn't re-prompt or re-pull.
if [ "${BUILD_SWAP_REEXECED:-}" = "1" ]; then
    echo ""
    echo "📥 Step 1: Pull latest changes... (already pulled — now on the updated build-and-swap.sh)"
else
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

    SELF_PATH="$REPO_DIR/$(basename "$0")"
    SELF_HASH_BEFORE=$(md5sum "$SELF_PATH" 2>/dev/null | cut -d' ' -f1)

    if git fetch origin "$PULL_BRANCH" 2>&1 && git pull origin "$PULL_BRANCH" 2>&1; then
        echo -e "${GREEN}   Git pull successful${NC}"
    else
        echo -e "${YELLOW}   Could not pull (continuing with local code)${NC}"
    fi

    # If the pull changed this script, hand off to the updated copy so the
    # rest of the deploy runs current code rather than the stale in-memory
    # version. exec replaces the process, so there's no loop — the new run
    # sets BUILD_SWAP_REEXECED and skips straight past this block.
    SELF_HASH_AFTER=$(md5sum "$SELF_PATH" 2>/dev/null | cut -d' ' -f1)
    if [ -n "$SELF_HASH_AFTER" ] && [ "$SELF_HASH_BEFORE" != "$SELF_HASH_AFTER" ]; then
        echo -e "${YELLOW}   build-and-swap.sh changed in that pull — re-executing the updated version...${NC}"
        export BUILD_SWAP_REEXECED=1
        exec bash "$SELF_PATH" "$@"
    fi
fi

# Step 2: Install dependencies
#
# Uses `npm ci` (not `npm install`):
#   - Installs strictly from package-lock.json's resolved tarball
#     URLs + integrity hashes — never re-resolves version ranges
#     against registry metadata, so a stale npm metadata cache on
#     the deploy box can't break the install (this is exactly what
#     caused the uuid@13.0.2 ETARGET failure with the old
#     `npm install --prefer-offline`).
#   - Never writes to package-lock.json, so the next deploy's
#     `git pull` can't hit a "local changes would be overwritten"
#     conflict on the lockfile.
#   - Wipes node_modules first, guaranteeing the deployed tree
#     exactly matches the committed lockfile.
echo ""
echo "📦 Step 2: Installing dependencies..."
# Skip the (~20s) npm ci when nothing about the dependency set changed.
# We stamp node_modules with the package-lock.json hash after each install;
# if node_modules is present and that stamp still matches, the tree already
# matches the committed lockfile and reinstalling is pure wasted time. Any
# lockfile change (via the git pull above) flips the hash and forces a real
# npm ci. The stamp lives inside node_modules, so if the tree is wiped the
# stamp goes with it and we reinstall. Prisma client is regenerated
# unconditionally in Step 3, so skipping npm ci's postinstall is fine.
LOCK_STAMP="node_modules/.deploy-lock-hash"
LOCK_HASH=$(md5sum package-lock.json 2>/dev/null | cut -d' ' -f1)
if [ -d node_modules ] && [ -f "$LOCK_STAMP" ] && [ -n "$LOCK_HASH" ] && [ "$(cat "$LOCK_STAMP" 2>/dev/null)" = "$LOCK_HASH" ]; then
    echo -e "${GREEN}   Dependencies unchanged (package-lock.json matches) — skipping npm ci${NC}"
elif npm ci 2>&1; then
    echo "$LOCK_HASH" > "$LOCK_STAMP" 2>/dev/null || true
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

# Step 4c: Prisma query pre-flight.
# Same class of problem as Step 4b, different mechanism. An invalid field in
# a Prisma select/where type-checks clean — a probe of
#   db.user.findFirst({ select: { totallyBogusFieldXyz: true } })
# passes tsconfig.build.json — so the build succeeds and the route then throws
# PrismaClientValidationError on every request. That is how the IndieKit
# Integrations panel and the admin Insert-campaign menu both shipped broken.
# This checks field names against the generated client's schema before deploy.
# Only NEW problems fail; the pre-existing ones live in
# scripts/prisma-query-baseline.json.
echo ""
echo "🗄️  Step 4c: Validating Prisma queries..."
if node scripts/validate-prisma-queries.cjs; then
    :
else
    PRISMA_CHECK_EXIT=$?
    if [ $PRISMA_CHECK_EXIT -eq 2 ]; then
        echo -e "${YELLOW}   Could not run the Prisma query check — continuing${NC}"
    else
        echo -e "${RED}❌ ERROR: Invalid Prisma field(s) found!${NC}"
        echo ""
        echo "These pass the type checker but fail at runtime on every request."
        echo "Fix them, or re-baseline with:"
        echo "   node scripts/validate-prisma-queries.cjs --update-baseline"
        exit 1
    fi
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

# Step 5b: Seed the new build's cache from the current live build so the
# webpack build is INCREMENTAL, not cold. next build writes/reads its
# filesystem cache under <distDir>/cache/webpack; since we build into a
# fresh .next-new, webpack would otherwise start with an empty cache and
# rebuild everything from scratch every deploy (~the whole point of the
# slow builds). Copying the previous cache in first lets webpack reuse it.
#
# We hardlink (cp -al) rather than deep-copy: same filesystem, so it's
# near-instant and adds ~no disk (inodes are shared with the live cache
# until webpack replaces individual pack files via write-temp-then-rename,
# which never mutates the live copy in place). Falls back to a real copy,
# then to a cold build, if hardlinking isn't available.
if [ -d ".next/cache" ]; then
    echo ""
    echo "♻️  Step 5b: Seeding build cache for a faster incremental build..."
    mkdir -p .next-new
    if cp -al .next/cache .next-new/cache 2>/dev/null; then
        echo -e "${GREEN}   Seeded cache via hardlinks (no extra disk)${NC}"
    elif cp -a .next/cache .next-new/cache 2>/dev/null; then
        echo -e "${GREEN}   Seeded cache via copy${NC}"
    else
        rm -rf .next-new/cache 2>/dev/null || true
        echo -e "${YELLOW}   Could not seed cache — this build will be cold (still fine)${NC}"
    fi
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

        # Strip the regenerable cache from the backup. `.next/cache` is
        # dominated by the webpack build cache (.next/cache/webpack/*.pack,
        # ~1.6 GB — the bulk of every backup), plus the smaller on-demand
        # Image Optimizer cache (.next/cache/images). None of it is needed
        # to restore a build: a rollback only needs server/, static/, and
        # the manifests, and the caches rebuild lazily. Drop the whole cache
        # dir from the backup to keep backups small.
        if [ -d ".next-backup-${TIMESTAMP}/cache" ]; then
            CACHE_SIZE=$(du -sh ".next-backup-${TIMESTAMP}/cache" 2>/dev/null | cut -f1)
            rm -rf ".next-backup-${TIMESTAMP}/cache"
            echo "   Pruned regenerable cache from backup (${CACHE_SIZE:-unknown} reclaimed)"
        fi
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

# Step 7: Simultaneous restart of every PM2 worker.
#
# We used to do a rolling restart here (one worker at a time, 5s
# between) for zero-downtime. The problem: between the .next swap in
# Step 6b and a given worker actually being restarted, that worker is
# running the OLD compiled code with the OLD chunk-ID-to-content
# manifest, but reading from the NEW .next/ directory on disk. The new
# build's chunk IDs differ from the old one's, so any require() lookup
# of an old chunk ID returns undefined from the new manifest →
# "TypeError: Cannot read properties of undefined (reading 'call')" at
# webpack-runtime.js (Next.js suppresses the missing-module path and
# only logs the bare TypeError + an error digest). The rolling-window
# duration (5s × N workers) was the entire exposure window.
#
# A simultaneous restart eliminates that window: every worker tears
# down and respawns reading the new .next/ at roughly the same time.
# Cost is a brief full-cluster outage (~3–5s while workers boot), which
# is shorter than the rolling window's total degraded-service period
# and won't leak chunk-mismatch 500s to backers. PM2 itself drains
# in-flight connections before SIGKILL, and Step 8's health check +
# auto-rollback still catches any crash-loop on the new build.
#
# We use `pm2 delete` + `pm2 start ecosystem.config.js` instead of
# `pm2 restart all`. `pm2 restart` only restarts the existing process
# list from PM2's saved dump -- it ignores any changes to instances /
# memory limits / env in ecosystem.config.js. So bumping workers 4 → 8
# in the config file silently had no effect until we delete + start
# fresh. `pm2 save` after persists the new dump so the next reboot
# brings up the right worker count.
echo ""
echo "🔄 Step 7: Restarting all PM2 workers (brief full restart)..."
if pm2 delete indiecrowdfund 2>/dev/null; pm2 start ecosystem.config.js --update-env 2>&1; then
    pm2 save 2>&1 | head -5
    echo -e "${GREEN}   All workers restarted with new build${NC}"
else
    echo -e "${RED}❌ ERROR: pm2 restart failed!${NC}"
    echo "   Attempting rollback..."
    LATEST_BACKUP=$(ls -dt .next-backup-* 2>/dev/null | head -1)
    if [ -n "$LATEST_BACKUP" ]; then
        rm -rf .next
        mv "$LATEST_BACKUP" .next
        pm2 delete indiecrowdfund 2>/dev/null
        pm2 start ecosystem.config.js --update-env
        pm2 save
        echo -e "${YELLOW}   Rolled back to ${LATEST_BACKUP}${NC}"
    fi
    exit 1
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
        pm2 delete indiecrowdfund 2>/dev/null
        pm2 start ecosystem.config.js --update-env
        pm2 save
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
echo "   Rollback:   rm -rf .next && cp -r .next-backup-TIMESTAMP .next && \\"
echo "               pm2 delete indiecrowdfund && pm2 start ecosystem.config.js && pm2 save"
