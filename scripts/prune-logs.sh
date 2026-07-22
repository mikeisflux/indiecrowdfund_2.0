#!/bin/bash
# Reclaim disk from accumulated logs — flat files + DB log tables — then
# VACUUM. DRY-RUN by default: prints what WOULD be removed. Pass --apply
# to actually delete.
#
#   ./scripts/prune-logs.sh            # show what would be pruned
#   ./scripts/prune-logs.sh --apply    # actually prune + vacuum
#
# Retention (tune the vars below):
#   EmailQueue  SENT/FAILED   > 30 days
#   EmailLog                  > 90 days
#   AiRunLog                  > 30 days
#   ErrorOccurrence           > 30 days
#   EmailCampaignClick        > 180 days   (kept for conversion attribution)
#
# NOT handled here (on purpose):
#   - /var/log/ic-snapshots, persistent journald, PG slow-query log
#     -> those are the restart-forensics; use scripts/teardown-diagnostics.sh
#   - SuspiciousActivity -> already auto-pruned to 7 days by the bot blocker
set -uo pipefail

APPLY=0
[ "${1:-}" = "--apply" ] && APPLY=1

PGCONN=(-h localhost -U indieuser -d indiecrowdfund)
# Auth: ~/.pgpass, a caller-provided PGPASSWORD, or the app .env next to this
# repo — the password itself must NEVER be committed here (public repo).
if [ -z "${PGPASSWORD:-}" ] && [ -f "$(dirname "$0")/../.env" ]; then
  PGPASSWORD="$(grep -m1 '^DATABASE_URL' "$(dirname "$0")/../.env" | sed -E 's|.*://[^:]+:([^@]+)@.*|\1|')"
  export PGPASSWORD
fi
psql_q() { psql "${PGCONN[@]}" -At -c "$1"; }

# table | where-clause | human label
ROWS=(
  'UserBehavior|"timestamp" < now() - interval '"'"'90 days'"'"'|UserBehavior analytics >90d'
  'EmailQueue|status IN ('"'"'SENT'"'"','"'"'FAILED'"'"') AND COALESCE("sentAt","createdAt") < now() - interval '"'"'30 days'"'"'|EmailQueue sent/failed >30d'
  'EmailLog|"sentAt" < now() - interval '"'"'180 days'"'"'|EmailLog rows >180d'
  'AiRunLog|"createdAt" < now() - interval '"'"'30 days'"'"'|AiRunLog >30d'
  'ErrorOccurrence|"timestamp" < now() - interval '"'"'30 days'"'"'|ErrorOccurrence >30d'
  'EmailCampaignClick|"clickedAt" < now() - interval '"'"'180 days'"'"'|EmailCampaignClick >180d'
)

echo "=== DB log tables ($([ "$APPLY" = 1 ] && echo APPLYING || echo dry-run)) ==="
VACUUM_TABLES=()
for entry in "${ROWS[@]}"; do
  IFS='|' read -r table where label <<< "$entry"
  count=$(psql_q "SELECT COUNT(*) FROM \"$table\" WHERE $where" 2>/dev/null || echo "ERR")
  printf '  %-28s %s rows\n' "$label" "$count"
  if [ "$APPLY" = 1 ] && [ "$count" != "ERR" ] && [ "${count:-0}" -gt 0 ] 2>/dev/null; then
    psql_q "DELETE FROM \"$table\" WHERE $where" >/dev/null && VACUUM_TABLES+=("$table")
  fi
done

# EmailLog: strip the big htmlContent column off rows older than 30 days
# instead of deleting the audit rows. Reclaims most of EmailLog's size
# while keeping who/what/when the email was sent.
strip_where='"htmlContent" IS NOT NULL AND "sentAt" < now() - interval '"'"'30 days'"'"''
strip_count=$(psql_q "SELECT COUNT(*) FROM \"EmailLog\" WHERE $strip_where" 2>/dev/null || echo "ERR")
printf '  %-28s %s rows\n' "EmailLog strip html >30d" "$strip_count"
if [ "$APPLY" = 1 ] && [ "$strip_count" != "ERR" ] && [ "${strip_count:-0}" -gt 0 ] 2>/dev/null; then
  psql_q "UPDATE \"EmailLog\" SET \"htmlContent\" = NULL WHERE $strip_where" >/dev/null
  VACUUM_TABLES+=("EmailLog")
fi

if [ "$APPLY" = 1 ] && [ "${#VACUUM_TABLES[@]}" -gt 0 ]; then
  # unique the list so we don't vacuum EmailLog twice
  mapfile -t VACUUM_TABLES < <(printf '%s\n' "${VACUUM_TABLES[@]}" | sort -u)
  echo "  vacuuming: ${VACUUM_TABLES[*]}"
  for t in "${VACUUM_TABLES[@]}"; do
    psql "${PGCONN[@]}" -c "VACUUM (ANALYZE) \"$t\";" >/dev/null 2>&1 || true
  done
fi

echo
echo "=== flat log files ==="
FLAT_LOGS=(/var/log/email-queue.log /var/log/ai-marketing.log /var/log/scheduled-campaigns.log /var/log/indiecrowdfund-cron.log)
for f in "${FLAT_LOGS[@]}"; do
  [ -f "$f" ] || continue
  sz=$(du -h "$f" 2>/dev/null | cut -f1)
  printf '  %-40s %s\n' "$f" "$sz"
  [ "$APPLY" = 1 ] && : > "$f"
done
if command -v pm2 >/dev/null 2>&1; then
  echo "  pm2 logs: $(du -sh ~/.pm2/logs 2>/dev/null | cut -f1)"
  [ "$APPLY" = 1 ] && pm2 flush >/dev/null 2>&1 || true
fi

echo
if [ "$APPLY" = 1 ]; then
  echo "Done. Pruned + vacuumed. (For OS-level disk return, VACUUM FULL locks tables — run in a window if needed.)"
else
  echo "Dry run only. Re-run with --apply to delete + vacuum."
fi
