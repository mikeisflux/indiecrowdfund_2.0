#!/bin/bash
# Installs the on-box liveness watchdog that auto-restarts the cluster when
# /api/health/live stops responding. Pairs with scripts/ic-watchdog.sh.
#
# What this gives you:
#   - 30s probe interval, ~90s detection latency
#   - Graceful pm2 reload at 3 failures, escalates to pm2-root restart at 6,
#     reboot at 9. Cooldown caps actions at 3 per 10min so a real bug can't
#     thrash the box.
#   - All decisions logged to journalctl: `journalctl -t ic-watchdog -f`
#
# Run as root on the production box. Safe to re-run -- it idempotently
# overwrites the script and timer unit.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo bash $0"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC_WATCHDOG="$SCRIPT_DIR/ic-watchdog.sh"

if [ ! -f "$SRC_WATCHDOG" ]; then
  echo "ERROR: $SRC_WATCHDOG missing. Run from the repo with scripts/ on disk."
  exit 1
fi

echo "[1/4] Installing watchdog script to /usr/local/bin/..."
install -m 0755 "$SRC_WATCHDOG" /usr/local/bin/ic-watchdog.sh

# The first watchdog release ran pm2 without HOME/PM2_HOME set, so pm2
# spawned a stray daemon at /etc/.pm2 (and "reloaded" its empty process
# list instead of the real cluster). Kill and remove it if present.
if [ -d /etc/.pm2 ]; then
  echo "    Cleaning up stray PM2 daemon at /etc/.pm2 (from pre-fix watchdog)..."
  PM2_HOME=/etc/.pm2 pm2 kill >/dev/null 2>&1 || true
  rm -rf /etc/.pm2
fi

echo "[2/4] Writing systemd service unit..."
cat > /etc/systemd/system/ic-watchdog.service <<'SERVICE'
[Unit]
Description=IndieCrowdfund liveness watchdog (probes /api/health/live)
After=network-online.target pm2-root.service
Wants=network-online.target

[Service]
Type=oneshot
# Without these, pm2 inside the script talks to a freshly-spawned daemon
# at a bogus home (observed /etc/.pm2) instead of the real cluster at
# /root/.pm2, making every reload a silent no-op.
Environment="HOME=/root"
Environment="PM2_HOME=/root/.pm2"
ExecStart=/usr/local/bin/ic-watchdog.sh
SERVICE

echo "[3/4] Writing systemd timer unit..."
cat > /etc/systemd/system/ic-watchdog.timer <<'TIMER'
[Unit]
Description=Run ic-watchdog every 30 seconds

[Timer]
OnBootSec=2min
OnUnitActiveSec=30s
AccuracySec=5s
Unit=ic-watchdog.service

[Install]
WantedBy=timers.target
TIMER

echo "[4/4] Reloading systemd and enabling timer..."
systemctl daemon-reload
systemctl enable --now ic-watchdog.timer

echo
echo "Done. Verify:"
echo "  systemctl status ic-watchdog.timer"
echo "  journalctl -t ic-watchdog -f                 # live decisions"
echo "  curl -fsS http://127.0.0.1:3000/api/health/live  # should return 200"
echo
echo "To disable temporarily:"
echo "  systemctl stop ic-watchdog.timer"
echo "To re-enable:"
echo "  systemctl start ic-watchdog.timer"
