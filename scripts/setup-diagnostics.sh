#!/bin/bash
# One-shot setup for persistent forensics on this box.
#
# After running this:
#   - systemd journals survive reboot (live under /var/log/journal/)
#   - A snapshot cron writes pm2 + DB + socket state to disk every 5 min
#   - 30 days of snapshots retained, rolling
#   - Slow Postgres queries (>1s) get logged
#
# Designed to be safely re-runnable.
set -euo pipefail

echo "[1/4] Enabling persistent journalctl..."
mkdir -p /var/log/journal
systemd-tmpfiles --create --prefix /var/log/journal
# Cap journal disk usage so it doesn't run away
mkdir -p /etc/systemd/journald.conf.d
cat > /etc/systemd/journald.conf.d/persistent.conf <<'CONF'
[Journal]
Storage=persistent
SystemMaxUse=2G
SystemKeepFree=1G
MaxRetentionSec=2day
CONF
systemctl restart systemd-journald
echo "    ok"

echo "[2/4] Installing 5-min snapshot cron..."
mkdir -p /var/log/ic-snapshots
cat > /usr/local/bin/ic-snapshot.sh <<'SNAP'
#!/bin/bash
# Captures runtime state every 5 minutes. Rotated by logrotate.
# Designed to be lightweight enough to run forever -- no expensive
# queries, no syscalls that touch disk-heavy state.
ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
out=/var/log/ic-snapshots/$(date -u +%Y-%m-%d).log
{
  echo "=== $ts ==="
  echo "--- pm2 list ---"
  pm2 jlist 2>/dev/null | head -c 8192 || echo "(pm2 unavailable)"
  echo
  echo "--- memory ---"
  free -m
  echo "--- load ---"
  uptime
  echo "--- sockets summary ---"
  ss -s 2>/dev/null
  echo "--- pg connection states ---"
  PGPASSWORD='AH2hqkufqtrp9BmdRkAsdU83N9fW4Q6w' psql -h localhost -U indieuser -d indiecrowdfund -At -c \
    "SELECT state, COUNT(*) FROM pg_stat_activity GROUP BY state ORDER BY 2 DESC" 2>/dev/null \
    || echo "(pg unavailable)"
  echo "--- pg slow / waiting queries ---"
  PGPASSWORD='AH2hqkufqtrp9BmdRkAsdU83N9fW4Q6w' psql -h localhost -U indieuser -d indiecrowdfund -At -c \
    "SELECT pid, state, wait_event_type, wait_event, query_start, LEFT(query,120) FROM pg_stat_activity WHERE state != 'idle' AND query_start < NOW() - INTERVAL '5 seconds' ORDER BY query_start" 2>/dev/null \
    || true
  # Per-worker fd counts: catches fd leaks before they hit ulimit
  echo "--- pm2 worker fd counts ---"
  for pid in $(pm2 jlist 2>/dev/null | grep -oP '"pid":\K[0-9]+' | sort -u); do
    if [ -d /proc/$pid/fd ]; then
      count=$(ls /proc/$pid/fd 2>/dev/null | wc -l)
      echo "pid=$pid fds=$count"
    fi
  done
  echo
} >> "$out" 2>&1
SNAP
chmod +x /usr/local/bin/ic-snapshot.sh

cat > /etc/cron.d/ic-snapshot <<'CRON'
*/5 * * * * root /usr/local/bin/ic-snapshot.sh
CRON

cat > /etc/logrotate.d/ic-snapshots <<'ROT'
/var/log/ic-snapshots/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
}
ROT
echo "    ok"

echo "[3/4] Enabling Postgres slow-query log (>1s)..."
PG_CONF=$(sudo -u postgres psql -At -c "SHOW config_file" 2>/dev/null || echo "/etc/postgresql/16/main/postgresql.conf")
if [ -f "$PG_CONF" ]; then
  # Backup once
  if [ ! -f "$PG_CONF.before-ic-diag" ]; then
    cp "$PG_CONF" "$PG_CONF.before-ic-diag"
  fi
  # Idempotent: replace any existing log_min_duration_statement
  sed -i '/^log_min_duration_statement/d' "$PG_CONF"
  sed -i '/^log_lock_waits/d' "$PG_CONF"
  cat >> "$PG_CONF" <<'PGCONF'
# Added by ic setup-diagnostics.sh
log_min_duration_statement = 1000      # log every query slower than 1s
log_lock_waits = on                    # log waits longer than deadlock_timeout
PGCONF
  systemctl reload postgresql
  echo "    ok (slow queries >1s now logged to /var/log/postgresql/)"
else
  echo "    SKIPPED -- couldn't locate postgresql.conf"
fi

echo "[4/4] Verifying setup..."
echo
echo "Persistent journal location:"
ls -la /var/log/journal/ | head -3
echo
echo "Snapshot cron entry:"
cat /etc/cron.d/ic-snapshot
echo
echo "Try a snapshot manually to confirm it writes:"
echo "  /usr/local/bin/ic-snapshot.sh && tail -50 /var/log/ic-snapshots/\$(date -u +%Y-%m-%d).log"
echo
echo "Done. Next time the site seizes:"
echo "  - /var/log/ic-snapshots/  has 5-minute snapshots leading up to the moment"
echo "  - journalctl -b -1 -p warning  shows pre-reboot kernel/service events"
echo "  - /var/log/postgresql/postgresql-16-main.log  shows slow queries"
