#!/bin/bash
# Cleanup stale PENDING pledges (abandoned checkouts)
# Run this via cron every 2 days
#
# Crontab entry (runs at 3 AM every 2 days):
# 0 3 */2 * * /root/indiecrowdfund_2.0/scripts/cleanup-stale-pledges.sh >> /var/log/pledge-cleanup.log 2>&1

LOG_PREFIX="[$(date '+%Y-%m-%d %H:%M:%S')] Pledge Cleanup:"

echo "$LOG_PREFIX Starting stale pledge cleanup..."

# Configuration
API_URL="${API_URL:-http://localhost:3000}"
HOURS_OLD="${HOURS_OLD:-48}"  # Default to 48 hours
ADMIN_API_KEY="${ADMIN_API_KEY:-}"

# Make the cleanup request
# Using internal endpoint that doesn't require auth for cron jobs
RESPONSE=$(curl -s -X POST "$API_URL/api/cron/cleanup-pledges" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -d "{\"hoursOld\": $HOURS_OLD, \"dryRun\": false}")

# Check if successful
if echo "$RESPONSE" | grep -q '"success":true'; then
  COUNT=$(echo "$RESPONSE" | grep -o '"count":[0-9]*' | cut -d: -f2)
  echo "$LOG_PREFIX Successfully cleaned up $COUNT stale pledges"
else
  echo "$LOG_PREFIX ERROR: Cleanup failed"
  echo "$LOG_PREFIX Response: $RESPONSE"
  exit 1
fi

echo "$LOG_PREFIX Cleanup complete"
