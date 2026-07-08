#!/bin/bash
# ============================================================================
# sync-blocked-ips.sh
#
# Reads blocked bot IPs from the BlockedIP database table and adds iptables
# DROP rules so packets are dropped at the kernel level before reaching
# Node.js/PM2. Expired blocks are removed from iptables automatically.
#
# Usage:
#   sudo bash /root/indiecrowdfund_2.0/scripts/sync-blocked-ips.sh
#
# Cron (every 5 minutes):
#   */5 * * * * /root/indiecrowdfund_2.0/scripts/sync-blocked-ips.sh >> /var/log/botblock.log 2>&1
# ============================================================================

set -euo pipefail

CHAIN="BOTBLOCK"
DB_HOST="${DB_HOST:-localhost}"
DB_USER="${DB_USER:-indieuser}"
DB_PASS="${DB_PASS:?DB_PASS environment variable is required}"
DB_NAME="${DB_NAME:-indiecrowdfund}"
LOG_PREFIX="[BotBlock]"

log() {
  echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') $LOG_PREFIX $*"
}

# Ensure we're running as root (needed for iptables)
if [ "$(id -u)" -ne 0 ]; then
  echo "$LOG_PREFIX Error: must run as root" >&2
  exit 1
fi

# ---- 1. Ensure the BOTBLOCK chain exists and is hooked into INPUT ----

if ! iptables -n -L "$CHAIN" >/dev/null 2>&1; then
  log "Creating chain $CHAIN"
  iptables -N "$CHAIN"
fi

# Make sure INPUT jumps to our chain (check before adding to avoid duplicates)
if ! iptables -C INPUT -j "$CHAIN" 2>/dev/null; then
  log "Adding jump from INPUT to $CHAIN"
  iptables -I INPUT -j "$CHAIN"
fi

# ---- 2. Get currently blocked IPs from the database ----

DB_IPS=$(PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -A -c \
  "SELECT \"ipAddress\" FROM \"BlockedIP\" WHERE \"expiresAt\" > NOW();" 2>/dev/null) || {
  log "Error: failed to query database"
  exit 1
}

# Build a set of IPs that should be blocked
declare -A DB_IP_SET
while IFS= read -r ip; do
  [ -z "$ip" ] && continue
  # Basic validation: skip anything that doesn't look like an IP
  if [[ "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    DB_IP_SET["$ip"]=1
  fi
done <<< "$DB_IPS"

# ---- 3. Get IPs currently in the BOTBLOCK chain ----

declare -A FW_IP_SET
while IFS= read -r line; do
  # iptables -S output looks like: -A BOTBLOCK -s 1.2.3.4/32 -j DROP
  ip=$(echo "$line" | grep -oP '(?<=-s )[0-9.]+(?=/32)' 2>/dev/null) || continue
  [ -z "$ip" ] && continue
  FW_IP_SET["$ip"]=1
done < <(iptables -S "$CHAIN" 2>/dev/null)

# ---- 4. Add new blocks ----

added=0
for ip in "${!DB_IP_SET[@]}"; do
  if [ -z "${FW_IP_SET[$ip]+x}" ]; then
    iptables -A "$CHAIN" -s "$ip/32" -j DROP
    log "ADDED $ip"
    ((added++))
  fi
done

# ---- 5. Remove expired blocks (in iptables but no longer in DB) ----

removed=0
for ip in "${!FW_IP_SET[@]}"; do
  if [ -z "${DB_IP_SET[$ip]+x}" ]; then
    iptables -D "$CHAIN" -s "$ip/32" -j DROP 2>/dev/null || true
    log "REMOVED $ip (expired)"
    ((removed++))
  fi
done

# ---- 6. Clean up expired rows from the database ----

PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c \
  "DELETE FROM \"BlockedIP\" WHERE \"expiresAt\" < NOW() - INTERVAL '7 days';" >/dev/null 2>&1 || true

# ---- 7. Summary ----

total=${#DB_IP_SET[@]}
if [ "$added" -gt 0 ] || [ "$removed" -gt 0 ]; then
  log "Sync complete: $total active blocks, +$added added, -$removed removed"
elif [ "$total" -gt 0 ]; then
  log "Sync complete: $total active blocks (no changes)"
fi
# Silent when there are zero blocks and no changes (keeps cron logs clean)
