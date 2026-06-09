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
4. [Phased Migration](#phased-migration)
5. [Component Work](#component-work)
6. [Open Questions / Decisions Needed](#open-questions--decisions-needed)
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
- [ ] **Rate limit counters:** currently per-process in `src/lib/auth/rate-limit.ts`. With 2+ servers, a brute-forcer gets N× the budget. Move to Redis or Postgres-backed counter, OR live with the looser cap.
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

Two viable patterns:

**Pattern A — Build-on-each-server (simplest, current model):**
- Each app server runs its own `build-and-swap.sh` triggered by a deploy script that SSH-fans out
- Wastes CPU on N parallel builds; risks build skew if one server has a slightly different env

**Pattern B — Build-once-and-rsync (more robust):**
- A separate build runner (could be a dedicated tiny box, or the LB box, or a CI job) builds `.next` + `.prisma` client
- Rsync to each app server, restart their PM2 in a rolling fashion (watch crashing servers, halt on failure)
- Requires both servers to have the SAME Node/Prisma versions

- [ ] Decide on pattern (B is recommended once N > 2)
- [ ] Rewrite `build-and-swap.sh` accordingly
- [ ] Add cluster-aware health gate: rollout halts if any app server's `unstable_restarts > 2`

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

## Open Questions / Decisions Needed

1. **LB choice:** Cloudflare LB ($), self-hosted nginx box, or strip Next.js off this box and re-use its nginx? (See [Load Balancer Options](#load-balancer-options).)
2. **Hosting provider:** Stay on Hetzner (current) or split across providers for HA?
3. **Hetzner private network type:** vSwitch (free) vs Cloud Network ($1/mo)?
4. **App server sizing:** 1× CCX22 (4/16) per app box, or 2× CX22 (4/8)? Smaller-and-more is more failure-tolerant, but pgbouncer config needs adjusting.
5. **Read replicas:** Do we need a Postgres read replica yet, or is the master + pgbouncer enough? (Probably enough until daily peak QPS doubles.)
6. **Build strategy:** Build-on-each (Pattern A) or build-once-and-rsync (Pattern B)?
7. **Rate limit storage:** Redis (new dep), Postgres table, or accept N× cap inflation?
8. **Centralized logging:** When in the migration? Or wait until pain forces it?

---

## Cost Estimate

Rough monthly numbers assuming Hetzner Cloud (other providers similar):

| Component | Spec | Cost |
|-----------|------|------|
| db-01 (this box, kept) | CX42: 8 vCPU / 16 GB | already paid |
| app-01 | CCX22: 4 vCPU / 16 GB dedicated | ~€20/mo |
| app-02 | CCX22: 4 vCPU / 16 GB dedicated | ~€20/mo |
| LB box (if Option B) | CX22: 2 vCPU / 4 GB | ~€5/mo |
| Cloudflare LB (if Option A) | $5 base + $0.50/M requests | ~$10–30/mo depending on traffic |
| Private network | vSwitch | free |
| Backup storage (WAL archive) | R2 | <$1/mo for current data volume |

**Realistic total:** +€40–60/mo over current single-server cost for 2 app servers + LB choice.

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
- [ ] Decision made on each of the [Open Questions](#open-questions--decisions-needed)
- [ ] One reliable hour blocked off — phase 1 is reversible but cleaner if uninterrupted
- [ ] Watchdog disabled during the cutover window so it doesn't fight us (`systemctl stop ic-watchdog.timer`)
