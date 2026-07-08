# Multi-Server Migration Plan

> **Purpose:** Migrate IndieCrowdfund from a single-box deployment to a
> horizontally-scalable architecture: this server becomes the dedicated
> database host, application traffic is served by 2+ app servers behind a
> load balancer. This is the path to handling newsletter-blast traffic
> without saturating workers, and to surviving the loss of any single
> machine.

---

## Table of Contents

1. [Current State (after the Jun 9 fixes)](#current-state-after-the-jun-9-fixes)
2. [Target Architecture](#target-architecture)
3. [Load Balancer Options](#load-balancer-options)
4. [Locked Decisions](#locked-decisions)
5. [Phased Migration](#phased-migration)
6. [Component Work](#component-work)
7. [Cost Estimate](#cost-estimate)
8. [Risk and Rollback](#risk-and-rollback)
9. [Pre-Flight Checklist](#pre-flight-checklist)

---

## Current State (after the Jun 9 fixes)

**Hardware:** 1× server, 16 GB RAM, 8-core CPU (Hetzner).

**Stack on the box:**
- nginx (reverse proxy + TLS termination) → localhost:3000
- PM2 cluster with 8 Next.js workers (Prisma pool capped at 10/worker = 80 total)
- PostgreSQL (max_connections 150)
- pm2-logrotate, cron jobs, persistent journals, 5-min snapshot cron
- ic-watchdog systemd timer (auto-restart on health failure)

**Already external:**
- Object storage: Cloudflare R2 (uploads, images, build backups)
- DNS / CDN / TLS: Cloudflare
- Email: SendGrid / Mailgun (configurable)
- Payments: Stripe / DivinityCoin

**Single points of failure:**
- Loss of the box = total outage (~minutes to rebuild from snapshot)
- DB query saturation cascades into app saturation (same process)
- No capacity to absorb 2× normal load

---

## Target Architecture

```
                      ┌───────────────────────────────┐
                      │  Cloudflare (DNS / CDN / WAF) │
                      └────────────────┬──────────────┘
                                       │
                          ┌────────────▼────────────┐
                          │   Load Balancer (LB)    │
                          │   nginx or Cloudflare   │
                          │   Load Balancing        │
                          └─────┬───────┬───────┬───┘
                                │       │       │
                ┌───────────────▼──┐  ┌─▼────┐ ┌▼─────┐
                │  app-01          │  │app-02│ │app-N │  ← horizontally
                │  Next.js + PM2   │  │ ...  │ │ ...  │     scalable
                │  No DB locally   │  │      │ │      │
                └─────────┬────────┘  └───┬──┘ └──┬───┘
                          │               │       │
                          └───────────────┼───────┘
                                          │
                                ┌─────────▼──────────┐
                                │  db-01 (this box)  │
                                │  PostgreSQL +      │
                                │  pgbouncer         │
                                │  Daily snapshot    │
                                └────────────────────┘
```

**Per-role responsibilities:**

| Role          | Runs                                          | Notes |
|---------------|-----------------------------------------------|-------|
| DB server     | PostgreSQL, pgbouncer, daily pg_dump, ufw     | Current 16 GB box. No Next.js. |
| App server    | Next.js (PM2 cluster), nginx (local-only fallback), watchdog | 4–8 GB each. As many as needed. |
| LB            | nginx upstream block OR Cloudflare LB         | See [Load Balancer Options](#load-balancer-options) |
| Cron leader   | One designated app server                     | Must NOT run on every app server (duplicate sends) |

---

## Load Balancer Options

The user asked for "a load balancer to manage the other servers." Three viable approaches, in order of operational simplicity:

### Option A — Cloudflare Load Balancing (Recommended)

- **What it is:** Cloudflare's paid Load Balancing add-on (~$5/month base + $0.50 per million requests)
- **Pros:** Already at the edge, no extra box, integrated with existing DNS/WAF, geo-aware routing, native healthcheck against `/api/health/live`, automatic origin removal on failure.
- **Cons:** Per-request cost scales with traffic. No control beyond their dashboard.
- **Health check:** point at `/api/health/live` every 60s.

### Option B — Self-hosted nginx LB on its own box

- **What it is:** A small ($5–10/mo, 2 GB) box running nothing but nginx with an upstream block listing all app servers.
- **Pros:** Full control, fixed cost, no per-request fees. Same nginx config knowledge we already have.
- **Cons:** New box to manage, IS itself a single point of failure (mitigated by Cloudflare in front).
- **Config sketch:**
  ```nginx
  upstream ic_app_pool {
      least_conn;
      server app-01.internal:3000 max_fails=3 fail_timeout=10s;
      server app-02.internal:3000 max_fails=3 fail_timeout=10s;
      keepalive 32;
  }
  server {
      listen 443 ssl http2;
      location / {
          proxy_pass http://ic_app_pool;
          proxy_next_upstream error timeout http_502 http_503 http_504;
          proxy_connect_timeout 10s;
          proxy_read_timeout 90s;
      }
  }
  ```

### Option C — Run the LB on the DB box

- **What it is:** Re-use the existing nginx on this server. Strip Next.js off. Postgres + nginx-as-LB only.
- **Pros:** No new box. Simplest cutover (just remove Next.js from upstream, point at app servers).
- **Cons:** DB box now handles request fanout traffic. If LB melts, DB melts. Bad coupling.
- **Verdict:** Acceptable for a 2-server bootstrap. Migrate to Option A or B once app server count grows.

**Recommendation:** Start with **C** during initial rollout (zero new boxes), upgrade to **A** within 3 months. Option B is the fallback if Cloudflare's pricing model becomes painful.

---

## Phased Migration

Strict ordering — each phase is independently rollback-able.

### Phase 0 — Prerequisites (already done as of Jun 9)
- [x] 8-worker cluster, Prisma pool sized, watchdog running
- [x] Persistent journals, snapshot cron, slow query log
- [x] `/api/health/live` endpoint
- [x] Admin Logs tab for ops visibility

### Phase 1 — Decouple Postgres from localhost
**Goal:** Postgres listens on the private network and accepts authenticated connections from external IPs. App still runs locally — but now uses the same connection string format we'll use later.

- [ ] Provision Hetzner private network (vSwitch / Cloud Network) the new servers will join
- [ ] On this box: edit `postgresql.conf` → `listen_addresses = 'localhost, 10.x.x.x'` (the private IP only)
- [ ] Add `pg_hba.conf` entries for each future app server private IP with `scram-sha-256` auth
- [ ] UFW: `ufw allow from 10.0.0.0/16 to any port 5432`
- [ ] Test connection from this same box using the private IP, confirm it still works
- [ ] Take a fresh `pg_dump` snapshot before phase 2

### Phase 2 — Install pgbouncer in front of Postgres
**Goal:** Cap actual Postgres connection count regardless of how many app servers connect.

- [ ] `apt install pgbouncer` on the DB box
- [ ] Configure transaction-mode pooling, `max_client_conn = 500`, `default_pool_size = 25`
- [ ] App connection string becomes `postgresql://...:6432/...` (pgbouncer) instead of `:5432` (postgres direct)
- [ ] Test under load: 8 workers × 10 client connections each = 80 client conns → pgbouncer multiplexes onto ~25 real Postgres connections
- [ ] Note: pgbouncer transaction mode breaks `LISTEN/NOTIFY` and prepared statements — verify no Prisma feature relies on these (Prisma queries are stateless so should be fine; double-check)

### Phase 3 — Provision app-01 and run in parallel
**Goal:** A second box runs the app, pointed at this box's Postgres. No live traffic yet.

- [ ] Provision app-01 (Hetzner CCX22: 4 vCPU / 16 GB or smaller — start with 4/8)
- [ ] Join private network
- [ ] Install Node.js, PM2, nginx, run `setup-watchdog.sh`
- [ ] Clone repo, env vars, build
- [ ] `DATABASE_URL` points to DB box's private IP via pgbouncer
- [ ] Smoke test by hitting app-01 directly (bypassing LB): `curl http://10.x.x.x:3000/api/health`
- [ ] Verify watchdog probes localhost:3000 (only this server's app, not DB box's)

### Phase 4 — Stand up the load balancer
**Goal:** Route a small slice of production traffic to app-01.

- [ ] Configure LB upstream pool with this server + app-01 (both still serving)
- [ ] Healthcheck against `/api/health/live` every 30s
- [ ] Cutover DNS or LB weight slowly: 10% → 25% → 50% → 100%
- [ ] Monitor `journalctl -t ic-watchdog`, nginx upstream errors, app logs on both boxes
- [ ] Watch for hidden cross-server state issues (rate limit counters, in-memory caches)

### Phase 5 — Identify and fix per-server state leaks
**Goal:** No request should care which app server it lands on.

- [ ] **Sessions:** already in Postgres `Session` table → ✓ shared
- [ ] **CSRF tokens:** verify they're stateless (signed) or stored in DB
- [ ] **Rate limit counters:** currently per-process LRU in `src/lib/auth/rate-limit.ts`. Per [Locked Decision 7](#locked-decisions): halve the per-IP cap at cutover so the cluster-wide effective budget stays near the original intent. Verify the cap constant lives in one place; if not, refactor to a single config value before scaling out. Re-evaluate (move to Postgres-backed counters for security-critical actions) only if brute-force evidence appears.
- [ ] **In-process caches:** LRUs become per-server. Tolerable for read-heavy endpoints (each server warms its own); not tolerable for invalidation-sensitive caches.
- [ ] **Cron jobs:** designate one app server as `CRON_LEADER=true` via env var; cron-bearing code paths check the flag and no-op on followers. List of cron jobs to audit: newsletter sender, stale-pledge cleanup, SEO refresh, botblock watcher.
- [ ] **Build artifacts (`.next`):** each app server builds independently OR build once and rsync (see Phase 7).

### Phase 6 — Remove Next.js from this server
**Goal:** This server hosts only Postgres + pgbouncer + LB (if Option C).

- [ ] Provision and cut over to app-02 first so we have 2 app boxes before removing the third
- [ ] Verify LB is serving from app-01 + app-02 only, this box receiving zero `/api/*` traffic
- [ ] `pm2 stop indiecrowdfund && pm2 delete indiecrowdfund`
- [ ] `systemctl stop ic-watchdog.timer` (or modify it to probe Postgres on this box instead — see Phase 8)
- [ ] Free RAM up to Postgres: bump `shared_buffers` from default to ~25% of RAM (4 GB on a 16 GB box), `effective_cache_size` to ~50%
- [ ] Disable Next.js-specific deploy/build scripts on this server
- [ ] Keep nginx if running Option C (LB lives here), otherwise stop it

### Phase 7 — Centralize the deploy pipeline
**Goal:** One build, deployed atomically to all app servers.

**Decision (Locked Decision 6):** Build-once-on-the-LB-box, rsync to app servers.

**Why the LB box:**
- Idle CPU — nginx proxying barely uses one core; building Next.js on the
  other core during deploy is invisible to live traffic
- Already on the private network with high-throughput direct routes to
  every app server (rsync over 10 Gbps internal vs. public internet)
- One source of truth — every app server gets bit-identical `.next`
  artifacts. Eliminates the build skew risk of N independent npm installs
- One node version to keep current — only the LB box needs the build
  toolchain. App servers just need the Node runtime

**Script shape (`scripts/build-and-deploy.sh`, runs on the LB box):**

```bash
# 1. Pull and build (on LB box)
git fetch origin && git pull
npm ci
npx prisma generate
NEXT_BUILD_OUTPUT=.next-staging npx next build --webpack
# (route-tree validation, tsc check, etc. — port from build-and-swap.sh)

# 2. Parallel rsync to each app server's staging dir
for host in app-01 app-02; do
  rsync -aHAX --delete .next-staging/ root@$host:~/indiecrowdfund_2.0/.next-staging/ &
  rsync -aHAX --delete node_modules/.prisma/ root@$host:~/indiecrowdfund_2.0/.prisma-staging/ &
done
wait

# 3. Rolling restart -- one server at a time, drained by LB between
for host in app-01 app-02; do
  # Drain: tell LB to stop sending traffic
  ssh lb-01 'sed -i "s/server $host:3000/server $host:3000 down/" /etc/nginx/sites-enabled/ic && nginx -s reload'
  # Wait for in-flight requests to drain (10s)
  sleep 10
  # Swap staging -> live, restart PM2
  ssh $host 'cd ~/indiecrowdfund_2.0 && \
    mv .next .next-backup-$(date +%s) && mv .next-staging .next && \
    mv node_modules/.prisma .prisma-backup-$(date +%s) && mv .prisma-staging node_modules/.prisma && \
    pm2 reload ecosystem.config.js --update-env'
  # Health check before un-draining
  sleep 5
  ssh $host 'curl -fsS http://127.0.0.1:3000/api/health/live' || { echo "FAIL on $host -- rolling back"; exit 1; }
  # Un-drain: bring back into LB rotation
  ssh lb-01 'sed -i "s/server $host:3000 down/server $host:3000/" /etc/nginx/sites-enabled/ic && nginx -s reload'
done
```

- [ ] Write `scripts/build-and-deploy.sh` along the above shape
- [ ] Add SSH keys: LB box has authorized passwordless SSH to each app server (and to itself for nginx reload)
- [ ] Health gate: rollout halts if any app server's `/api/health/live` doesn't return 200 within 30s of the restart
- [ ] Auto-rollback path: on failure, restore `.next-backup-*` and reload PM2 on the failed host, then halt (don't continue to next host)
- [ ] Keep `build-and-swap.sh` on the DB box as a single-server fallback during cutover; remove after Phase 6 is stable

### Phase 8 — Adapt watchdog and snapshot cron for the split topology
- [ ] On app servers: watchdog probes `localhost:3000/api/health/live` (unchanged)
- [ ] On DB server: watchdog probes Postgres via `pg_isready` instead of HTTP — restart Postgres on failure (rarely fires but catches stuck-replication or shared_buffers exhaustion)
- [ ] Snapshot cron on DB server: skip pm2 fields, keep pg fields, also capture `SELECT * FROM pg_stat_replication` once we add a replica
- [ ] Snapshot cron on app servers: skip pg fields, keep pm2 + memory + fd counts

### Phase 9 — Centralized logging (optional but recommended)
With N servers, `journalctl` and the Logs admin tab only show one server at a time. Options:

- [ ] Ship logs to Cloudflare R2 (cheap, already a dependency)
- [ ] Self-host Grafana Loki + Promtail on the LB box (~5 GB RAM)
- [ ] Use Papertrail / Better Stack / Datadog (paid, easy)

Until centralized logging is in place, the Logs admin tab should be augmented to ssh to other app servers — or we explicitly accept "log in to each server individually."

---

## Component Work

### Database

| Item | Current | Target |
|------|---------|--------|
| `listen_addresses` | `localhost` | `localhost, <private-ip>` |
| `pg_hba.conf` | trust for local | scram-sha-256 for `10.0.0.0/16` |
| `max_connections` | 150 (after Jun 9 fixes) | 100, fronted by pgbouncer |
| pgbouncer | n/a | transaction mode, pool size 25 |
| `shared_buffers` | ~128 MB | ~4 GB (25% of 16 GB once Node leaves) |
| `effective_cache_size` | ~512 MB | ~8 GB |
| TLS for connections | off (localhost only) | required (private network, but defense in depth) |
| Backup | pg_dump nightly | pg_dump nightly + WAL archiving to R2 (PITR) |

### Application

| Item | Current | Target |
|------|---------|--------|
| Workers per box | 8 | 4–8 depending on box size |
| `DATABASE_URL` | `postgresql://...@localhost:5432/...` | `postgresql://...@<db-priv-ip>:6432/...` (pgbouncer) |
| Build location | live box | each app server OR central build + rsync |
| Cron leader | implicit (single box) | explicit via `CRON_LEADER` env var |
| Health endpoint | `/api/health/live` | unchanged — LB and watchdog both use it |

### Networking

- [ ] Hetzner private network (vSwitch) or equivalent
- [ ] All inter-server traffic over private IPs (zero cost, faster than public)
- [ ] UFW on every box: allow private network, deny public except for required ports
- [ ] DB box: allow port 5432 (or 6432 via pgbouncer) only from private network
- [ ] App boxes: allow port 3000 only from LB private IP

### Secrets / config

- [ ] Audit `.env` for every secret currently set
- [ ] Decide on distribution: `git-crypt`, Ansible vault, Hashicorp Vault, or just rsync `.env` carefully
- [ ] Verify same secret values on every app server (session signing keys MUST match or sessions break on rotation)

---

## Locked Decisions

These were chosen Jun 9 2026. The rest of the plan assumes them.

1. **LB choice:** **Option B — dedicated nginx LB box** (~€5/mo). Cloudflare LB
   sits in front for DNS / WAF / DDoS, but request routing to the pool of app
   servers is handled by our own nginx so we keep full control and no
   per-request cost.
2. **Hosting provider:** **Hetzner** for everything. No multi-provider HA in
   this phase — adds operational complexity disproportionate to the
   reliability gain at our current scale.
3. **Private network:** **Hetzner Cloud Network** ($1/mo). vSwitch is for
   dedicated bare-metal; Cloud Network is the right offering for our CX/CCX
   boxes and gives us a custom subnet range.
4. **App server size:** **2× CX22** (2 vCPU shared / 4 GB / 40 GB SSD,
   ~€4/mo each). Two smaller boxes beat one big box for failure tolerance,
   and CX22 has plenty of room for 4 PM2 workers per box.
5. **Read replicas:** **None yet** — master + pgbouncer only. Jun 9 wasn't a
   read-saturation event; it was concurrent connection count + slow queries.
   pgbouncer fixes the first, endpoint caching fixes the second. A read
   replica adds replication lag, Prisma read/write routing, and a failover
   runbook. Worth it when we have a real read-saturation incident. Additive
   change later.
6. **Build strategy:** **Build-once on the LB box, rsync to app servers.**
   nginx LB has idle CPU, lives on the private network, gets us atomic
   "one source of truth" deploys with zero cross-server build skew. See
   [Phase 7](#phase-7--centralize-the-deploy-pipeline) for the script shape.
7. **Rate limit storage:** **Keep the per-process LRU, halve the per-IP cap
   at cutover.** With 2 app servers × 4 workers = 8 processes, an attacker
   effectively gets 8× the budget. Cutting the per-process cap in half
   restores ~4× the original intent — close enough for honest users.
   Upgrade to Postgres-backed counters for security-critical limits (login,
   password reset, signup) only if we see real brute-force evidence. Don't
   pull Redis in just for this.
8. **Centralized logging:** **Defer.** With 2-3 app servers the Logs admin
   tab plus `ssh + grep` is sufficient. Revisit when we hit 4+ servers or
   when an incident is harder to debug than it should be. Not preemptively
   self-hosting Loki or paying Papertrail/Better Stack.

---

## Cost Estimate

Rough monthly numbers assuming Hetzner Cloud (other providers similar):

| Component | Spec | Cost |
|-----------|------|------|
| db-01 (this box, kept) | existing | already paid |
| app-01 | CX22: 2 vCPU / 4 GB | ~€4/mo |
| app-02 | CX22: 2 vCPU / 4 GB | ~€4/mo |
| lb-01 (nginx) | CX22: 2 vCPU / 4 GB | ~€4/mo |
| Hetzner Cloud Network | custom subnet | ~€1/mo |
| Backup storage (WAL archive) | Cloudflare R2 | <€1/mo for current data volume |

**Realistic total:** **~€14/mo extra** over current single-server cost. App
boxes can scale horizontally by adding more CX22s as load grows; no other
fixed cost increases until that point.

---

## Risk and Rollback

### Highest-risk moments

1. **Phase 1 (Postgres binds new interface):** A misconfigured `pg_hba.conf` can lock out the app entirely. Mitigation: change config, reload (not restart), test from localhost first, keep a root shell open with `tail -f /var/log/postgresql/*.log` running.
2. **Phase 4 (LB sends real traffic to app-01):** First moment a second machine handles production. Hidden bugs in per-server state surface here. Mitigation: cutover at 10% weight first, watch for 5xx spikes, ready to flip back to 100% on this box within seconds.
3. **Phase 6 (this box stops serving HTTP):** Point of no return for "we still have a working single-server fallback." Mitigation: do NOT remove the .next directory or PM2 config from this box — just stop it. If app servers all melt, `pm2 start ecosystem.config.js` here brings the old behavior back within 30 seconds.

### Universal rollback levers

- **DNS-level:** Cloudflare A record points back at this server's public IP. ~30 second propagation.
- **LB-level:** Drop all app server upstreams, leave only this box. Instant.
- **DB-level:** Each phase change to `postgresql.conf` keeps a `.before-...` backup file (per `setup-server-tuning.sh` pattern). Revert + restart Postgres recovers.

---

## Pre-Flight Checklist

Before starting Phase 1, confirm:

- [ ] Latest pg_dump backup exists and has been test-restored to a scratch DB
- [ ] All env vars and secrets are documented somewhere outside the live box
- [ ] Cloudflare DNS access ready (for DNS-level rollback)
- [ ] Hetzner account has billing capacity for new boxes
- [x] Decisions locked (see [Locked Decisions](#locked-decisions))
- [ ] One reliable hour blocked off — phase 1 is reversible but cleaner if uninterrupted
- [ ] Watchdog disabled during the cutover window so it doesn't fight us (`systemctl stop ic-watchdog.timer`)
