#!/bin/bash
# ============================================================================
# botblock-watcher.sh
#
# Fast-loop service that watches /tmp/botblock-pending for newly blocked IPs
# and immediately adds iptables DROP rules. Runs every 5 seconds.
#
# This gives near-instant firewall blocking instead of waiting for the
# 5-minute sync-blocked-ips.sh cron job.
#
# Usage:
#   sudo bash /root/indiecrowdfund_2.0/scripts/botblock-watcher.sh
#
# Or install as a systemd service (recommended):
#   sudo cp /root/indiecrowdfund_2.0/scripts/botblock-watcher.service /etc/systemd/system/
#   sudo systemctl enable --now botblock-watcher
# ============================================================================

set -uo pipefail

CHAIN="BOTBLOCK"
PENDING_FILE="/tmp/botblock-pending"
LOG_PREFIX="[BotBlock-Watcher]"
INTERVAL=5  # seconds between checks

log() {
  echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') $LOG_PREFIX $*"
}

# Ensure we're running as root
if [ "$(id -u)" -ne 0 ]; then
  echo "$LOG_PREFIX Error: must run as root" >&2
  exit 1
fi

# Ensure the BOTBLOCK chain exists
if ! iptables -n -L "$CHAIN" >/dev/null 2>&1; then
  log "Creating chain $CHAIN"
  iptables -N "$CHAIN"
fi

# Ensure INPUT jumps to our chain
if ! iptables -C INPUT -j "$CHAIN" 2>/dev/null; then
  log "Adding jump from INPUT to $CHAIN"
  iptables -I INPUT -j "$CHAIN"
fi

# ---- On startup, restore all blocked IPs from database into iptables ----
# This ensures blocked IPs persist across system reboots and PM2 restarts
DB_HOST="localhost"
DB_USER="indieuser"
DB_PASS="01JSN9vhvVTiMEU7odCpF6L3"
DB_NAME="indiecrowdfund"

log "Restoring blocked IPs from database on startup..."
RESTORE_IPS=$(PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -A -c \
  "SELECT \"ipAddress\" FROM \"BlockedIP\" WHERE \"expiresAt\" > NOW();" 2>/dev/null) || {
  log "Warning: failed to query database for startup restore"
  RESTORE_IPS=""
}

restored=0
while IFS= read -r ip; do
  [ -z "$ip" ] && continue
  if [[ ! "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    continue
  fi
  # Skip if rule already exists
  if iptables -C "$CHAIN" -s "$ip/32" -j DROP 2>/dev/null; then
    continue
  fi
  iptables -A "$CHAIN" -s "$ip/32" -j DROP
  ((restored++))
done <<< "$RESTORE_IPS"

if [ "$restored" -gt 0 ]; then
  log "Restored $restored blocked IPs from database"
else
  log "No blocked IPs to restore (or already in iptables)"
fi

log "Watcher started — monitoring $PENDING_FILE every ${INTERVAL}s"

while true; do
  # Check if pending file exists and has content
  if [ -s "$PENDING_FILE" ]; then
    # Atomically move the file so we don't lose writes that happen during processing
    WORK_FILE="/tmp/botblock-processing.$$"
    mv "$PENDING_FILE" "$WORK_FILE" 2>/dev/null || { sleep "$INTERVAL"; continue; }

    # De-duplicate and process each IP
    sort -u "$WORK_FILE" | while IFS= read -r ip; do
      [ -z "$ip" ] && continue

      # Validate IP format
      if [[ ! "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        log "SKIP invalid IP: $ip"
        continue
      fi

      # Check if rule already exists
      if iptables -C "$CHAIN" -s "$ip/32" -j DROP 2>/dev/null; then
        continue  # Already blocked
      fi

      # Add the DROP rule
      iptables -A "$CHAIN" -s "$ip/32" -j DROP
      log "BLOCKED $ip (instant)"
    done

    rm -f "$WORK_FILE"
  fi

  sleep "$INTERVAL"
done
