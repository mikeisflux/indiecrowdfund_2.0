#!/bin/bash
# Probes /api/health/live and auto-restarts the cluster on sustained failure.
# Installed to /usr/local/bin/ic-watchdog.sh by setup-watchdog.sh and
# triggered every 30s by the ic-watchdog.timer systemd unit.
#
# Escalation ladder (consecutive failures at 30s probe interval). Each tier
# fires EXACTLY ONCE per failure episode (equality match, not >=) so the
# 3-action cooldown budget is enough for the full ladder. The original
# version used >= which made "reload" fire at failures 3, 4 AND 5 -- eating
# the whole cooldown budget before restart/reboot ever got a turn (observed
# live on Jun 9: "consecutive=6 ... refusing pm2_restart").
#   3  (90s)   -> pm2 reload all                      (graceful, zero downtime)
#   6  (3min)  -> systemctl restart pm2-root.service  (heavier; kills PM2 daemon)
#   9  (4.5m)  -> systemctl reboot                    (last resort)
#   then every 10th probe (5min) past 9 -> retry reboot, still cooldown-gated
#
# Probe semantics: only "the event loop didn't answer" counts as a failure --
# connection refused, timeout, or HTTP 5xx. HTTP 404 means the app responded
# but the running build predates /api/health/live (or was rolled back to one
# that does); restarting won't fix a missing route, so 404 logs a warning and
# counts as ALIVE. The original -f curl treated 404 as failure, which made
# the watchdog fight a healthy site during the Jun 9 deploy window.
#
# Cooldown: at most 3 actions in any 10-min window so a real bug doesn't
# churn the box forever. Boot grace: no-op for 2 minutes after boot.
#
# PM2_HOME must point at the daemon that actually owns the cluster. systemd
# runs this script without HOME, and pm2 falls back to a bogus location
# (observed: it spawned a brand-new daemon at /etc/.pm2 and reloaded an
# empty process list -- "[PM2][WARN] No process found"). Both the export
# here and the Environment= lines in the unit file pin it.
#
# Logs every decision to journalctl: journalctl -t ic-watchdog -f
set -u

export HOME=/root
export PM2_HOME=/root/.pm2
PM2_BIN=$(command -v pm2 || echo /usr/bin/pm2)

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
REBOOT_RETRY_EVERY=10

mkdir -p "$STATE_DIR"
touch "$FAIL_FILE" "$ACTIONS_FILE"

log() { logger -t ic-watchdog -- "$*"; }

# Boot grace -- skip probe entirely
uptime_sec=$(awk '{print int($1)}' /proc/uptime)
if [ "$uptime_sec" -lt "$BOOT_GRACE" ]; then
  exit 0
fi

# Probe. Capture the HTTP status so we can tell "app answered with an
# error page" (alive) apart from "nothing answered" (dead).
http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$PROBE_TIMEOUT" "$HEALTH_URL" 2>/dev/null)
curl_exit=$?

if [ "$curl_exit" -eq 0 ] && [ "$http_code" -ge 200 ] && [ "$http_code" -lt 500 ]; then
  # Event loop answered -> alive. Warn on anything that isn't a clean 200
  # (404 = running build is missing the route; restart can't fix that).
  if [ "$http_code" -ne 200 ]; then
    log "probe returned HTTP $http_code -- app alive but check the deployed build"
  fi
  prev=$(cat "$FAIL_FILE" 2>/dev/null || echo 0)
  if [ "${prev:-0}" -gt 0 ] 2>/dev/null; then
    log "recovered after $prev consecutive failures"
  fi
  echo 0 > "$FAIL_FILE"
  exit 0
fi

# Failure -- bump counter
failures=$(cat "$FAIL_FILE" 2>/dev/null || echo 0)
case "$failures" in (*[!0-9]*|"") failures=0 ;; esac
failures=$((failures + 1))
echo "$failures" > "$FAIL_FILE"
log "health probe failed (consecutive=$failures curl_exit=$curl_exit http=$http_code)"

# Each tier fires exactly once per episode; reboot re-arms periodically
# in case the first reboot attempt was swallowed.
action=""
if [ "$failures" -eq "$T_RELOAD" ]; then
  action="reload"
elif [ "$failures" -eq "$T_PM2_RESTART" ]; then
  action="pm2_restart"
elif [ "$failures" -eq "$T_REBOOT" ]; then
  action="reboot"
elif [ "$failures" -gt "$T_REBOOT" ] && [ $(( (failures - T_REBOOT) % REBOOT_RETRY_EVERY )) -eq 0 ]; then
  action="reboot"
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
    "$PM2_BIN" reload all 2>&1 | head -20 | logger -t ic-watchdog
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
