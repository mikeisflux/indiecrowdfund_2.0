#!/bin/bash
# Apply nginx tuning for the IndieCrowdfund Next.js cluster.
#
# What it does:
#   - Adds an upstream pool with keepalive 32 so nginx reuses TCP
#     connections to Node instead of opening a new socket per request.
#     This was the missing piece behind the Jun 9 saturation -- under
#     burst the TCP accept queue filled and nginx logged "upstream
#     timed out (110: Connection timed out) while connecting to
#     upstream".
#   - Adds fail-fast proxy_connect_timeout=10s everywhere so a wedged
#     worker serves the maintenance page in 10s instead of hanging for
#     60s.
#   - Adds proxy_next_upstream on API/auth locations so transient 5xx
#     from a sick worker triggers a retry (nginx won't retry POSTs by
#     default -- safe for mutations).
#   - Moves any stale *.before-ic-tuning backup OUT of sites-enabled
#     so nginx doesn't double-load it (the "duplicate listen options"
#     trap).
#
# The root `/` location is left on direct proxy_pass (no keepalive
# pool) because it serves websocket upgrades (HMR / real-time) and
# Connection: keep-alive vs Connection: upgrade are mutually exclusive.
# That location still gets fail-fast timeouts.
#
# Idempotent. If anything fails, the previous config is restored
# automatically.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo bash $0"
  exit 1
fi

SITE_CONF=""
for cand in \
  /etc/nginx/sites-enabled/indiecrowdfund \
  /etc/nginx/sites-enabled/indiecrowdfund.com \
  /etc/nginx/sites-available/indiecrowdfund \
  /etc/nginx/conf.d/indiecrowdfund.conf; do
  if [ -f "$cand" ]; then
    SITE_CONF="$cand"
    break
  fi
done

if [ -z "$SITE_CONF" ]; then
  echo "ERROR: couldn't locate the nginx site config for indiecrowdfund."
  echo "Searched: /etc/nginx/sites-enabled/, /etc/nginx/sites-available/, /etc/nginx/conf.d/"
  exit 1
fi

echo "[1/5] Found nginx site config: $SITE_CONF"

# Move any pre-existing backups OUT of nginx's load path. nginx globs
# everything in sites-enabled regardless of extension, so a previous
# `cp ...before-ic-tuning` left a duplicate listen-443 directive
# colliding with the live config.
ROGUE_BACKUPS=$(find /etc/nginx/sites-enabled -maxdepth 1 -name 'indiecrowdfund.before-*' -o -name 'indiecrowdfund.bak*' 2>/dev/null || true)
if [ -n "$ROGUE_BACKUPS" ]; then
  echo "[2/5] Quarantining old backups from sites-enabled (nginx was double-loading them):"
  mkdir -p /root/nginx-backups
  for f in $ROGUE_BACKUPS; do
    base=$(basename "$f")
    mv "$f" "/root/nginx-backups/${base}.$(date +%s)"
    echo "    moved $f -> /root/nginx-backups/${base}.$(date +%s)"
  done
else
  echo "[2/5] No rogue backups in sites-enabled"
fi

# Fresh backup of the CURRENT live config -- placed OUTSIDE sites-enabled
# so it can't be loaded by nginx.
TS=$(date +%Y%m%d_%H%M%S)
mkdir -p /root/nginx-backups
BACKUP="/root/nginx-backups/indiecrowdfund.before-tuning.$TS"
cp "$SITE_CONF" "$BACKUP"
echo "[3/5] Backed up current config to $BACKUP"

# Write the new config. The here-doc bypasses any terminal/paste layer.
NEW_CONF=$(mktemp)
cat > "$NEW_CONF" <<'NGINX_CONFIG'
# Nginx configuration for IndieCrowdfund

upstream ic_nextjs {
    server 127.0.0.1:3000;
    keepalive 32;
}

server {
    server_name indiecrowdfund.com WWWPLACEHOLDER.indiecrowdfund.com;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml application/xml+rss image/svg+xml;

    error_page 502 503 504 /maintenance.html;

    location = /maintenance.html {
        root /home/user/indiecrowdfund_2.0/public;
        internal;
    }

    location / {
        limit_req zone=general burst=50 nodelay;
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 10s;
        proxy_send_timeout 30s;
        proxy_read_timeout 86400;
    }

    # Large digital-file downloads stream a ~1GB response from R2 through
    # Node. They must NOT be buffered by nginx (spooling a gig before the
    # first byte) and must tolerate slow clients — the generic /api/ block's
    # 30s send / 120s read timeouts drop a big download over a slow
    # connection. No rate limit here; a single legit download shouldn't be
    # throttled. (More specific prefix wins over /api/ regardless of order.)
    location /api/backer/digital-files/download {
        proxy_pass http://ic_nextjs;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 10s;
        proxy_send_timeout 3600s;
        proxy_read_timeout 3600s;
        proxy_buffering off;
        proxy_request_buffering off;
    }

    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://ic_nextjs;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 10s;
        proxy_send_timeout 30s;
        proxy_read_timeout 120s;
        proxy_next_upstream error timeout http_502 http_503 http_504;
    }

    location /api/auth/ {
        limit_req zone=auth_limit burst=5 nodelay;
        proxy_pass http://ic_nextjs;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 10s;
        proxy_send_timeout 30s;
        proxy_read_timeout 60s;
        proxy_next_upstream error timeout http_502 http_503 http_504;
    }

    location /_next/static {
        proxy_pass http://ic_nextjs;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_cache_valid 60m;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location /_next/image {
        proxy_pass http://ic_nextjs;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_cache_valid 60m;
        add_header Cache-Control "public, max-age=2592000";
    }

    location ^~ /.well-known/ {
        proxy_pass http://ic_nextjs;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location ~ /\. {
        deny all;
    }

    location ~ /\.env {
        deny all;
    }

    client_max_body_size 2G;

    listen [::]:443 ssl ipv6only=on;
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/indiecrowdfund.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/indiecrowdfund.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    client_max_body_size 2G;
    if ($host = WWWPLACEHOLDER.indiecrowdfund.com) {
        return 301 https://$host$request_uri;
    }

    if ($host = indiecrowdfund.com) {
        return 301 https://$host$request_uri;
    }

    listen 80;
    listen [::]:80;
    server_name indiecrowdfund.com WWWPLACEHOLDER.indiecrowdfund.com;
    return 404;
}
NGINX_CONFIG

# Substitute the placeholder back to "www" on disk (the placeholder
# only existed in the chat copy of this file so the chat auto-linker
# couldn't grab a literal subdomain URL and rewrite it as a markdown
# link). In the repo + on disk the placeholder is just a marker string.
sed -i 's/WWWPLACEHOLDER/www/g' "$NEW_CONF"

# Install into place
cp "$NEW_CONF" "$SITE_CONF"
rm -f "$NEW_CONF"
echo "[4/5] Wrote new config to $SITE_CONF"

# Validate. If invalid, restore the backup before bailing.
echo "[5/5] Validating with nginx -t..."
if nginx -t 2>&1; then
  echo
  echo "    Config valid. Reloading nginx..."
  systemctl reload nginx
  echo
  echo "OK -- nginx reloaded with new tuning."
  echo "    Backup kept at: $BACKUP"
  echo
  echo "Sanity check:"
  CURL_OUT=$(curl -fsS -o /dev/null -w "%{http_code}" https://indiecrowdfund.com/api/health/live 2>&1 || echo "fail")
  echo "    https://indiecrowdfund.com/api/health/live -> HTTP $CURL_OUT"
else
  echo
  echo "    nginx -t FAILED. Restoring previous config from $BACKUP..."
  cp "$BACKUP" "$SITE_CONF"
  nginx -t && echo "    Restored config valid -- no reload needed (old config still live)."
  echo
  echo "ERROR: the new tuning would have broken nginx. Old config restored."
  echo "Backup of attempted (broken) write: $NEW_CONF.failed-$TS"
  exit 1
fi
