#!/bin/bash
# Probes /api/health/live and auto-restarts the cluster on sustained failure.
# Installed to /usr/local/bin/ic-watchdog.sh by setup-watchdog.sh and
# triggered every 30s by the ic-watchdog.timer systemd unit.
#
# Escalation ladder (consecutive failures at 30s probe interval):
#   3 (90s)   -> pm2 reload all                      (graceful, zero downtime)
#   6 (3min)  -> systemctl restart pm2-root.service  (heavier; kills PM2 daemon)
#   9 (4.5m)  -> systemctl reboot                    (last resort)
#
# Cooldown: at most 3 actions in any 10-min window so a real bug doesn't churn
# the box forever. After cooldown is exhausted, the watchdog stays quiet and
# the admin gets paged (assuming external uptime monitoring on top of this).
#
# Boot grace: does nothing for 2 minutes after boot so PM2 / Node have time to
# come up before we start declaring them dead.
#
# Logs every decision to journalctl via `logger -t ic-watchdog`:
#   journalctl -t ic-watchdog -f
set -u

STATE_DIR=/var/lib/ic-watchdog
FAIL_FILE=$STATE_DIR/failures
ACTIONS_FILE=$STATE_DIR/actions
HEALTH_URL=http://127.0.0.1:3000/api/health/live
PROBE_TIMEOUT=10
BOOT_GRACE=120
COOLDOWN_WINDOW=600
MAX_ACTIONS=3
T_RELOAD=3
T_PM2_RESTART=6
T_REBOOT=9

mkdir -p "$STATE_DIR"
touch "$FAIL_FILE" "$ACTIONS_FILE"

log() { logger -t ic-watchdog -- "$*"; }

# Boot grace -- skip probe entirely
uptime_sec=$(awk '{print int($1)}' /proc/uptime)
if [ "$uptime_sec" -lt "$BOOT_GRACE" ]; then
  exit 0
fi

# Probe. -fsS: fail on HTTP error, silent except errors, follow connections.
if curl -fsS --max-time "$PROBE_TIMEOUT" "$HEALTH_URL" >/dev/null 2>&1; then
  prev=$(cat "$FAIL_FILE" 2>/dev/null || echo 0)
  if [ "${prev:-0}" -gt 0 ]; then
    log "recovered after $prev consecutive failures"
  fi
  echo 0 > "$FAIL_FILE"
  exit 0
fi

# Failure -- bump counter
failures=$(cat "$FAIL_FILE" 2>/dev/null || echo 0)
failures=$((failures + 1))
echo "$failures" > "$FAIL_FILE"
log "health probe failed (consecutive=$failures)"

# Decide highest-applicable action
action=""
if [ "$failures" -ge "$T_REBOOT" ]; then
  action="reboot"
elif [ "$failures" -ge "$T_PM2_RESTART" ]; then
  action="pm2_restart"
elif [ "$failures" -ge "$T_RELOAD" ]; then
  action="reload"
fi
[ -z "$action" ] && exit 0

# Cooldown: prune old actions, count what's left in the window
now=$(date +%s)
cutoff=$((now - COOLDOWN_WINDOW))
awk -v c="$cutoff" '$1 > c' "$ACTIONS_FILE" > "$ACTIONS_FILE.tmp" && mv "$ACTIONS_FILE.tmp" "$ACTIONS_FILE"
recent=$(wc -l < "$ACTIONS_FILE")
if [ "$recent" -ge "$MAX_ACTIONS" ]; then
  log "cooldown active ($recent actions in last $((COOLDOWN_WINDOW / 60))min) -- refusing $action"
  exit 0
fi

case "$action" in
  reload)
    log "action=pm2_reload (failures=$failures)"
    echo "$now" >> "$ACTIONS_FILE"
    # pm2 reload is graceful: one worker at a time, no dropped connections.
    /usr/bin/pm2 reload all 2>&1 | head -20 | logger -t ic-watchdog
    ;;
  pm2_restart)
    log "action=systemctl_restart_pm2 (failures=$failures)"
    echo "$now" >> "$ACTIONS_FILE"
    systemctl restart pm2-root.service
    ;;
  reboot)
    log "action=reboot (failures=$failures)"
    echo "$now" >> "$ACTIONS_FILE"
    /usr/sbin/reboot
    ;;
esac
