#!/bin/bash
# Reverse of setup-diagnostics.sh. Run once the box is stable and the
# persistent forensics (installed to hunt the random restarts) are no
# longer needed. Turns the logging OFF and vacuums up what it accumulated.
#
# What it undoes:
#   - 5-min snapshot cron  -> removes cron + script + logrotate + all snapshots
#   - Postgres slow-query log -> reverts postgresql.conf, reloads PG
#   - persistent journald  -> reverts to default + shrinks the journal
#
# What it deliberately LEAVES ALONE:
#   - ic-watchdog (health-probe auto-restart). That's a safety net, not
#     logging. Remove it separately with: systemctl disable --now ic-watchdog.timer
#
# Safe to re-run. Best-effort: individual steps that are already undone
# just no-op.
set -uo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root (sudo)." >&2
  exit 1
fi

echo "[1/3] Removing the 5-min snapshot cron + its data..."
rm -f /etc/cron.d/ic-snapshot
rm -f /usr/local/bin/ic-snapshot.sh
rm -f /etc/logrotate.d/ic-snapshots
# The accumulated snapshots — "vacuum all that up".
snap_bytes=$(du -sh /var/log/ic-snapshots 2>/dev/null | cut -f1 || echo "0")
rm -rf /var/log/ic-snapshots
echo "    removed snapshot cron + ${snap_bytes} of snapshots"

echo "[2/3] Reverting Postgres slow-query logging..."
PG_CONF=$(sudo -u postgres psql -At -c "SHOW config_file" 2>/dev/null || echo "")
if [ -n "$PG_CONF" ] && [ -f "$PG_CONF" ]; then
  # Remove exactly the lines setup-diagnostics.sh appended.
  sed -i '/^# Added by ic setup-diagnostics.sh/d' "$PG_CONF"
  sed -i '/^log_min_duration_statement/d' "$PG_CONF"
  sed -i '/^log_lock_waits/d' "$PG_CONF"
  # Drop the one-time backup the setup script made, if present.
  rm -f "$PG_CONF.before-ic-diag"
  systemctl reload postgresql 2>/dev/null || systemctl reload postgresql@16-main 2>/dev/null || true
  echo "    reverted slow-query logging in $PG_CONF and reloaded PG"
else
  echo "    SKIPPED -- couldn't locate postgresql.conf"
fi

echo "[3/3] Reverting persistent journald + shrinking the journal..."
rm -f /etc/systemd/journald.conf.d/persistent.conf
# If the drop-in dir is now empty, remove it too (tidy).
rmdir /etc/systemd/journald.conf.d 2>/dev/null || true
systemctl restart systemd-journald 2>/dev/null || true
# Reclaim disk: keep only the last day, hard-cap at 100M.
journalctl --rotate 2>/dev/null || true
journalctl --vacuum-time=1d 2>/dev/null || true
journalctl --vacuum-size=100M 2>/dev/null || true
echo "    journald reverted and vacuumed"

echo
echo "Done. Persistent forensics logging is OFF and its data is cleaned up."
echo "Note: ic-watchdog was left running. To remove it as well:"
echo "  systemctl disable --now ic-watchdog.timer && rm -f /usr/local/bin/ic-watchdog.sh"
