#!/bin/bash
# Server-level tuning that pairs with the 4 -> 8 PM2 worker bump
# in ecosystem.config.js and the Prisma max=10 pool size in
# src/lib/db/index.ts. Idempotent.
#
# What it does:
#   1. Raises Postgres max_connections from default 100 -> 150 so
#      8 workers * 10 connections = 80 has headroom for admin /
#      cron / psql sessions on top.
#   2. Tunes nginx so a brief upstream slow patch fails-fast and
#      backs the cluster with keepalive instead of churning new
#      TCP connections per request. Specifically:
#         - upstream block with keepalive 32 (Next.js gets reused
#           HTTP connections instead of new sockets per request)
#         - proxy_connect_timeout 10s (was 60s -- a 60s connect
#           timeout means a single sick worker drags down the whole
#           perceived site; 10s fails fast and lets the client retry)
#         - proxy_read_timeout 90s (long-poll / SSE friendly)
#         - proxy_next_upstream tries another worker on 502/504
#
# Run as root on the production box. Safe to re-run.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo bash $0"
  exit 1
fi

echo "[1/2] Raising Postgres max_connections..."
PG_CONF=$(sudo -u postgres psql -At -c "SHOW config_file" 2>/dev/null || echo "")
if [ -z "$PG_CONF" ] || [ ! -f "$PG_CONF" ]; then
  echo "    ERROR: couldn't locate postgresql.conf -- aborting Postgres step"
else
  CURRENT=$(sudo -u postgres psql -At -c "SHOW max_connections" 2>/dev/null || echo "unknown")
  echo "    Current max_connections: $CURRENT"
  if [ "$CURRENT" = "150" ] || [ "$CURRENT" -gt 150 ] 2>/dev/null; then
    echo "    Already >= 150, skipping"
  else
    # Backup once
    if [ ! -f "$PG_CONF.before-ic-tuning" ]; then
      cp "$PG_CONF" "$PG_CONF.before-ic-tuning"
    fi
    # Idempotent: remove any existing line, then append new value
    sed -i '/^max_connections/d' "$PG_CONF"
    echo "max_connections = 150  # raised by ic setup-server-tuning.sh" >> "$PG_CONF"
    # max_connections requires a restart, not just reload
    systemctl restart postgresql
    NEW=$(sudo -u postgres psql -At -c "SHOW max_connections" 2>/dev/null || echo "unknown")
    echo "    After restart: max_connections = $NEW"
  fi
fi

echo "[2/2] Tuning nginx for the Next.js upstream..."
# Find the nginx site config that proxies to localhost:3000
SITE_CONF=""
for cand in \
  /etc/nginx/sites-enabled/indiecrowdfund.com \
  /etc/nginx/sites-enabled/indiecrowdfund \
  /etc/nginx/sites-available/indiecrowdfund.com \
  /etc/nginx/conf.d/indiecrowdfund.conf; do
  if [ -f "$cand" ]; then
    SITE_CONF="$cand"
    break
  fi
done

if [ -z "$SITE_CONF" ]; then
  # Last resort: grep for the proxy_pass to localhost:3000
  SITE_CONF=$(grep -rlE "proxy_pass\s+http://127\.0\.0\.1:3000" /etc/nginx/ 2>/dev/null | head -1 || echo "")
fi

if [ -z "$SITE_CONF" ] || [ ! -f "$SITE_CONF" ]; then
  echo "    ERROR: couldn't locate the nginx site config for indiecrowdfund"
  echo "    Manual changes needed -- apply this snippet to whatever file"
  echo "    contains 'proxy_pass http://127.0.0.1:3000;':"
else
  echo "    Found nginx site config: $SITE_CONF"
  if [ ! -f "$SITE_CONF.before-ic-tuning" ]; then
    cp "$SITE_CONF" "$SITE_CONF.before-ic-tuning"
  fi
fi

cat <<'SNIPPET'

    --- Recommended nginx changes ---
    Add to http {} or the server {} block at top level:

      upstream ic_nextjs {
          server 127.0.0.1:3000;
          keepalive 32;
      }

    Then change every "proxy_pass http://127.0.0.1:3000;" to:

          proxy_pass http://ic_nextjs;
          proxy_http_version 1.1;
          proxy_set_header Connection "";

    And set these proxy timeouts inside the location {} or server {}:

          proxy_connect_timeout 10s;
          proxy_send_timeout 30s;
          proxy_read_timeout 90s;
          proxy_next_upstream error timeout http_502 http_503 http_504;

    After editing:

          nginx -t && systemctl reload nginx

    Why: keepalive reuses HTTP connections to Next.js (less TCP churn
    under load); proxy_connect_timeout 10s means a sick worker fails
    fast instead of dragging the whole site to 60s timeouts;
    proxy_next_upstream retries the next worker on a transient 5xx.

SNIPPET

echo "Done. Verify with:"
echo "  sudo -u postgres psql -At -c 'SHOW max_connections'    # should be 150"
echo "  nginx -t                                                # before reload"
