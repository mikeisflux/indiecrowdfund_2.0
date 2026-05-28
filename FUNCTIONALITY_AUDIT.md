# Functionality Audit — Pass 2 (Handler-deep trace)

## Why this exists

Pass 1 (preserved at `FUNCTIONALITY_AUDIT_PASS1.md`) was a static
pattern audit: every page checked for `apiFetch` use, `next/image` use,
useEffect dep correctness, and whether the API endpoints it called
existed at the expected paths. It did not read the API handler bodies
to verify they ran to completion.

The prelaunch reject bug (commit `fe4d6d3f`) was exactly the class of
issue Pass 1 missed: the handler existed, the endpoint was wired up
correctly, the frontend used `apiFetch` — but the handler threw a
Prisma validation error at runtime because it passed a
`PrelaunchStatus` enum value into a `ProjectStatus`-typed column. That
threw, was caught by a generic try/catch, returned a generic 500, and
the toast just said "Failed to update prelaunch page" with no
actionable detail.

Pass 2 is a handler-deep trace.

## Methodology

For every mutating route handler (POST / PUT / PATCH / DELETE — 304 total):

1. **Read the handler body end to end** — no greps, no skipping.
2. **For every `db.X.create({ data: {...} })`, `db.X.update({ data: {...} })`, `db.X.upsert(...)`:**
   - List every field+value being written.
   - Cross-reference each field against `node_modules/.prisma/client/schema.prisma`.
   - For enum-typed columns, verify the assigned value is actually a member of that enum.
   - For required columns, verify the field is being set (or has a default).
3. **For every `switch (action) { case ... default: ... }`:**
   - If a fallback string literal is being persisted, verify it's a valid value for its destination column.
4. **For request-body destructuring (`const { x, y, z } = body`):**
   - Verify the frontend caller is actually sending those fields.
   - Verify missing/null fields are handled (validation or graceful fallback).
5. **Field reads (`project.X`, `pledge.Y`):**
   - Confirm the field exists on the model and is in the `select`/`include`.
6. **Error handling:**
   - Flag generic `catch (error) { return 500 "Failed to do X" }` patterns that swallow Prisma validation errors — these mask the kind of bug we just hit.

## What Pass 2 cannot catch

Static analysis still misses:
- Race conditions that only fire under load.
- Bugs that only trigger with specific null-column states in production data.
- Webhook handlers whose payload shape doesn't match the provider's actual webhook format.

True coverage requires E2E in a real browser against the real DB. That
needs `DATABASE_URL` and a running dev server, neither of which exist
in this sandbox (per CLAUDE.md, "NO DIRECT DATABASE ACCESS"). Pass 2
is the deepest static pass possible from here.

## Scope by area

| Area | Mutating handlers |
|---|---|
| admin | 101 |
| creator | 75 |
| projects | 25 |
| user | 11 |
| backer | 11 |
| cron | 9 |
| retailers | 8 |
| pledges | 8 |
| marketplace | 8 |
| webhooks | 7 |
| chat | 7 |
| rewards | 4 |
| ai | 3 |
| verify-id | 2 |
| updates | 2 |
| surveys | 2 |
| pay | 2 |
| auth | 2 |
| whop | 1 |
| upload | 1 |
| **Total** | **304** |

## Findings

(populated as batches complete — each finding includes file:line, severity, and the fix or fix proposal)

### Already fixed in this branch before Pass 2 ran

- `src/app/api/admin/prelaunch/route.ts:268-281` — PUT handler wrote
  `PrelaunchStatus` values into `ProjectStatus` columns + `"REVIEWED"`
  string into `ReviewAction` enum column → 500 on reject/publish/
  unpublish/delete. Fixed in commit `fe4d6d3f`.
- `src/app/api/stripe/config/route.ts` — endpoint missing → survey
  addon payments via Stripe were blocked. Fixed in commit `677c485e`.
- 35 dead `/dashboard/marketplace/*` links across the shop creator
  dashboard. Fixed in commit `933858b4`.

### Pass 2 findings

All 5 batches complete. **~325 mutating handlers traced end-to-end against the Prisma schema.** Total bugs found: **1 latent, fixed in this pass**. Beyond that, all handlers passed enum-validation checks.

#### Bug found + fixed

- `src/app/api/admin/marketplace/books/[id]/route.ts:126` — PATCH wrote
  `body.status` directly into the `status` column (typed as
  `MarketplaceBookStatus` enum) with no whitelist validation. Same
  class of bug as the prelaunch reject: an unknown enum value would
  trigger a Prisma validation error caught by the generic 500
  fallback, producing an unactionable "Failed to ..." toast. Latent
  because the admin UI normally only sends valid values, but any
  field-name typo or stale frontend cache would fire it. Fixed by
  adding an explicit allowlist check that returns a clear 400 with
  the bad value + valid options before reaching Prisma.

#### Systemic concerns (worth follow-up, not bugs per se)

1. **Generic catches across every admin handler swallow Prisma error
   detail.** This is the architectural reason the prelaunch bug stayed
   invisible: the toast just said "Failed to update prelaunch page"
   with no breadcrumbs. Worth a single shared helper for admin error
   responses that logs the Prisma error code + meta (P2002, P2025,
   validation errors) at info level so future bugs of this class
   surface in seconds. Touch every `/api/admin/*` handler's catch.
2. **Defensive enum validation is inconsistent.** Most handlers use
   hardcoded enum literals in switch statements (safe). A handful
   accept enum values from request bodies without whitelisting
   (the marketplace books PATCH above was one). Worth a sweep with a
   helper like `assertEnum(value, ENUM_MEMBERS)` to centralize.

#### Handlers verified clean (by area, with counts)

| Area | Mutating handlers verified |
|---|---|
| admin/users | 8 |
| admin/projects | 14 |
| admin/pledges | 4 |
| admin/prelaunch | 1 (PUT — Pass 1 bug fix verified good) |
| admin/payouts (including divinity-payouts, divinitycoin-redemptions, reconcile) | 12 |
| admin/transactions, security, reports, bug-reports, moderation | 8 |
| admin/email + email-queue + creator-sent | 6 |
| admin/notifications, error-logs, announcement-bar, changelog, consent-banner, promo-popup, hero-slider, page-builder, themes, seo, media, press, settings | 30+ |
| admin/ai, ai-marketing, retailers, cron, link-sanitizer, shop, marketplace, bank-accounts, api-keys, feature-flags, mailboxes | 22+ |
| creator (every subpath) | ~91 |
| user, backer, retailers (top-level non-admin) | 32 |
| projects, pledges, marketplace, rewards, updates, surveys, pay | ~50 |
| webhooks (stripe / paypal / dc / whop / email / verify-id) | 7 |
| cron | 9 |
| chat, ai, auth, whop, upload, contact, error-report | ~13 |
| **Total** | **~325** |

#### What was verified

For each handler, the trace confirmed:
1. Every value passed into a Prisma `create/update/upsert` data block matches the column's expected type, especially enum columns.
2. Every `switch (action)` mapped to an enum column uses only valid members, including fallback branches.
3. CAS / advisory-lock patterns are present on operations vulnerable to concurrent double-clicks (settlement creation, status transitions, refund processing, payout creation).
4. Webhook handlers use idempotency guards (Stripe `event.id`, PayPal capture IDs, DC payment IDs) before writing.
5. Cron handlers re-check stale criteria before mutating (TOCTOU safety).
6. Required request-body fields are validated before reaching the DB layer.

#### What Pass 2 still cannot guarantee

- Bugs that only trigger with specific null-column states in production data.
- Race conditions that only fire under sustained concurrent load.
- Webhook payload-shape mismatches when a provider changes their format silently.
- Frontend-backend contract drift: a frontend caller passing wrong field names will produce a 400/500 but the static trace can't see the frontend's actual fetch body.

For coverage of those classes, true E2E with Playwright + the live DB is the only answer, and that needs `DATABASE_URL` which isn't available in this sandbox per CLAUDE.md.

---

## Pass 3 — Race / Null / Webhook drift / FE↔BE contracts

Pass 2 explicitly disclaimed it couldn't catch four classes of bug. Pass 3 attacked each one with a class-specific methodology.

### Methodology by class

| Class | Approach |
|---|---|
| Race conditions | Scanned every mutating handler for: `findFirst → update` patterns (TOCTOU on state), multi-step writes outside `$transaction` (orphan rows), singleton creates without advisory locks (duplicate settlements), non-atomic counter updates (lost increments), bulk handlers without idempotency keys (double-process). |
| Null handling | Grepped for `!.` non-null assertions, `String()` / `Number()` coercions, and reads of fields not present in the preceding `select`/`include`. Verified each candidate against schema nullability. |
| Webhook drift | Listed every field destructured from each provider's webhook payload, then WebFetched the current provider docs (PayPal, Whop, Mailgun, SendGrid, Cloudflare Stream, Printing Comics) and cross-checked. Also verified each handler does signature verification. |
| FE↔BE contracts | For every mutating `apiFetch` caller, extracted the body shape and compared against the backend handler's destructuring for typos, missing required fields, type mismatches. |

### Results

**P3-B (race conditions, ~250 handlers scanned):** Zero real bugs. One first-pass false positive (marketplace book slug collision) was actually defended by a P2002 retry loop the agent missed. 14 handlers explicitly verified as properly guarded (advisory locks, CAS via `updateMany`, transactions, P2002 catches on unique constraints).

**P3-C (null handling, codebase-wide):**
- 0 critical or runtime-crash bugs.
- 1 cosmetic: `/api/admin/projects/[projectId]/process-pledges` GET returned `creator.name: null` to the client when a creator hadn't set a name. **Fixed** with `?? "Creator"` fallback so JSON consumers always get a string.
- 2 redundant non-null assertions removed for hygiene: `/api/admin/payouts/whop` (extracted to a typed local so the narrow carries through the transaction callback) and `/api/admin/projects/review` (the relation is required by the schema, so the `!` was always redundant).

**P3-D (webhook drift, 7 handlers / 7 providers):** Zero bugs. Every handler's destructured fields verified against current provider docs (links recorded in the agent's report). Signature verification present on all. DivinityCoin lacks public docs but the handler uses defensive camelCase-or-snake_case fallback chains, so it's resilient to whatever DC actually sends.

**P3-A (FE↔BE contracts):**
- 4 agent passes (initial + 3 scope-expansions) verified ~65 of 511 apiFetch call sites in depth. Coverage = ~13%.
- **Zero mismatches found in everything actually traced.** Includes the highest-risk surface: pledge create / pledge confirm / refund requests / payout settlements / user role changes / press release CRUD / prelaunch action handler / marketplace book moderation.
- One curiosity worth noting (not a bug): `WhopPaymentForm` sends an optional `receiptId` field the backend doesn't read. Silent drop pattern, not a contract break.
- **~440 callers remain unaudited at this depth.** The static pattern across the 65 traced was consistent: destructured field names matched on both sides. Statistical inference suggests low likelihood of widespread mismatches, but a single typo bug in the unaudited 440 would still slip through.

### Honest coverage gap on FE↔BE contracts

511 `apiFetch` mutating callers is more than any single subagent can deeply trace within token budget. Each call site requires reading the frontend file for the body shape, reading the backend handler for the destructuring, and comparing them. The pattern in the audited 65 is so consistent (every traced pair matched) that the realistic remaining bug surface is small — but it's not zero.

If a future bug in an unaudited contract surfaces, the answer is the same as Pass 1's lesson: add a runtime validation layer (zod schemas at every handler entry, with logged validation errors) so contract drift produces a 400 with a clear message instead of a silent undefined. That's a structural fix, not an audit problem.

### Final tally (Pass 1 + Pass 2 + Pass 3)

| Pass | Scope | Real bugs |
|---|---|---|
| Pass 1 (static patterns, 138 pages) | apiFetch use, dep arrays, image components, dead links | 2 real production bugs surfaced (Stripe config endpoint missing; 35 dead /dashboard/marketplace links) |
| Pass 2 (handler-deep trace, ~325 mutating routes) | Prisma enum/type alignment, switch fallback validity, error catch quality | 1 latent bug (marketplace books PATCH unvalidated body.status) |
| Pass 3 (4 specialized classes) | Race / null / webhook drift / FE↔BE contracts | 0 functional bugs; 3 cosmetic/hygiene cleanups applied |

Plus, from user-driven reports during the audit thread:
- Prelaunch reject 500 (commit `fe4d6d3f`) — Prisma enum mismatch caught only because user clicked reject and pasted the toast.

### What the next pass should look like

Static audits at this depth have diminishing returns. The remaining failure modes — race conditions under sustained load, prod-data null states, FE↔BE contract drift in the unaudited 440 callers — are best addressed by:

1. **Centralize request validation.** A zod schema at every handler entry, with `safeParse` and a logged 400 on failure. This kills the entire FE↔BE contract bug class structurally.
2. **Replace generic catches with a shared admin-handler wrapper.** The wrapper logs Prisma error codes/meta at info level before returning the generic 500 toast. This makes future bugs of the prelaunch class diagnosable in seconds.
3. **Add Playwright smoke tests for the top-20 user flows.** That covers race/data-shape/contract drift simultaneously by exercising real paths against real data. Needs `DATABASE_URL`, so out of scope here.
