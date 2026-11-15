# Response to FBI FLASH-20261113-001 (ARTEX autonomous intrusion framework)

**Advisory:** FBI Cyber Division FLASH, 13 November 2026, TLP:CLEAR. Full text in `ic3-csa-261113.md`, original PDF alongside it.
**Reviewed:** 15 November 2026.
**Scope reviewed:** indiecrowdfund.com (Next.js app, single host), its admin area, the Agent API, and the services it depends on. Card capture and card storage are DivinityCoin's surface; DivinityCoin has confirmed it is hardening against the same advisory on its side.

ARTEX is an open-source, LLM-driven agent framework that chains reconnaissance, exploitation and exfiltration against internet-facing applications at machine speed. The FBI's recommendations fall into four groups. This document records, for each one, what IndieCrowdfund already had, what was added in response, and what does not apply.

## 1. Reduce external attack surface

| Recommendation | Status |
|---|---|
| Inventory internet-facing applications, including peripheral ones (partner portals, mobile backends, third-party integrations) | **Done.** Inventory: the public site and its `/api/*`; the admin area; the creator IndieKit area; the retailer portal (`/retailers/*`); the Agent API (`/api/agent/v1`, key-authenticated, used by the NAS MCP server and the support chatbot); inbound webhooks (DivinityCoin, Whop, Mailgun, Shopify); the Shopify embedded app routes. No other hosts or services are exposed. |
| Restrict cloud administration, management interfaces and other sensitive services to trusted networks or dedicated administrative paths | **Done at the host.** Root SSH is restricted by source IP at the host firewall. Postgres listens on localhost only. The web admin area is now additionally gated by mandatory two-factor authentication (section 2). |
| Disable basic publishing authentication; restrict deployment credentials | **N/A / done.** Deploys run on the host from a git checkout (`build-and-swap.sh`); there is no remote publishing endpoint. Repository push is GitHub with MFA. |
| Run-from-package deployment models | **Partially inherent.** Next.js builds to an immutable `.next` directory swapped atomically; the running build is not edited in place. |
| Governance around public IP exposure | **Done.** One public host, one reverse proxy, no additional exposed ports. |
| Zero Trust access for enterprise applications | **Not applicable** at this scale; the admin area is the only "enterprise application" and is covered by MFA plus the enumeration controls below. |

## 2. Harden identity and access

| Recommendation | Status |
|---|---|
| Weak administrative credentials; account takeover via password resets (observed initial-access routes) | **Added: TOTP two-factor authentication.** `src/lib/auth/totp.ts` (RFC 6238, no third-party dependency, test vectors in `src/__tests__/totp.test.ts`), enrollment at Admin → Security → Two-factor with QR code and ten one-time backup codes, a second sign-in step in the login form, replay protection on codes, five attempts per challenge. Settings → Security → "Require two-factor for admin accounts" makes the proxy keep every ADMIN/SUPER_ADMIN on the enrollment page until they have enrolled. Secrets are encrypted at rest; backup codes are stored hashed. |
| Review sign-ins; investigate unfamiliar sources; evidence of authentication from previously unseen infrastructure | **Added: sign-in event log and new-location alert.** Every sign-in attempt (success, bad password, locked account, MFA pending/failed/passed, backup code used) is recorded in `LoginEvent` with IP and user agent. An admin signing in from an IP that account has never used is emailed immediately. Admin → Audit Log → Sign-ins lists and filters the events. |
| Monitor credential additions, privilege assignments, anomalous app-only activity | **Added: durable admin audit log.** `src/lib/audit.ts` now writes every audited admin action (role changes, bans, payouts, key changes, settings, MFA changes, …) to `AdminAuditLog` as well as the process log, so the record survives log rotation. Viewer at Admin → Audit Log. Agent API calls were already logged per key in `AgentApiCall`. |
| Least privilege on multi-tenant application permissions | **Existing.** Agent API keys carry explicit `agent:read` / `agent:write` scopes; every mutating tool requires `confirm: true`; the support chatbot runs with read scope only. |
| Microsoft Entra / ConnectWise / certificate-authority items | **Not applicable.** No Microsoft 365 tenant, no ConnectWise, no internal CA. |

## 3. Strengthen application protections

| Recommendation | Status |
|---|---|
| Guardrails around high-impact business APIs: rate limits, recipient limits, transaction thresholds; alert when the application operates materially outside normal volume | **Added.** Agent API: per-key rolling-hour counters alert admins at 400 calls or 25 writes (`registry.ts`). Email campaigns: an admin alert when a send targets 2,500+ recipients or is the fourth campaign in an hour (the FBI lists "mass notification/email broadcasts from compromised applications" as an attack characteristic). Existing: per-key rate limits on the Agent API, global and login rate limits in the proxy, confirm-gated writes. |
| Alert on sequential lookups and unusually high numbers of records accessed per session; rate-limit affected endpoints | **Added: record-enumeration detection in the proxy** (`trackRecordEnumeration`). Counts *distinct record ids* touched across `/api/*` per client over ten minutes, which is what an agent walking `/api/projects/<id>`, `/api/pledges/<id>` looks like under the per-minute limit. Anonymous clients are blocked for an hour at 120 records and admins are alerted; signed-in clients are alerted on at 500 records but not blocked, so an admin reviews who was signed in rather than the system locking out a real account. |
| Enforce server-side authorization for access to customer records; limit responses to required fields | **Verified.** All dynamic `/api/*` routes outside admin/cron/webhook paths were checked for an authentication call; every one that returns a person's data uses `validateSession`/`auth()` or the retailer session, and the remaining unauthenticated ones are public campaign data (slug check, public stats, the public v1 project endpoint, file serving). Hosted uploads are served only for an allow-list of MIME types. |
| Do not return stack traces, SQL errors, internal paths or framework details to unauthenticated users | **Verified and tightened.** Public API error responses carry generic messages; the one route that attached `String(error)` (metrics, token-protected) no longer does. Validation errors return field names only. |
| Scan repositories, build artifacts and pipelines for embedded secrets; rotate exposed credentials | **Added.** CI runs gitleaks over the full history on every push and pull request. `scripts/scan-client-bundle.cjs` scans the client JavaScript of every build for key formats (Stripe, Agent API, AWS, Anthropic, Mailgun, SendGrid, private keys, connection strings, server-only env names) and `build-and-swap.sh` refuses to swap a build that fails it. Existing: secrets live in the encrypted vault, never in the repo (the repo is public). |
| Web shells (`*.aspx`, `*.jsp` in unexpected paths); anonymous file upload | **Verified.** Uploads require a session, are written outside the web root and served through `/api/uploads` with an allow-listed MIME map; nothing under it is executable. The proxy now also blocks requests for `.php/.asp/.aspx/.jsp/.cgi` paths and the common scanner dictionaries outright (the Joomla probe that reached the app last week was the trigger for that change). |

## 4. Indicators of compromise

| Indicator class | Action |
|---|---|
| 24 IP addresses (ARTEX hosts, proxies, WISP C2, Storm-3358 infrastructure) | **Blocked** for 90 days via `prisma/migrations/block_artex_flash_20261113_iocs.sql` into the proxy's blocklist, reason-tagged with the advisory number. The FBI notes these addresses are reassignable, hence the expiry rather than a permanent block. |
| `xcai[.]pro` (LLM API reseller) | Outbound only; the server makes no calls to it. Nothing to do. |
| Outbound calls to `api.anthropic.com`, `api.deepseek.com`, `open.bigmodel.cn`, `api.x.ai` | The platform legitimately calls `api.anthropic.com` (AI marketing, support chatbot, Agent API consumers). Calls to the other three would be anomalous; the host's egress is not currently filtered. **Open item**, see below. |
| High-frequency automated requests with sequential enumeration against login/search endpoints | Covered by the login rate limiter, the general rate limiter, and the new distinct-record enumeration detector. |
| Outbound transfers of structured personal data to unauthorized destinations | The enumeration detector is the in-app control for the read side. Egress filtering is the host-level control; **open item**. |

## 5. Evidence preservation

The advisory asks, in the event of an incident, for authentication logs, API activity, rate-limit violations and volume anomalies. After this change the platform holds all of them in the database rather than only in rotating log files: `LoginEvent`, `AdminAuditLog`, `AgentApiCall`, `SuspiciousActivity`, `BlockedIP`, and Sentinel's error groups. The incident response plan in `INFORMATION-SECURITY-POLICY.md` §11 applies; nothing in it conflicts with the FBI's guidance to preserve evidence before irreversible containment.

## 6. Open items (host level, not in this codebase)

1. **Egress allow-list on the host.** Outbound HTTPS from the server could be restricted to the hosts it needs (DivinityCoin, Anthropic, Mailgun/SendGrid, Shopify, GitHub, package registries). This is the control that would catch the "unexpected calls to LLM endpoints" and "data to unauthorized destinations" indicators. It is a firewall change on the host, not an application change.
2. **Turn on the admin two-factor requirement.** Enrol the SUPER_ADMIN device first at Admin → Security → Two-factor, then switch on Settings → Security → "Require two-factor for admin accounts". Until it is on, MFA is available but optional.
3. **gitleaks license.** The CI job runs free for a personal GitHub account; if the repository is ever moved under an organisation it needs a `GITLEAKS_LICENSE` secret.

## 7. Files

- `src/lib/auth/totp.ts`, `src/lib/auth/mfa.ts`, `src/app/api/user/mfa/route.ts`, `src/app/admin/security/mfa/page.tsx`, login changes in `src/lib/auth/actions.ts` and `src/components/auth/login-form.tsx`
- `src/proxy.ts`: admin MFA gate, record-enumeration detection, scanner path patterns
- `src/app/api/internal/session-role/route.ts`, `src/app/api/internal/blocked-ips/route.ts`: MFA requirement lookup, alert-only security events
- `src/lib/audit.ts`, `src/app/api/admin/audit-log/route.ts`, `src/app/admin/audit-log/page.tsx`
- `src/lib/agent-api/registry.ts` (volume alerts), `src/lib/email/campaign-send.ts` (broadcast alert)
- `scripts/scan-client-bundle.cjs`, `build-and-swap.sh` step 6a, `.github/workflows/ci.yml` secret-scan job
- `prisma/migrations/add_mfa_login_events_audit.sql`, `prisma/migrations/block_artex_flash_20261113_iocs.sql`
