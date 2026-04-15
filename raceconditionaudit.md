# Race Condition Audit — IndieCrowdfund

**Date started:** 2026-04-15
**Status:** In progress
**Goal:** Systematically audit every source file for race conditions and add guards
preventing them from occurring.

---

## What we're hunting for

This audit looks for these categories of race conditions:

### 1. Check-then-act (TOCTOU)
The classic pattern: read a value, make a decision, then write based on that decision —
without holding a lock in between. Between the read and the write, another request can
change the value, invalidating the decision.

```ts
// ❌ RACE: between the check and the update, another request can claim the slot
const reward = await db.reward.findUnique({ where: { id } });
if (reward.quantityClaimed < reward.quantityAvailable) {
  await db.reward.update({
    where: { id },
    data: { quantityClaimed: reward.quantityClaimed + 1 },
  });
}

// ✅ ATOMIC: compare-and-swap in one query
const result = await db.$executeRaw`
  UPDATE "Reward"
  SET "quantityClaimed" = "quantityClaimed" + 1
  WHERE id = ${id} AND "quantityClaimed" < "quantityAvailable"
`;
if (result === 0) throw new Error("Sold out");
```

### 2. Read-modify-write on counters
Reading a count, incrementing in JavaScript, writing back. Concurrent requests both read
the same value and both write `N+1`, losing one increment.

```ts
// ❌ RACE: two concurrent calls both read count=5, both write count=6 → count=6 (lost one)
const project = await db.project.findUnique({ where: { id } });
await db.project.update({
  where: { id },
  data: { backerCount: project.backerCount + 1 },
});

// ✅ ATOMIC: Prisma's increment operator, SQL handles the race
await db.project.update({
  where: { id },
  data: { backerCount: { increment: 1 } },
});
```

### 3. Missing transactions on multi-step DB writes
Two related writes that should either both succeed or both fail. If the process crashes
between them (or the DB connection drops), the system is left inconsistent.

```ts
// ❌ INCONSISTENT: if the second query fails, we've charged but not recorded the pledge
await stripe.paymentIntents.confirm(piId);
await db.pledge.update({ where: { id }, data: { status: "COMPLETED" } });

// ✅ CONSISTENT: rollback the pledge update if anything downstream fails
await db.$transaction(async (tx) => {
  await tx.pledge.update({ where: { id }, data: { status: "COMPLETED" } });
  await tx.project.update({ where: { id: pledge.projectId }, data: { backerCount: { increment: 1 } } });
});
```

### 4. Webhook idempotency
Webhook providers (Stripe, PayPal, Whop, Mailgun) guarantee at-least-once delivery.
If a handler runs twice, state updates must be idempotent — otherwise stats get
double-counted, refunds get double-applied, emails get sent twice, etc.

### 5. Rate limiters and counters in memory
In-process `Map` rate limiters or counters are not shared across PM2 cluster workers,
so they don't actually rate-limit anything globally. Worse, concurrent requests on
the *same* worker can race on `Map.set`.

### 6. State machine transitions
A pledge goes PENDING → COMPLETED → REFUNDED. Concurrent calls can try to refund a
pledge that's mid-cancellation, causing double-refunds or lost state. Every transition
needs a compare-and-swap guard on the "from" state.

### 7. Email/notification queues without atomic claim
Queue processors that `findFirst` + `update` instead of `UPDATE ... RETURNING` can
have two workers claim the same item and send the same email twice.

### 8. Caching key races
Reading from a cache, computing if missing, writing to the cache — without a lock.
Two concurrent requests both miss, both compute, both write. Usually benign for reads
but can be catastrophic for writes ("cache stampede").

### 9. File I/O races
Two requests writing to the same file (e.g. uploaded avatar) can interleave partial
writes. Usually needs atomic `rename` from a temp file.

### 10. Lock-free upserts
`findFirst + create` is NOT the same as `upsert` — the former has a TOCTOU window
where two requests both miss the findFirst and both try to create.

---

## Audit conventions

As we audit each file, we mark the checkbox next to it with the outcome:

- `- [ ]` — not yet audited
- `- [x]` — audited, no race conditions found
- `- [!]` — audited, race condition found and fixed in this commit
- `- [?]` — audited, suspicious code flagged but requires investigation
- `- [~]` — audited, race condition found but fix deferred (documented below)

Files are marked `- [x]` if they are:
- Pure presentational components (no state transitions, no DB writes)
- Type definition files
- Static data files
- Simple utility functions with no shared mutable state
- Files that only read from the database (reads can't have write-write races)

---

## Audit findings log

This section is appended to as we discover and fix race conditions. Each finding gets:
- **File:** path
- **Pattern:** which of the 10 categories above
- **Impact:** what could go wrong in production
- **Fix:** what we did (or what needs to be done)
- **Commit:** hash

(See below for findings as they're added.)

---


## Audit progress

**Session 1 (2026-04-15):** Audited 19 highest-risk files covering all payment
flows (Stripe, PayPal, Whop, DivinityCoin is pass-through), all webhook handlers,
all cron jobs, the email queue processor, middleware rate limiters, and the core
reward-claiming utilities.

- Files fully audited and clean: **13** (marked `[x]`)
- Files audited and fixed: **6** (marked `[!]`)
- Files remaining: **1,139** — primarily:
  - UI components (most cannot have race conditions in the traditional sense)
  - Simple CRUD API routes (many don't have complex state transitions)
  - Lib utilities (many are pure functions)
  - Type definition files
  - Test files and test data

The highest-risk 19 files are done. The remaining 1139 are a long-tail audit
that needs a follow-up session. Most of them won't have races, but confirming
that rigorously requires reading each one.

## Findings log

### Finding #1 — Stripe webhook `handlePaymentSuccess` TOCTOU
**File:** `src/lib/payments/stripe/webhooks.ts`
**Pattern:** (1) check-then-act + webhook idempotency
**Impact:** Stripe webhooks deliver at-least-once. On retry, the handler would
re-read `status !== COMPLETED`, re-execute the plain `pledge.update` (which
always succeeds), then re-fire side effects:
- `trackCampaignConversion` → `EmailCampaign.conversionCount` double-incremented
- `addToCreatorEmailList` → safe (upsert-pattern with P2002 catch, but wasted call)
- Stats update is protected by CAS on `confirmationEmailSent` so that part was OK

The downstream CAS at line 130-133 protected stats from double-counting, but
`trackCampaignConversion` and `addToCreatorEmailList` happened BEFORE that
CAS, so they double-fired.

**Fix:** Added a compare-and-swap on `status: { not: "COMPLETED" } → "COMPLETED"`
at the top of the handler, before any side effects. Re-fetch the pledge with
relations only if the CAS wins. All subsequent side effects now only fire for
the race winner.

### Finding #2 — PayPal `PAYMENT.CAPTURE.REFUNDED` non-atomic refund
**File:** `src/app/api/webhooks/paypal/route.ts`
**Pattern:** (1) check-then-act + (6) state machine transition without CAS
**Impact:** PayPal webhooks are at-least-once. Two concurrent refund events
could both `findFirst` the COMPLETED pledge, both `pledge.update` it to
REFUNDED, and both decrement `backerCount`, `currentAmount`, and
`quantityClaimed` — **double-refund accounting**.

**Fix:** Replaced plain `pledge.update` with `updateMany` CAS on
`status: "COMPLETED" → "REFUNDED"`. If count === 0, we lost the race and
skip the decrements.

### Finding #3 — Whop `refund_created` non-atomic refund
**File:** `src/app/api/webhooks/whop/route.ts`
**Pattern:** same as Finding #2
**Impact:** same as Finding #2, but on Whop retries
**Fix:** same pattern — `updateMany` CAS on status transition

### Finding #4 — Email events webhook bounce/spam findFirst-then-create
**File:** `src/app/api/webhooks/email/events/route.ts`
**Pattern:** (10) lock-free upsert
**Impact:** Mailgun webhooks are at-least-once. Two concurrent bounce events
for the same email would both miss the findFirst, both try to create, and
the second would fail with P2002 (EmailBlocklist has `@@unique([type, value])`).
The handler didn't catch P2002, so the webhook returned 500, Mailgun retried,
loop — not catastrophic but noisy error logs and failed webhook acks.

**Fix:** Replaced both `handleBounce` and `handleSpamComplaint` with atomic
Prisma `upsert` calls. Fully idempotent regardless of delivery count.

### Finding #5 — Scheduled campaigns cron overlap
**File:** `src/app/api/cron/scheduled-campaigns/route.ts`
**Pattern:** (1) check-then-act + cron overlap
**Impact:** If a cron run takes longer than the schedule interval (possible
for large subscriber lists), the next cron tick fires while the previous is
still running. Both `findMany` the same SCHEDULED campaigns, both `update`
them to SENDING, both send — **backer receives the same campaign email twice**.

**Fix:** Per-campaign `updateMany` CAS on `status: "SCHEDULED" → "SENDING"`.
If count === 0 for a campaign, the other cron tick already claimed it and
this run skips to the next campaign.

### Finding #6 — chargeSavedPledge triple TOCTOU on status completion
**File:** `src/lib/payments/stripe/charges.ts`
**Pattern:** (1) check-then-act in 3 separate code branches
**Impact:** `chargeSavedPledge` is called from three different places:
1. `/api/pledges/[pledgeId]/confirm/route.ts` (user-facing)
2. `/api/cron/process-funded-campaigns/route.ts` (cron)
3. `src/lib/payments/stripe/webhooks.ts` (webhook)

All three can fire near-concurrently when a project just funded. Stripe's
idempotency keys prevent **the actual charge** from firing twice, but the
function's local state updates (`pledge.status = COMPLETED` + side effects
`trackCampaignConversion`, `notifyBackerPledgeConfirmed`, metrics) were
not CAS-guarded. Three separate branches in the function hit this bug:

- Line 74-89: "PaymentIntent already succeeded" branch
- Line 114-134: "requires_confirmation then confirms to succeeded" branch
- Line 268-307: main "freshly created PaymentIntent succeeded" branch

All three would double-fire `trackCampaignConversion` and
`notifyBackerPledgeConfirmed` if two concurrent callers raced.

**Fix:** Added a `updateMany` CAS on `status: "PENDING" → "COMPLETED"` to
each of the three branches. Side effects only fire for the caller that wins
the CAS. `assignBackerNumber` was already row-locked and idempotent, so the
backer number logic was moved BEFORE the CAS and called unconditionally.

### Finding #7 — admin/pledges cancel + 4 refund branches TOCTOU (session 2)
**File:** `src/app/api/admin/pledges/[pledgeId]/route.ts`
**Pattern:** (1) check-then-act + (6) state machine transitions
**Impact:** Admin cancel path: two concurrent cancels of the same PENDING
pledge would both decrement project counters and reward slots. Four refund
branches (DC/PayPal/Whop/Stripe): concurrent admin refunds of the same
COMPLETED pledge would both call the provider refund API (provider
idempotency saves the refund itself, but backerCount/currentAmount/
quantityClaimed would get decremented twice).

**Fix:** CAS on `status: "PENDING" → "CANCELLED"` for cancel, CAS on
`status: "COMPLETED" → "REFUNDED"` for refund. `wonCas` flag controls
reward slot restoration so it only runs for the admin that wins.

### Finding #8 — creator/pledges cancel + DC/Stripe refunds TOCTOU (session 2)
**File:** `src/app/api/creator/pledges/[pledgeId]/route.ts`
**Pattern:** same as #7
**Fix:** CAS on status transitions. DC and Stripe refund branches throw
from inside the transaction on CAS loss so DivinityCoinTransaction and
FulfillmentActivity side-effect rows are rolled back with the main tx.

### Finding #9 — backer-facing pledges cancel/refund/DELETE TOCTOU (session 2)
**File:** `src/app/api/pledges/[pledgeId]/route.ts`
**Pattern:** same as #7, backer-triggered
**Fix:** 3 branches CAS-guarded. Returns `alreadyRefunded`/`alreadyCancelled`
flags for idempotent client UX on double-clicks.

### Finding #10 — creator refund-request approve TOCTOU (session 2)
**File:** `src/app/api/creator/refund-requests/[requestId]/route.ts`
**Pattern:** same as #7
**Fix:** Approve flow CAS on `status: "COMPLETED" → "REFUNDED"`. Reward
slot restoration gated on `wonCas` flag.

### Finding #11 — cron process-failed-campaigns FUNDED/FAILED transitions (session 2)
**File:** `src/app/api/cron/process-failed-campaigns/route.ts`
**Pattern:** (1) TOCTOU + cron overlap
**Impact:** FUNDED transition without CAS would double-fire `notifyProjectFunded`
and clear prelaunch fields twice under cron overlap. FAILED transition would
attempt to refund the same pledges twice since the downstream refund loops
only had per-pledge guards, not project-level guards for the DC API call
and notification fires.
**Fix:** CAS on `status: "LIVE" → "FUNDED"` / `"LIVE" → "FAILED"` at the top
of each loop iteration. Removed the duplicate `project.update` at the old
bottom of the FAILED branch.

### Finding #12 — PayPal captureAuthorizedPaypalPledges triple TOCTOU (session 2)
**File:** `src/lib/payments/paypal/capture-authorized.ts`
**Pattern:** (1) check-then-act in 3 branches
**Impact:** Called from funded-campaign trigger AND cron — both can race
when a project funds. All 3 branches (capture failed, capture not COMPLETED,
success) would double-decrement or double-increment project stats.
**Fix:** CAS on `status: "PENDING"` in each branch. Side effects gated
on CAS win.

### Finding #13 — admin/cleanup-pledges delete ordering + cancel branch (session 2)
**File:** `src/app/api/admin/cleanup-pledges/route.ts`
**Fix:** Delete branch reordered so `pledge.delete` runs BEFORE the counter
decrement inside the transaction (P2025 rolls the whole tx back on a lost
race). Cancel branch gated with `wonCancelCas` flag.

### Finding #14 — marketplace checkout/verify notification double-fire (session 2)
**File:** `src/app/api/marketplace/checkout/verify/route.ts`
**Impact:** User opens return URL in two tabs, or network retries → two
concurrent verify calls both pass the `status === "COMPLETED"` early return,
then both fire `notifyMarketplacePurchase` + `notifyMarketplaceSale`,
sending duplicate in-app notifications and duplicate emails to both the
buyer and the seller.
**Fix:** Moved both notification calls inside the `if (updated.count > 0)`
guard so they only fire for the call that actually flipped status PENDING
→ COMPLETED.

### Finding #15 — project submit TOCTOU creating duplicate ProjectReview (session 3)
**File:** `src/app/api/projects/[id]/submit/route.ts`
**Impact:** Two concurrent submit calls (double-click, retry) would both
pass the `status === "DRAFT" | "APPROVED"` check, both flip status to
SUBMITTED, and both create `ProjectReview` rows — duplicate review records
for the same transition, which pollutes the admin review queue.
**Fix:** CAS on `status: { in: ["DRAFT", "APPROVED"] } → "SUBMITTED"` before
the ProjectReview.create. Return 409 on CAS loss.

### Finding #16 — project item end TOCTOU (session 3)
**File:** `src/app/api/projects/[id]/items/[itemId]/end/route.ts`
**Fix:** CAS on `endedAt: null` — prevents the second concurrent end-item
request from overwriting the first one's `endedAt` timestamp.

### Finding #17 — project survey lock TOCTOU (session 3)
**File:** `src/app/api/projects/[id]/survey/lock/route.ts`
**Fix:** CAS on survey `status: "SENT" → "LOCKED"` so concurrent lock
requests can't overwrite `lockedAt` and double-run the bulk `addressLocked`
update.

### Finding #18 — project survey send TOCTOU creating duplicate responses/notifs (session 3)
**File:** `src/app/api/projects/[id]/survey/send/route.ts`
**Impact:** Two concurrent "Send Survey" clicks would both pass the status
check, both enter the transaction, both create SurveyResponse rows (the
`findUnique + create` inside the loop only catches duplicates within one
invocation), and both fire `notifySurveySent` to every backer — duplicate
in-app notifications + duplicate emails.
**Fix:** CAS on `status: { notIn: ["SENT", "LOCKED"] } → "SENT"` *before*
the response-creation transaction. Notifications gated on CAS win.

### Finding #19 — project rewards delete TOCTOU allowing orphaned pledges (session 3)
**File:** `src/app/api/projects/[id]/rewards/route.ts`
**Impact:** Creator hits "Delete Reward" while the reward has
quantityClaimed === 0. Between the check and the delete, a backer's
pledge flow claims the reward slot. The delete would succeed and orphan
the backer's PledgeAddon row (its Reward is gone).
**Fix:** Moved the delete into a transaction that ends with a CAS
`deleteMany` on `quantityClaimed: 0`. If the CAS fails (a backer claimed
in the meantime), the whole transaction rolls back and we return 400.

### Finding #20 — project collaborators invite case-insensitive TOCTOU (session 3)
**File:** `src/app/api/projects/[id]/collaborators/route.ts`
**Impact:** Two concurrent invite requests for the same email would both
pass the case-insensitive findFirst check, one would succeed, the other
would P2002 and return a generic 500.
**Fix:** Normalized email to lowercase before insert (so case variants
hit the same @@unique), and added a P2002 catch that returns a 409.

### Finding #21 — project create slug TOCTOU (session 3)
**File:** `src/app/api/projects/route.ts`
**Impact:** Two projects with the same auto-generated slug (identical
titles submitted concurrently) would race on the `slug` @unique. First
succeeds, second returns 500 instead of retrying with a unique suffix.
**Fix:** Create inside a P2002 retry loop (up to 5 attempts) that appends
a random suffix on collision. Custom slugs still return 409 immediately
so the user can pick a different URL.

### Finding #22 — reward end TOCTOU (session 3)
**File:** `src/app/api/rewards/[id]/end/route.ts`
**Fix:** CAS on `isEnded: false → true` so concurrent "End Reward" clicks
don't overwrite each other's `endedAt` timestamps.

### Finding #23 — user vanity URL set TOCTOU (session 3)
**File:** `src/app/api/user/vanity-url/route.ts`
**Impact:** Two different users claiming the same vanity URL concurrently:
first succeeds, second P2002 returns 500. Same user racing their own
"set once" guard could theoretically overwrite.
**Fix:** `updateMany` CAS on `vanityUrl: null` for the same-user guard,
P2002 catch for the cross-user collision → returns 409.

### Finding #24 — user follow-project TOCTOU double-increment (session 3)
**File:** `src/app/api/user/following/route.ts`
**Impact:** Two concurrent follow requests for the same project would
both pass the existing-follow check, both call `projectFollower.create`
(one fails with P2002), AND both call `followerCount: { increment: 1 }`
— resulting in a follower count that's 1 higher than the actual count.
**Fix:** Replaced the check-then-create with a try/catch on P2002. Only
the request that actually inserted the row runs the `followerCount`
increment.

### Finding #25 — backer address isDefault race (session 3)
**Files:** `src/app/api/backer/addresses/route.ts`,
          `src/app/api/backer/addresses/[id]/route.ts`
**Impact:** Two concurrent "set as default" requests would both clear
existing defaults then both set the new ones as default — leaving the
user with multiple `isDefault: true` rows.
**Fix:** Wrapped the clear-then-create (or clear-then-update) in a single
`$transaction` so the operations are atomic per row-lock scope.

### Finding #26 — backer reviews TOCTOU upsert (session 3)
**File:** `src/app/api/backer/reviews/route.ts`
**Impact:** Backer rapidly submits review edits → findUnique + create
would P2002 on concurrent calls (pledgeId is @unique).
**Fix:** Replaced with a proper Prisma `upsert` on pledgeId.

### Finding #27 — retailer apply email TOCTOU (session 3)
**File:** `src/app/api/retailers/apply/route.ts`
**Impact:** Double-submitted application form: first succeeds, second
P2002 returns 500.
**Fix:** P2002 catch returns 409 with "already exists" message.

### Finding #28 — creator indiekit campaign send TOCTOU (session 3)
**File:** `src/app/api/creator/indiekit/campaigns/route.ts`
**Impact:** "Send Campaign" double-click would pass the status check
twice and queue the background send job twice.
**Fix:** CAS `updateMany` on `status: { notIn: ["SENDING", "SENT"] }`.

### Finding #29 — admin project review TOCTOU creating duplicate reviews (session 4)
**File:** `src/app/api/admin/projects/review/route.ts`
**Impact:** Two admins clicking Approve/Reject on the same project at
the same time would both pass the `status !== "SUBMITTED"` check, both
flip status, both create duplicate `ProjectReview` rows, both fire the
approval email, both notify search engines, and if it's a prelaunch
approval, both promote the creator's role.
**Fix:** CAS on `status: "SUBMITTED"` (or `prelaunchStatus: <current>`)
before the ProjectReview.create and side effects. Return 409 on CAS loss.

### Finding #30 — admin marketplace book review TOCTOU (session 4)
**File:** `src/app/api/admin/marketplace/books/[id]/review/route.ts`
**Impact:** Two admins reviewing a marketplace book simultaneously
would both flip status, create duplicate `MarketplaceBookReview` rows,
double-notify search engines, double-promote creator to CREATOR role,
and fire `notifyMarketplaceBookReview` twice (duplicate emails to
creator).
**Fix:** CAS on `status: "PENDING_REVIEW" → "LIVE"/"REJECTED"`.

### Finding #31 — admin ai-marketing campaign send TOCTOU (session 4)
**File:** `src/app/api/admin/ai-marketing/campaigns/manage/[id]/send/route.ts`
**Impact:** Two admins (or double-click) clicking "Send" on the same
campaign would both pass the `SENDING`/`SENT` check and both queue
every recipient email — doubling the send to every subscriber/user
on the target audience. This would be 2000+ duplicate emails for a
platform-wide send.
**Fix:** CAS `updateMany` on `status: { notIn: ["SENDING", "SENT"] } →
"SENDING"` before the recipient loop. Resend mode relaxes the guard
to allow SENT but still blocks concurrent SENDING.

### Finding #32 — email open tracking double-count via pixel prefetch (session 4)
**File:** `src/app/api/email/track/open/route.ts`
**Impact:** Not a data-corruption race but a stats-inflation race.
Every pixel fetch incremented `EmailCampaign.openCount` unconditionally.
Mail clients (Gmail, Outlook, Apple Mail) proxy-prefetch images when
the user first sees the email in the inbox list, then prefetch again
when opening — often inflating openCount by 2-10x the real number of
opens. The EmailLog had a `openedAt: null` guard but openCount didn't.
**Fix:** Reordered so `emailLog.updateMany` with the `openedAt: null`
CAS runs first. Only increment `openCount` if we actually recorded
a first-open (`logResult.count > 0`).

### Finding #33 — admin payouts create (Stripe) TOCTOU (session 5)
**File:** `src/app/api/admin/payouts/route.ts`
**Impact:** Two admins clicking "Create Payout" simultaneously would
both pass the `findFirst` existence check and both create Payout rows
for the same projectId+type. Each row is then independently flipped
to PROCESSING and the payment processor call fires — real money
double-processed.
**Fix:** Wrapped the check+create in a `$transaction` guarded by a
Postgres `pg_advisory_xact_lock` keyed to `payout-${projectId}-${type}`.
The advisory lock is automatically released at commit/rollback. Inside
the lock, re-check and throw a sentinel error if a duplicate is found.

### Finding #34 — admin payouts create (PayPal) no existence check at all (session 5)
**File:** `src/app/api/admin/payouts/paypal/route.ts`
**Impact:** Worse than #33 — this endpoint had NO existence check
whatsoever. A double-click created two PayPalPayout rows with the
same gross amount, both pending manual ACH transfer. The admin would
see two rows and potentially transfer twice.
**Fix:** Added advisory-lock-guarded `$transaction` with an
existence check for PENDING/PROCESSING/COMPLETED PayPalPayouts.

### Finding #35 — admin DC settlement create (session 5)
**File:** `src/app/api/admin/payouts/divinitycoin/route.ts`
**Impact:** Creates COMPLETED settlement immediately (not PENDING),
and fires the payout-created creator email. Double-click would fire
two creator emails and create two COMPLETED settlement rows inflating
the "totalAmountSettled" stat. DC settlements can legitimately be
multiple per project (partial payouts), so the guard uses a 60-second
window: same amount + same project within 60s is treated as a dupe.
**Fix:** Advisory-lock-guarded `$transaction` with a "recent same-amount
settlement" check returning 409 if found.

---

### Not-yet-fixed / architectural notes

- **Middleware in-memory rate limiters** — the 4 `Map` rate limiters in
  `src/middleware.ts` are per-worker. With 4 PM2 workers, an attacker can
  hit 4× the rate limit by round-robining across workers. This is a
  coordination failure between workers, not a per-request race. Fixing
  would require Redis or similar shared state. Deferred.
- **confirmationEmailSent dual-use** — this flag serves two orthogonal
  concerns (stats de-dup + historical "email attempted" marker). The
  EmailLog-based reconciliation we added in commit `1935c36f` + `56280fcc`
  makes the email-delivered concern use EmailLog as source of truth. The
  flag stays for stats de-dup only. Documented in the confirm route and
  both webhook handlers.

---

## Complete file tree

- [ ] **prisma/**
  - [ ] **schema/**
    - [ ] analytics.prisma
    - [ ] base.prisma
    - [ ] content.prisma
    - [ ] email.prisma
    - [ ] fulfillment.prisma
    - [ ] marketplace.prisma
    - [ ] misc.prisma
    - [ ] payment.prisma
    - [ ] payout.prisma
    - [ ] platform.prisma
    - [ ] pledge.prisma
    - [ ] project.prisma
    - [ ] retailer.prisma
    - [ ] review.prisma
    - [ ] reward.prisma
    - [ ] seo.prisma
    - [ ] survey.prisma
    - [ ] user.prisma
- [ ] **public/**
  - [ ] pdf.worker.min.mjs
- [ ] **scripts/**
  - [ ] cleanup-incomplete-pledges.ts
  - [ ] cleanup-invalid-emails.ts
  - [ ] convert-to-webp.js
  - [ ] extract-changelog-from-git.ts
  - [ ] fix-campaign-images.js
  - [ ] fix-webp-urls.js
  - [ ] import-comic-shops.ts
  - [ ] populate-changelog.ts
  - [ ] setup-users.ts
  - [ ] test-r2-connection.ts
- [ ] **src/**
  - [ ] **app/**
    - [ ] **(auth)/**
      - [ ] **choose-role/**
        - [ ] choose-role-client.tsx
        - [ ] page.tsx
      - [ ] **forgot-password/**
        - [ ] page.tsx
      - [ ] **login/**
        - [ ] loading.tsx
        - [ ] page.tsx
      - [ ] **register/**
        - [ ] loading.tsx
        - [ ] page.tsx
      - [ ] **reset-password/**
        - [ ] page.tsx
      - [ ] layout.tsx
    - [ ] **@modal/**
      - [ ] **(.)login/**
        - [ ] page.tsx
      - [ ] **(.)register/**
        - [ ] page.tsx
      - [ ] default.tsx
    - [ ] **[vanityname]/**
      - [ ] **[slug]/**
        - [ ] page.tsx
    - [ ] **about-us/**
      - [ ] layout.tsx
      - [ ] page.tsx
    - [ ] **access-denied/**
      - [ ] page.tsx
    - [ ] **admin/**
      - [ ] **ai/**
        - [ ] **components/**
          - [ ] ResultsViewerDialog.tsx
          - [ ] StatusBadges.tsx
          - [ ] index.ts
        - [ ] page.tsx
        - [ ] types.ts
      - [ ] **ai-marketing/**
        - [ ] page.tsx
      - [ ] **analytics/**
        - [ ] **components/**
          - [ ] GeographyTab.tsx
          - [ ] OverviewTab.tsx
          - [ ] ProjectsAnalyticsTab.tsx
          - [ ] RevenueTab.tsx
          - [ ] TrafficTab.tsx
        - [ ] page.tsx
      - [ ] **announcement-bar/**
        - [ ] page.tsx
      - [ ] **bug-reports/**
        - [ ] page.tsx
      - [ ] **changelog/**
        - [ ] page.tsx
      - [ ] **consent-banner/**
        - [ ] page.tsx
      - [ ] **cron/**
        - [ ] page.tsx
      - [ ] **divinitycoin-redemptions/**
        - [ ] page.tsx
      - [ ] **email/**
        - [ ] **components/**
          - [ ] ComposeEmailDialog.tsx
          - [ ] MailboxDialog.tsx
          - [ ] index.ts
          - [ ] types.ts
        - [ ] page.tsx
      - [ ] **email-queue/**
        - [ ] page.tsx
      - [ ] **error-logs/**
        - [ ] **components/**
          - [ ] ErrorDetailDialog.tsx
          - [ ] ErrorFilters.tsx
          - [ ] ErrorTable.tsx
          - [ ] helpers.tsx
          - [ ] types.ts
        - [ ] page.tsx
      - [ ] **hero-slider/**
        - [ ] page.tsx
      - [ ] **lcs-locator/**
        - [ ] page.tsx
      - [ ] **link-sanitizer/**
        - [ ] page.tsx
      - [ ] **marketplace/**
        - [ ] **components/**
          - [ ] AddToCategoryDialog.tsx
          - [ ] AllBooksTab.tsx
          - [ ] BookDetailPanel.tsx
          - [ ] BookListItem.tsx
          - [ ] BookListPanel.tsx
          - [ ] CategoryBookItem.tsx
          - [ ] CategoryManagementTab.tsx
          - [ ] HistoryTab.tsx
          - [ ] PdfManagementTab.tsx
          - [ ] RejectDialog.tsx
          - [ ] StatsCards.tsx
          - [ ] StatusBadges.tsx
          - [ ] TransactionsTab.tsx
        - [ ] page.tsx
        - [ ] types.ts
      - [ ] **media/**
        - [ ] **components/**
          - [ ] EditFileDialog.tsx
          - [ ] MoveFilesDialog.tsx
          - [ ] NewFolderDialog.tsx
          - [ ] ScanImportDialog.tsx
          - [ ] UploadDialog.tsx
          - [ ] index.ts
        - [ ] page.tsx
        - [ ] types.ts
      - [ ] **moderation/**
        - [ ] page.tsx
      - [ ] **notifications/**
        - [ ] page.tsx
      - [ ] **payouts/**
        - [ ] **components/**
          - [ ] BankDetailsDialog.tsx
          - [ ] CreateSettlementDialog.tsx
          - [ ] CreatorBalancePayoutDialog.tsx
          - [ ] CreatorBalancesTable.tsx
          - [ ] PayoutStatsCards.tsx
          - [ ] ProjectDetailDialog.tsx
          - [ ] ProjectsTable.tsx
          - [ ] SettlementBadge.tsx
          - [ ] types.ts
        - [ ] page.tsx
      - [ ] **prelaunch/**
        - [ ] page.tsx
      - [ ] **projects/**
        - [ ] **components/**
          - [ ] **dialogs/**
            - [ ] adjust-end-date-dialog.tsx
            - [ ] deactivate-dialog.tsx
            - [ ] index.ts
            - [ ] make-live-dialog.tsx
            - [ ] reject-dialog.tsx
            - [ ] review-dialog.tsx
            - [ ] set-vanity-url-dialog.tsx
          - [ ] active-project-panel.tsx
          - [ ] flagged-tab.tsx
          - [ ] index.ts
          - [ ] prelaunch-tab.tsx
          - [ ] project-detail-panel.tsx
          - [ ] project-list-item.tsx
          - [ ] projects-filter-bar.tsx
          - [ ] review-history-tab.tsx
          - [ ] review-stats-cards.tsx
          - [ ] types.ts
          - [ ] unsubmitted-tab.tsx
          - [ ] utils.tsx
        - [ ] **hooks/**
          - [ ] useProjectsData.ts
        - [ ] page.tsx
      - [ ] **promo-popup/**
        - [ ] page.tsx
      - [ ] **reconcile/**
        - [ ] page.tsx
      - [ ] **retailers/**
        - [ ] **components/**
          - [ ] ActionConfirmDialog.tsx
          - [ ] RetailerDetailDialog.tsx
          - [ ] StarRating.tsx
          - [ ] StatusBadges.tsx
          - [ ] SurveyDetailDialog.tsx
          - [ ] index.ts
        - [ ] page.tsx
        - [ ] types.ts
      - [ ] **security/**
        - [ ] page.tsx
      - [ ] **seo/**
        - [ ] **components/**
          - [ ] AiSuggestionsTab.tsx
          - [ ] CronTab.tsx
          - [ ] DashboardTab.tsx
          - [ ] KeywordsTab.tsx
          - [ ] MetaTagsTab.tsx
          - [ ] PageAuditTab.tsx
          - [ ] RedirectsTab.tsx
          - [ ] helpers.tsx
          - [ ] index.ts
          - [ ] types.ts
        - [ ] page.tsx
      - [ ] **settings/**
        - [ ] page.tsx
      - [ ] **themes/**
        - [ ] page.tsx
      - [ ] **transactions/**
        - [ ] **components/**
          - [ ] BreakdownCards.tsx
          - [ ] StatsCards.tsx
          - [ ] StripeLookupDialog.tsx
          - [ ] TransactionBadges.tsx
          - [ ] TransactionDetailDialog.tsx
          - [ ] TransactionFilters.tsx
          - [ ] TransactionTable.tsx
          - [ ] index.ts
          - [ ] types.ts
          - [ ] utils.ts
        - [ ] page.tsx
      - [ ] **users/**
        - [ ] **components/**
          - [ ] **dialogs/**
            - [ ] add-user-dialog.tsx
            - [ ] approval-action-dialog.tsx
            - [ ] delete-user-dialog.tsx
            - [ ] edit-retailer-dialog.tsx
            - [ ] edit-user-dialog.tsx
            - [ ] email-preview-dialog.tsx
            - [ ] index.ts
            - [ ] password-dialog.tsx
            - [ ] retailer-details-dialog.tsx
            - [ ] role-dialog.tsx
            - [ ] send-email-dialog.tsx
            - [ ] user-details-dialog.tsx
          - [ ] index.ts
          - [ ] retailer-stats-cards.tsx
          - [ ] retailer-table.tsx
          - [ ] types.ts
          - [ ] user-filters.tsx
          - [ ] user-stats-cards.tsx
          - [ ] user-table.tsx
          - [ ] utils.tsx
        - [ ] **hooks/**
          - [ ] dialogs.ts
          - [ ] index.ts
          - [ ] usePledgeActions.ts
          - [ ] useRetailerActions.ts
          - [ ] useUserData.ts
        - [ ] hooks.ts
        - [ ] page.tsx
      - [ ] error.tsx
      - [ ] layout.tsx
      - [ ] loading.tsx
      - [ ] page.tsx
    - [ ] **api/**
      - [ ] **admin/**
        - [ ] **ai-marketing/**
          - [ ] **auto-tag/**
            - [ ] route.ts
          - [ ] **behavior/**
            - [ ] route.ts
          - [ ] **campaigns/**
            - [ ] **[type]/**
              - [ ] route.ts
            - [ ] **fix-images/**
              - [ ] route.ts
            - [ ] **manage/**
              - [ ] **[id]/**
                - [ ] **abort/**
                  - [ ] route.ts
                - [ ] **duplicate/**
                  - [ ] route.ts
                - [ ] **send/**
                  - [ ] route.ts
                - [ ] **test/**
                  - [ ] route.ts
                - [ ] route.ts
            - [ ] route.ts
          - [ ] **run/**
            - [ ] route.ts
          - [ ] **segments/**
            - [ ] route.ts
          - [ ] **services/**
            - [ ] route.ts
          - [ ] **stats/**
            - [ ] route.ts
          - [ ] **subscribers/**
            - [ ] **import/**
              - [ ] route.ts
            - [ ] **tags/**
              - [ ] route.ts
            - [ ] route.ts
          - [ ] **user-interests/**
            - [ ] route.ts
        - [ ] **analytics/**
          - [ ] route.ts
        - [ ] **announcement-bar/**
          - [ ] route.ts
        - [ ] **api-keys/**
          - [ ] route.ts
        - [ ] **backfill-backer-numbers/**
          - [ ] route.ts
        - [ ] **bank-accounts/**
          - [ ] **[id]/**
            - [ ] route.ts
        - [ ] **changelog/**
          - [ ] **extract/**
            - [ ] route.ts
          - [ ] route.ts
        - [ ] **cleanup-duplicate-rewards/**
          - [ ] route.ts
        - [ ] **cleanup-pledges/**
          - [!] route.ts
        - [ ] **consent-banner/**
          - [ ] route.ts
        - [ ] **cron/**
          - [ ] route.ts
        - [ ] **dashboard/**
          - [ ] route.ts
        - [ ] **database/**
          - [ ] **backup/**
            - [ ] **download/**
              - [ ] route.ts
            - [ ] **restore/**
              - [ ] route.ts
            - [ ] route.ts
          - [ ] **status/**
            - [ ] route.ts
        - [ ] **divinity-payouts/**
          - [ ] route.ts
        - [ ] **divinitycoin-redemptions/**
          - [ ] route.ts
        - [ ] **email/**
          - [ ] route.ts
        - [ ] **email-blocklist/**
          - [ ] **[id]/**
            - [ ] route.ts
          - [ ] **purge/**
            - [ ] route.ts
          - [x] route.ts
        - [ ] **email-queue/**
          - [ ] route.ts
        - [ ] **emails/**
          - [ ] **[emailId]/**
            - [ ] route.ts
        - [ ] **error-logs/**
          - [ ] **[id]/**
            - [ ] route.ts
          - [ ] route.ts
        - [ ] **feature-flags/**
          - [ ] route.ts
        - [ ] **hero-slides/**
          - [ ] **migrate/**
            - [ ] route.ts
          - [ ] **seed-features/**
            - [ ] route.ts
          - [ ] route.ts
        - [ ] **lcs-locator/**
          - [ ] **cleanup-emails/**
            - [ ] route.ts
          - [ ] **shops/**
            - [ ] route.ts
        - [ ] **link-sanitizer/**
          - [ ] route.ts
        - [ ] **mailboxes/**
          - [ ] **[id]/**
            - [ ] **emails/**
              - [ ] **[emailId]/**
                - [ ] **attachments/**
                  - [ ] **[attachmentId]/**
                    - [ ] route.ts
                - [ ] route.ts
              - [ ] route.ts
            - [ ] route.ts
          - [ ] route.ts
        - [ ] **marketplace/**
          - [ ] **books/**
            - [ ] **[id]/**
              - [ ] **feature/**
                - [ ] route.ts
              - [ ] **review/**
                - [ ] route.ts
              - [ ] **staff-pick/**
                - [ ] route.ts
              - [ ] route.ts
            - [ ] **reorder/**
              - [ ] route.ts
            - [ ] route.ts
          - [ ] **history/**
            - [ ] route.ts
          - [ ] **pdf-management/**
            - [ ] route.ts
          - [ ] **transactions/**
            - [ ] route.ts
        - [ ] **media/**
          - [ ] **scan/**
            - [ ] route.ts
          - [ ] **upload/**
            - [ ] route.ts
          - [ ] route.ts
        - [ ] **notifications/**
          - [ ] route.ts
        - [ ] **pages/**
          - [ ] route.ts
        - [ ] **payouts/**
          - [ ] **divinitycoin/**
            - [ ] route.ts
          - [ ] **paypal/**
            - [ ] route.ts
          - [ ] **whop/**
            - [ ] route.ts
          - [ ] route.ts
        - [ ] **pledges/**
          - [ ] **[pledgeId]/**
            - [!] route.ts
          - [ ] **cleanup/**
            - [ ] route.ts
        - [ ] **prelaunch/**
          - [ ] route.ts
        - [ ] **projects/**
          - [ ] **[projectId]/**
            - [ ] **adjust-end-date/**
              - [ ] route.ts
            - [ ] **backfill-backer-numbers/**
              - [ ] route.ts
            - [ ] **process-pledges/**
              - [ ] route.ts
          - [ ] **generate-jpg-covers/**
            - [ ] route.ts
          - [ ] **history/**
            - [ ] route.ts
          - [ ] **link-preview/**
            - [ ] route.ts
          - [ ] **normalize-nsfw-campaign-type/**
            - [ ] route.ts
          - [ ] **recover-base64-images/**
            - [ ] route.ts
          - [ ] **review/**
            - [ ] route.ts
          - [ ] **status/**
            - [ ] route.ts
          - [ ] **strip-base64-emails/**
            - [ ] route.ts
        - [ ] **promo-popup/**
          - [ ] route.ts
        - [ ] **recalculate-pledge-amounts/**
          - [ ] route.ts
        - [ ] **reconcile-pledges/**
          - [x] route.ts
        - [ ] **reports/**
          - [ ] route.ts
        - [ ] **retailers/**
          - [ ] **resend-approval/**
            - [ ] route.ts
          - [ ] **surveys/**
            - [ ] route.ts
          - [ ] route.ts
        - [ ] **security/**
          - [ ] **encrypt-secrets/**
            - [ ] route.ts
          - [ ] **stats/**
            - [ ] route.ts
        - [ ] **seo/**
          - [ ] **audit/**
            - [ ] route.ts
          - [ ] **cron/**
            - [ ] route.ts
          - [ ] **fix-all/**
            - [ ] route.ts
          - [ ] **keywords/**
            - [ ] route.ts
          - [ ] **pages/**
            - [ ] route.ts
          - [ ] **redirects/**
            - [ ] route.ts
          - [ ] route.ts
        - [ ] **settings/**
          - [ ] **test-r2/**
            - [ ] route.ts
          - [ ] route.ts
        - [ ] **sidebar-stats/**
          - [ ] route.ts
        - [ ] **sync-all-project-stats/**
          - [ ] route.ts
        - [ ] **transactions/**
          - [ ] **[id]/**
            - [x] route.ts
          - [ ] **stripe-lookup/**
            - [ ] route.ts
          - [ ] route.ts
        - [ ] **users/**
          - [ ] **[userId]/**
            - [ ] **emails/**
              - [ ] route.ts
            - [ ] **pledges/**
              - [ ] route.ts
            - [ ] **vanity-url/**
              - [ ] route.ts
          - [ ] **merge-duplicates/**
            - [ ] route.ts
          - [ ] route.ts
        - [ ] **wallet/**
          - [ ] route.ts
      - [ ] **ai/**
        - [ ] **auto-tag/**
          - [ ] route.ts
        - [ ] **marketing-copy/**
          - [ ] route.ts
        - [ ] **moderate/**
          - [ ] route.ts
      - [ ] **analytics/**
        - [ ] route.ts
      - [ ] **announcement-bar/**
        - [ ] route.ts
      - [ ] **auth/**
        - [ ] **config/**
          - [ ] route.ts
        - [ ] **logout/**
          - [ ] route.ts
        - [ ] **recaptcha/**
          - [ ] route.ts
        - [ ] **session/**
          - [ ] route.ts
        - [ ] **social/**
          - [ ] **[provider]/**
            - [ ] **callback/**
              - [ ] route.ts
            - [ ] route.ts
          - [ ] **connections/**
            - [ ] route.ts
      - [ ] **backer/**
        - [ ] **addresses/**
          - [ ] **[id]/**
            - [ ] route.ts
          - [ ] route.ts
        - [ ] **analytics/**
          - [ ] **export/**
            - [ ] route.ts
          - [ ] route.ts
        - [ ] **collections/**
          - [ ] **[id]/**
            - [ ] route.ts
          - [ ] route.ts
        - [ ] **dashboard/**
          - [ ] route.ts
        - [ ] **digital-files/**
          - [ ] **extract-cover/**
            - [ ] route.ts
          - [ ] **progress/**
            - [ ] route.ts
          - [ ] **stream/**
            - [ ] route.ts
          - [ ] route.ts
        - [ ] **digital-library/**
          - [ ] route.ts
        - [ ] **following/**
          - [ ] route.ts
        - [ ] **marketplace-purchases/**
          - [ ] **[id]/**
            - [ ] **download/**
              - [ ] route.ts
        - [ ] **notifications/**
          - [ ] **preferences/**
            - [ ] route.ts
        - [ ] **reviews/**
          - [ ] route.ts
        - [ ] **surveys/**
          - [ ] route.ts
      - [ ] **blocked/**
        - [ ] route.ts
      - [ ] **bug-reports/**
        - [ ] route.ts
      - [ ] **chat/**
        - [ ] **admin/**
          - [ ] **ban/**
            - [ ] route.ts
          - [ ] **delete/**
            - [ ] route.ts
        - [ ] **messages/**
          - [ ] route.ts
        - [ ] **presence/**
          - [ ] route.ts
        - [ ] **stickers/**
          - [ ] route.ts
      - [ ] **collaborations/**
        - [ ] **[id]/**
          - [ ] route.ts
        - [ ] route.ts
      - [ ] **collaborator/**
        - [ ] **[id]/**
          - [ ] **respond/**
            - [ ] route.ts
          - [ ] route.ts
      - [ ] **consent-banner/**
        - [ ] route.ts
      - [ ] **contact/**
        - [ ] route.ts
      - [ ] **creator/**
        - [ ] **account/**
          - [ ] **avatar/**
            - [ ] route.ts
          - [ ] **password/**
            - [ ] route.ts
          - [ ] **preferences/**
            - [ ] route.ts
          - [ ] **profile/**
            - [ ] route.ts
        - [ ] **bank-account/**
          - [ ] route.ts
        - [ ] **dashboard/**
          - [x] route.ts
        - [ ] **digital-files/**
          - [ ] route.ts
        - [ ] **email/**
          - [ ] **campaign/**
            - [ ] route.ts
          - [ ] **compose/**
            - [ ] route.ts
          - [ ] **send-test/**
            - [ ] route.ts
          - [ ] **setup/**
            - [ ] route.ts
          - [ ] **threads/**
            - [ ] **[threadId]/**
              - [ ] **archive/**
                - [ ] route.ts
              - [ ] **delete/**
                - [ ] route.ts
              - [ ] **forward/**
                - [ ] route.ts
              - [ ] **messages/**
                - [ ] route.ts
              - [ ] **read/**
                - [ ] route.ts
              - [ ] **reply/**
                - [ ] route.ts
              - [ ] **star/**
                - [ ] route.ts
            - [ ] route.ts
        - [ ] **email-marketing/**
          - [ ] **campaigns/**
            - [ ] route.ts
          - [ ] **subscribers/**
            - [ ] **[id]/**
              - [ ] route.ts
            - [ ] **import/**
              - [ ] route.ts
            - [ ] route.ts
        - [ ] **indiekit/**
          - [ ] **addons/**
            - [ ] route.ts
          - [ ] **address/**
            - [ ] route.ts
          - [ ] **backers/**
            - [ ] route.ts
          - [ ] **campaigns/**
            - [ ] route.ts
          - [ ] **digital/**
            - [ ] route.ts
          - [ ] **easypost/**
            - [ ] route.ts
          - [ ] **export/**
            - [ ] route.ts
          - [ ] **feedback/**
            - [ ] route.ts
          - [ ] **fulfillment/**
            - [ ] route.ts
          - [ ] **helpers/**
            - [ ] compute-stats.ts
            - [ ] format-digital-files.ts
            - [ ] format-email-campaigns.ts
            - [ ] format-products.ts
            - [ ] format-segments.ts
            - [ ] format-timeline.ts
            - [ ] index.ts
            - [ ] post-campaign-sales.ts
            - [ ] process-backers.ts
            - [ ] workflow.ts
          - [ ] **integrations/**
            - [ ] route.ts
          - [ ] **modifiers/**
            - [ ] route.ts
          - [ ] **notes/**
            - [ ] route.ts
          - [ ] **orders/**
            - [ ] **notify-balance/**
              - [ ] route.ts
            - [ ] route.ts
          - [ ] **products/**
            - [ ] route.ts
          - [ ] **segments/**
            - [ ] **backers/**
              - [ ] route.ts
            - [ ] route.ts
          - [ ] **settings/**
            - [ ] **image/**
              - [ ] route.ts
            - [ ] route.ts
          - [ ] **shipping/**
            - [ ] route.ts
          - [ ] **shipping-providers/**
            - [ ] **credentials/**
              - [ ] route.ts
          - [ ] **shippo/**
            - [ ] route.ts
          - [ ] **shipstation/**
            - [ ] route.ts
          - [ ] **shopify/**
            - [ ] **credentials/**
              - [ ] route.ts
            - [ ] **oauth/**
              - [ ] **authorize/**
                - [ ] route.ts
              - [ ] **callback/**
                - [ ] route.ts
            - [ ] **sku-mapping/**
              - [x] route.ts
            - [ ] route.ts
          - [ ] **stamps/**
            - [ ] route.ts
          - [ ] **surveys/**
            - [ ] **[pledgeId]/**
              - [ ] route.ts
            - [ ] route.ts
          - [ ] **timeline/**
            - [ ] route.ts
          - [ ] **transactions/**
            - [ ] route.ts
          - [ ] **updates/**
            - [ ] route.ts
          - [x] route.ts
        - [ ] **marketplace/**
          - [ ] **audio/**
            - [ ] **upload/**
              - [ ] route.ts
            - [ ] route.ts
          - [ ] **books/**
            - [ ] **[id]/**
              - [ ] **submit/**
                - [ ] route.ts
              - [ ] route.ts
            - [ ] route.ts
          - [ ] **company/**
            - [ ] route.ts
          - [ ] **discount-codes/**
            - [ ] route.ts
          - [ ] **files/**
            - [ ] **upload/**
              - [ ] route.ts
            - [ ] route.ts
          - [ ] **movies/**
            - [ ] route.ts
          - [ ] **music/**
            - [ ] route.ts
          - [ ] **video/**
            - [ ] **upload/**
              - [ ] route.ts
            - [ ] route.ts
          - [ ] route.ts
        - [ ] **media/**
          - [ ] **upload/**
            - [ ] route.ts
        - [ ] **paypal/**
          - [ ] route.ts
        - [ ] **paypal-bank-account/**
          - [ ] route.ts
        - [ ] **pledges/**
          - [ ] **[pledgeId]/**
            - [ ] **resend-confirmation/**
              - [ ] route.ts
            - [!] route.ts
          - [ ] **bulk-delete/**
            - [ ] route.ts
          - [ ] **bulk-resend-confirmation/**
            - [ ] route.ts
        - [ ] **prelaunch-pages/**
          - [ ] route.ts
        - [ ] **projects-for-import/**
          - [ ] route.ts
        - [ ] **refund-requests/**
          - [ ] **[requestId]/**
            - [!] route.ts
          - [ ] route.ts
        - [ ] **stripe/**
          - [ ] **portal/**
            - [ ] route.ts
        - [ ] **whop-bank-account/**
          - [ ] route.ts
      - [ ] **cron/**
        - [ ] **ai-marketing/**
          - [x] route.ts
        - [ ] **cleanup-pledges/**
          - [x] route.ts
        - [ ] **cleanup-projects/**
          - [x] route.ts
        - [ ] **email-queue/**
          - [x] route.ts
        - [ ] **email-retries/**
          - [x] route.ts
        - [ ] **payment-retries/**
          - [x] route.ts
        - [ ] **process-failed-campaigns/**
          - [x] route.ts
        - [ ] **process-funded-campaigns/**
          - [x] route.ts
        - [ ] **scheduled-campaigns/**
          - [!] route.ts
      - [ ] **diagnostics/**
        - [ ] **payment/**
          - [ ] route.ts
      - [ ] **divinitycoin/**
        - [ ] **config/**
          - [ ] route.ts
      - [ ] **email/**
        - [ ] **track/**
          - [ ] **click/**
            - [ ] route.ts
          - [ ] **open/**
            - [ ] route.ts
      - [ ] **error-report/**
        - [ ] route.ts
      - [ ] **health/**
        - [ ] route.ts
      - [ ] **hero-slides/**
        - [ ] route.ts
      - [ ] **home-stats/**
        - [ ] route.ts
      - [ ] **internal/**
        - [ ] **blocked-ips/**
          - [ ] route.ts
      - [ ] **lcs-locator/**
        - [ ] **import/**
          - [ ] route.ts
        - [ ] route.ts
      - [ ] **marketplace/**
        - [ ] **books/**
          - [ ] **[slug]/**
            - [ ] route.ts
          - [ ] route.ts
        - [ ] **checkout/**
          - [ ] **verify/**
            - [!] route.ts
          - [ ] route.ts
        - [ ] **companies/**
          - [ ] **[slug]/**
            - [ ] route.ts
          - [ ] route.ts
        - [ ] **paypal/**
          - [ ] **capture/**
            - [ ] **[orderId]/**
              - [x] route.ts
        - [ ] **purchase/**
          - [ ] **confirm/**
            - [x] route.ts
          - [ ] route.ts
        - [ ] **redeem-code/**
          - [x] route.ts
        - [ ] **stream/**
          - [ ] **[slug]/**
            - [ ] route.ts
        - [ ] **validate-code/**
          - [ ] route.ts
        - [ ] **watch/**
          - [ ] **[slug]/**
            - [ ] route.ts
      - [ ] **messages/**
        - [ ] **user-info/**
          - [ ] route.ts
        - [ ] route.ts
      - [ ] **metrics/**
        - [ ] route.ts
      - [ ] **og/**
        - [ ] route.tsx
      - [ ] **pay/**
        - [ ] **balance/**
          - [ ] **confirm/**
            - [ ] route.ts
          - [ ] route.ts
      - [ ] **paypal/**
        - [ ] **capture/**
          - [ ] **[orderId]/**
            - [x] route.ts
        - [ ] **client-token/**
          - [ ] route.ts
        - [ ] **config/**
          - [ ] route.ts
      - [ ] **platform-stats/**
        - [ ] route.ts
      - [ ] **pledges/**
        - [ ] **[pledgeId]/**
          - [ ] **add-items/**
            - [ ] route.ts
          - [ ] **confirm/**
            - [x] route.ts
          - [ ] **confirm-add-items/**
            - [ ] route.ts
          - [ ] **confirm-modify/**
            - [x] route.ts
          - [!] route.ts
        - [ ] **check/**
          - [ ] route.ts
        - [ ] route.ts
      - [ ] **privacy/**
        - [ ] **ccpa-opt-out/**
          - [ ] route.ts
      - [ ] **projects/**
        - [ ] **[id]/**
          - [ ] **basics/**
            - [ ] route.ts
          - [ ] **chargeback-card/**
            - [ ] route.ts
          - [ ] **collaborators/**
            - [ ] **me/**
              - [ ] route.ts
            - [ ] route.ts
          - [ ] **comments/**
            - [ ] route.ts
          - [ ] **contact-email/**
            - [ ] route.ts
          - [ ] **items/**
            - [ ] **[itemId]/**
              - [ ] **end/**
                - [ ] route.ts
            - [ ] route.ts
          - [ ] **launch/**
            - [ ] route.ts
          - [ ] **members/**
            - [ ] **import/**
              - [ ] route.ts
            - [ ] route.ts
          - [ ] **payment/**
            - [ ] route.ts
          - [ ] **prelaunch/**
            - [ ] route.ts
          - [ ] **promotion/**
            - [ ] route.ts
          - [ ] **reviews/**
            - [ ] route.ts
          - [ ] **rewards/**
            - [ ] route.ts
          - [ ] **story/**
            - [ ] route.ts
          - [ ] **submit/**
            - [ ] route.ts
          - [ ] **survey/**
            - [ ] **backer-questions/**
              - [ ] route.ts
            - [ ] **item-questions/**
              - [ ] route.ts
            - [ ] **lock/**
              - [ ] route.ts
            - [ ] **responses/**
              - [ ] route.ts
            - [ ] **send/**
              - [ ] route.ts
            - [ ] route.ts
          - [ ] **sync-stats/**
            - [ ] route.ts
          - [ ] route.ts
        - [ ] **similar/**
          - [ ] route.ts
        - [ ] **slug/**
          - [ ] **[slug]/**
            - [ ] **check/**
              - [ ] route.ts
            - [ ] **stats/**
              - [ ] route.ts
            - [ ] route.ts
        - [ ] **vanity/**
          - [ ] **[vanityname]/**
            - [ ] **[slug]/**
              - [ ] **stats/**
                - [ ] route.ts
              - [ ] route.ts
        - [ ] route.ts
      - [ ] **promo-popup/**
        - [ ] route.ts
      - [ ] **r2/**
        - [ ] **serve/**
          - [ ] **[...key]/**
            - [ ] route.ts
      - [ ] **recommendations/**
        - [ ] route.ts
      - [ ] **retailers/**
        - [ ] **account/**
          - [ ] route.ts
        - [ ] **apply/**
          - [ ] route.ts
        - [ ] **forgot-password/**
          - [ ] route.ts
        - [ ] **invoices/**
          - [ ] route.ts
        - [ ] **login/**
          - [ ] route.ts
        - [ ] **logout/**
          - [ ] route.ts
        - [ ] **me/**
          - [ ] route.ts
        - [ ] **orders/**
          - [ ] route.ts
        - [ ] **projects/**
          - [ ] **[id]/**
            - [ ] route.ts
          - [ ] route.ts
        - [ ] **reset-password/**
          - [ ] route.ts
        - [ ] **session-auth/**
          - [ ] route.ts
      - [ ] **rewards/**
        - [ ] **[id]/**
          - [ ] **copy-to-addon/**
            - [ ] route.ts
          - [ ] **end/**
            - [ ] route.ts
          - [ ] **shipping/**
            - [ ] route.ts
        - [ ] route.ts
      - [ ] **stripe/**
        - [ ] **config/**
          - [ ] route.ts
        - [ ] **connect/**
          - [ ] **refresh/**
            - [ ] route.ts
          - [ ] **reset/**
            - [ ] route.ts
          - [ ] **status/**
            - [ ] route.ts
          - [ ] route.ts
      - [ ] **surveys/**
        - [ ] **[pledgeId]/**
          - [ ] **respond/**
            - [ ] route.ts
        - [ ] route.ts
      - [ ] **track/**
        - [ ] route.ts
      - [ ] **tracking/**
        - [ ] route.ts
      - [ ] **unsubscribe/**
        - [ ] route.ts
      - [ ] **updates/**
        - [ ] route.ts
      - [ ] **upload/**
        - [ ] route.ts
      - [ ] **uploads/**
        - [ ] **[...path]/**
          - [ ] route.ts
      - [ ] **user/**
        - [ ] **activity/**
          - [ ] route.ts
        - [ ] **data-deletion/**
          - [ ] route.ts
        - [ ] **data-export/**
          - [ ] route.ts
        - [ ] **following/**
          - [ ] route.ts
        - [ ] **me/**
          - [ ] route.ts
        - [ ] **notifications/**
          - [ ] route.ts
        - [ ] **profile/**
          - [ ] route.ts
        - [ ] **profile-dropdown/**
          - [ ] route.ts
        - [ ] **public-profile/**
          - [ ] **[username]/**
            - [ ] route.ts
        - [ ] **settings/**
          - [ ] **email/**
            - [ ] route.ts
          - [ ] route.ts
        - [ ] **vanity-url/**
          - [ ] route.ts
        - [ ] **verify-email/**
          - [ ] route.ts
      - [ ] **verify-id/**
        - [ ] **callback/**
          - [ ] route.ts
        - [ ] **check/**
          - [ ] route.ts
        - [ ] route.ts
      - [ ] **webhooks/**
        - [ ] **divinitycoin/**
          - [ ] route.ts
        - [ ] **email/**
          - [ ] **events/**
            - [!] route.ts
          - [ ] **inbound/**
            - [ ] route.ts
        - [ ] **paypal/**
          - [!] route.ts
        - [ ] **stripe/**
          - [ ] **connect/**
            - [ ] route.ts
          - [ ] route.ts
        - [ ] **stripe_connect/**
          - [ ] route.ts
        - [ ] **whop/**
          - [!] route.ts
      - [ ] **whop/**
        - [ ] **config/**
          - [ ] route.ts
        - [ ] **confirm/**
          - [ ] **[pledgeId]/**
            - [x] route.ts
    - [ ] **backer-handbook/**
      - [ ] layout.tsx
      - [ ] page.tsx
    - [ ] **bug-report/**
      - [ ] layout.tsx
      - [ ] page.tsx
    - [ ] **cart/**
      - [ ] page.tsx
    - [ ] **changelog/**
      - [ ] page.tsx
    - [ ] **chat/**
      - [ ] page.tsx
    - [ ] **collaborate/**
      - [ ] **[id]/**
        - [ ] page.tsx
      - [ ] layout.tsx
    - [ ] **contact/**
      - [ ] layout.tsx
      - [ ] page.tsx
    - [ ] **creator-handbook/**
      - [ ] layout.tsx
      - [ ] page.tsx
    - [ ] **dashboard/**
      - [ ] **activity/**
        - [ ] page.tsx
      - [ ] **backer/**
        - [ ] **components/**
          - [ ] **digital-library-sections/**
            - [ ] constants.ts
            - [ ] index.ts
            - [ ] library-card.tsx
            - [ ] library-toolbar.tsx
            - [ ] reader-view.tsx
            - [ ] types.ts
          - [ ] address-management-tab.tsx
          - [ ] animated-bar-chart.tsx
          - [ ] circular-progress.tsx
          - [ ] collections-tab.tsx
          - [ ] digital-downloads-tab.tsx
          - [ ] digital-library-tab.tsx
          - [ ] download-card.tsx
          - [ ] following-tab.tsx
          - [ ] fulfillment-pipeline.tsx
          - [ ] glowing-stat-card.tsx
          - [ ] index.ts
          - [ ] messages-tab.tsx
          - [ ] notification-preferences-tab.tsx
          - [ ] spending-analytics-tab.tsx
          - [ ] survey-hub-tab.tsx
        - [ ] page.tsx
      - [ ] **components/**
        - [ ] AnimatedBarChart.tsx
        - [ ] BackersList.tsx
        - [ ] CircularProgress.tsx
        - [ ] CollaborationsTab.tsx
        - [ ] EmailTab.tsx
        - [ ] FundingChart.tsx
        - [ ] GlowingStatCard.tsx
        - [ ] IndieKitV2Tab.tsx
        - [ ] MarketplaceTab.tsx
        - [ ] PostUpdatesTab.tsx
        - [ ] ProductionOrderView.tsx
        - [ ] ProjectSelector.tsx
        - [ ] QuickStats.tsx
        - [ ] RecentBackersCard.tsx
        - [ ] RewardStats.tsx
        - [ ] SocialHubTab.tsx
        - [ ] StatsCards.tsx
        - [ ] TrafficSources.tsx
        - [ ] index.ts
      - [ ] **following/**
        - [ ] page.tsx
      - [ ] **indiekit/**
        - [ ] **components/**
          - [ ] **dialogs/**
            - [ ] addon-dialog.tsx
            - [ ] address-validation-dialog.tsx
            - [ ] backer-dialog.tsx
            - [ ] balance-editor-dialog.tsx
            - [ ] confirm-dialog.tsx
            - [ ] edit-order-dialog.tsx
            - [ ] email-composer-dialog.tsx
            - [ ] email-dialog.tsx
            - [ ] export-dialog.tsx
            - [ ] import-addon-from-project-dialog.tsx
            - [ ] import-email-dialog.tsx
            - [ ] index.ts
            - [ ] notes-dialog.tsx
            - [ ] nps-feedback-dialog.tsx
            - [ ] packing-slip-dialog.tsx
            - [ ] refund-dialog.tsx
            - [ ] segment-dialog.tsx
            - [ ] tracking-dialog.tsx
            - [ ] upload-dialog.tsx
          - [ ] **tabs/**
            - [ ] **packages-sections/**
              - [ ] index.ts
              - [ ] instructions-content.tsx
              - [ ] package-group-card.tsx
              - [ ] packages-dialogs.tsx
              - [ ] sku-mapping-content.tsx
            - [ ] **settings-sections/**
              - [ ] general-section.tsx
              - [ ] index.ts
              - [ ] integrations-section.tsx
              - [ ] notifications-section.tsx
              - [ ] payments-section.tsx
              - [ ] shipping-providers-section.tsx
              - [ ] shipping-section.tsx
              - [ ] shopify-credentials-section.tsx
              - [ ] survey-section.tsx
              - [ ] team-section.tsx
            - [ ] **sku-mapping-sections/**
              - [ ] index.ts
              - [ ] modifier-combination-row.tsx
              - [ ] modifier-combinations-card.tsx
              - [ ] sku-input-field.tsx
              - [ ] sku-item-row.tsx
              - [ ] types.ts
            - [ ] account-settings-tab.tsx
            - [ ] addons-tab.tsx
            - [ ] backers-tab.tsx
            - [ ] counts-tab.tsx
            - [ ] digital-tab.tsx
            - [ ] email-list-tab.tsx
            - [ ] emails-tab.tsx
            - [ ] export-tab.tsx
            - [ ] inbox-tab.tsx
            - [ ] index.ts
            - [ ] manage-survey-tab.tsx
            - [ ] overview-tab.tsx
            - [ ] packages-tab.tsx
            - [ ] preorders-tab.tsx
            - [ ] products-tab.tsx
            - [ ] projects-tab.tsx
            - [ ] segments-tab.tsx
            - [ ] settings-tab.tsx
            - [ ] shipping-tab.tsx
            - [ ] sku-mapping-tab.tsx
            - [ ] support-tab.tsx
            - [ ] teaser-pages-tab.tsx
            - [ ] timeline-tab.tsx
            - [ ] transaction-history-tab.tsx
            - [ ] updates-tab.tsx
          - [ ] **ui/**
            - [ ] charts.tsx
            - [ ] empty-states.tsx
            - [ ] global-search.tsx
            - [ ] help-tooltip.tsx
            - [ ] index.ts
            - [ ] keyboard-shortcuts.tsx
            - [ ] skeleton.tsx
          - [ ] whats-next-banner.tsx
        - [ ] **emails/**
          - [ ] **[id]/**
            - [ ] **edit/**
              - [ ] page.tsx
        - [ ] **shopify/**
          - [ ] **app/**
            - [ ] page.tsx
          - [ ] **install/**
            - [ ] page.tsx
        - [ ] **survey/**
          - [ ] **[pledgeId]/**
            - [ ] page.tsx
        - [ ] constants.ts
        - [ ] page.tsx
        - [ ] types.ts
      - [ ] **indiekit-v2/**
        - [ ] **components/**
          - [ ] **layout/**
            - [ ] PhaseSelector.tsx
            - [ ] WorkflowProgress.tsx
          - [ ] **tabs/**
            - [ ] DashboardTab.tsx
            - [ ] DigitalDeliveryTab.tsx
            - [ ] EmailMarketingTab.tsx
            - [ ] FinalizeTab.tsx
            - [ ] PaymentsTab.tsx
            - [ ] PhysicalDeliveryTab.tsx
            - [ ] RefundRequestsTab.tsx
            - [ ] ReportsTab.tsx
            - [ ] SetupTab.tsx
            - [ ] SurveysTab.tsx
        - [ ] constants.ts
        - [ ] page.tsx
        - [ ] types.ts
      - [ ] **marketplace/**
        - [ ] **books/**
          - [ ] **[id]/**
            - [ ] **edit/**
              - [ ] **components/**
                - [ ] FileUpload.tsx
                - [ ] PDFFilePicker.tsx
                - [ ] StatusBanner.tsx
                - [ ] StepBasicInfo.tsx
                - [ ] StepIndicator.tsx
                - [ ] StepMedia.tsx
                - [ ] StepPricing.tsx
                - [ ] StepReview.tsx
                - [ ] types.ts
              - [ ] page.tsx
          - [ ] **new/**
            - [ ] page.tsx
        - [ ] **company/**
          - [ ] page.tsx
        - [ ] **components/**
          - [ ] AnalyticsTab.tsx
          - [ ] BookCard.tsx
          - [ ] BooksGrid.tsx
          - [ ] CompanyProfileCard.tsx
          - [ ] PromoCodesTab.tsx
          - [ ] StatsCard.tsx
          - [ ] StatusBadge.tsx
          - [ ] types.ts
        - [ ] **movies/**
          - [ ] **[id]/**
            - [ ] **edit/**
              - [ ] page.tsx
          - [ ] **new/**
            - [ ] page.tsx
        - [ ] **music/**
          - [ ] **[id]/**
            - [ ] **edit/**
              - [ ] page.tsx
          - [ ] **new/**
            - [ ] page.tsx
        - [ ] page.tsx
      - [ ] **messages/**
        - [ ] page.tsx
      - [ ] **notifications/**
        - [ ] page.tsx
      - [ ] **pledges/**
        - [ ] **[pledgeId]/**
          - [ ] **survey/**
            - [ ] **components/**
              - [ ] QuestionInput.tsx
              - [ ] SurveyAddonsStep.tsx
              - [ ] SurveyAddressStep.tsx
              - [ ] SurveyErrorState.tsx
              - [ ] SurveyHeader.tsx
              - [ ] SurveyIntroStep.tsx
              - [ ] SurveyItemsStep.tsx
              - [ ] SurveyLockedState.tsx
              - [ ] SurveyPaymentStep.tsx
              - [ ] SurveyQuestionsStep.tsx
              - [ ] SurveyReviewStep.tsx
              - [ ] types.ts
            - [ ] page.tsx
          - [ ] page.tsx
      - [ ] **profile/**
        - [ ] page.tsx
      - [ ] **projects/**
        - [ ] **[id]/**
          - [ ] **survey/**
            - [ ] **responses/**
              - [ ] page.tsx
            - [ ] page.tsx
        - [ ] page.tsx
      - [ ] **settings/**
        - [ ] **components/**
          - [ ] AccountCard.tsx
          - [ ] ConnectedServicesCard.tsx
          - [ ] EmailChangeDialog.tsx
          - [ ] LoadingState.tsx
          - [ ] PaypalCard.tsx
          - [ ] PrivacyCard.tsx
          - [ ] ProfileCard.tsx
          - [ ] SettingsHeader.tsx
          - [ ] SubscriptionsCard.tsx
          - [ ] types.ts
        - [ ] page.tsx
      - [ ] **social/**
        - [ ] page.tsx
      - [ ] **updates/**
        - [ ] page.tsx
      - [ ] error.tsx
      - [ ] layout.tsx
      - [ ] loading.tsx
      - [ ] page.tsx
      - [ ] types.ts
    - [ ] **discover/**
      - [ ] layout.tsx
      - [ ] loading.tsx
      - [ ] page.tsx
    - [ ] **explore/**
      - [ ] page.tsx
    - [ ] **faq/**
      - [ ] layout.tsx
      - [ ] page.tsx
    - [ ] **fees/**
      - [ ] calculations.ts
      - [ ] data.ts
      - [ ] layout.tsx
      - [ ] page.tsx
    - [ ] **fulfillment/**
      - [ ] page.tsx
    - [ ] **help/**
      - [ ] **whitelist/**
        - [ ] page.tsx
      - [ ] page.tsx
    - [ ] **indiekit-handbook/**
      - [ ] layout.tsx
      - [ ] page.tsx
    - [ ] **lcs-locator/**
      - [ ] layout.tsx
      - [ ] page.tsx
    - [ ] **marketplace/**
      - [ ] **books/**
        - [ ] **[slug]/**
          - [ ] layout.tsx
          - [ ] page.tsx
        - [ ] **featured/**
          - [ ] page.tsx
        - [ ] **staff-picks/**
          - [ ] page.tsx
        - [ ] layout.tsx
        - [ ] page.tsx
      - [ ] **checkout/**
        - [ ] **success/**
          - [ ] page.tsx
      - [ ] **companies/**
        - [ ] **[slug]/**
          - [ ] layout.tsx
          - [ ] page.tsx
      - [ ] **components/**
        - [ ] MarketplacePayPalForm.tsx
      - [ ] **physical-media/**
        - [ ] layout.tsx
        - [ ] page.tsx
      - [ ] layout.tsx
      - [ ] page.tsx
    - [ ] **marketplace-handbook/**
      - [ ] **backers/**
        - [ ] page.tsx
      - [ ] **creators/**
        - [ ] page.tsx
      - [ ] layout.tsx
    - [ ] **pay/**
      - [ ] **balance/**
        - [ ] **[token]/**
          - [ ] page.tsx
    - [ ] **privacy/**
      - [ ] layout.tsx
      - [ ] page.tsx
    - [ ] **projects/**
      - [ ] **[vanityname]/**
        - [ ] **[slug]/**
          - [ ] **edit/**
            - [ ] page.tsx
          - [ ] **pledge/**
            - [ ] **components/**
              - [ ] AddonSelector.tsx
              - [ ] AddressWarning.tsx
              - [ ] Breadcrumb.tsx
              - [ ] DCPaymentWrapper.tsx
              - [ ] ErrorState.tsx
              - [ ] FAQSection.tsx
              - [ ] LoadingState.tsx
              - [ ] OrderSummary.tsx
              - [ ] PayPalPaymentForm.tsx
              - [ ] PaymentStep.tsx
              - [ ] RewardSelector.tsx
              - [ ] StripePaymentForm.tsx
              - [ ] SuccessPage.tsx
              - [ ] WhopPaymentForm.tsx
            - [ ] **hooks/**
              - [ ] usePledge.ts
            - [ ] constants.ts
            - [ ] page.tsx
            - [ ] types.ts
            - [ ] utils.ts
          - [ ] **prelaunch/**
            - [ ] layout.tsx
            - [ ] page.tsx
          - [ ] layout.tsx
          - [ ] loading.tsx
          - [ ] page.tsx
        - [ ] page.tsx
      - [ ] **new/**
        - [ ] page.tsx
      - [ ] page.tsx
    - [ ] **retailers/**
      - [ ] **account/**
        - [ ] page.tsx
      - [ ] **apply/**
        - [ ] page.tsx
      - [ ] **dashboard/**
        - [ ] **components/**
          - [ ] RetailerAccountTab.tsx
          - [ ] RetailerInvoicesTab.tsx
          - [ ] RetailerOrdersTab.tsx
          - [ ] RetailerProjectsTab.tsx
        - [ ] page.tsx
      - [ ] **forgot-password/**
        - [ ] page.tsx
      - [ ] **invoices/**
        - [ ] page.tsx
      - [ ] **login/**
        - [ ] page.tsx
      - [ ] **orders/**
        - [ ] page.tsx
      - [ ] **projects/**
        - [ ] **[id]/**
          - [ ] page.tsx
        - [ ] page.tsx
      - [ ] **reset-password/**
        - [ ] page.tsx
      - [ ] layout.tsx
      - [ ] page.tsx
    - [ ] **settings/**
      - [ ] **payment/**
        - [ ] **stripe/**
          - [ ] **complete/**
            - [ ] page.tsx
          - [ ] **refresh/**
            - [ ] page.tsx
        - [ ] page.tsx
    - [ ] **success-stories/**
      - [ ] page.tsx
    - [ ] **survey/**
      - [ ] **preview/**
        - [ ] page.tsx
    - [ ] **term/**
      - [ ] page.tsx
    - [ ] **terms/**
      - [ ] layout.tsx
      - [ ] page.tsx
    - [ ] **trust-safety/**
      - [ ] layout.tsx
      - [ ] page.tsx
    - [ ] **u/**
      - [ ] **[username]/**
        - [ ] layout.tsx
        - [ ] page.tsx
    - [ ] **verification-complete/**
      - [ ] page.tsx
    - [ ] **verify-email/**
      - [ ] page.tsx
    - [ ] **what-is-divinitycoin/**
      - [ ] layout.tsx
      - [ ] page.tsx
    - [ ] error.tsx
    - [ ] global-error.tsx
    - [ ] layout.tsx
    - [ ] not-found.tsx
    - [ ] page.tsx
    - [ ] robots.ts
    - [ ] sitemap.ts
  - [ ] **components/**
    - [ ] **admin/**
      - [ ] **ai-marketing/**
        - [ ] **dialogs/**
          - [ ] campaign-dialog.tsx
          - [ ] campaign-type-dialog.tsx
          - [ ] csv-import-dialog.tsx
          - [ ] index.ts
          - [ ] results-viewer-dialog.tsx
          - [ ] tag-review-dialog.tsx
        - [ ] ai-settings-tab.tsx
        - [ ] auto-tagging-tab.tsx
        - [ ] behavior-analytics-tab.tsx
        - [ ] email-campaigns-tab.tsx
        - [ ] index.ts
        - [ ] overview-tab.tsx
        - [ ] subscriber-list-tab.tsx
        - [ ] tag-segments-tab.tsx
      - [ ] **settings/**
        - [ ] ai-settings.tsx
        - [ ] analytics-settings.tsx
        - [ ] api-settings.tsx
        - [ ] communication-settings.tsx
        - [ ] database-settings.tsx
        - [ ] email-settings.tsx
        - [ ] general-settings.tsx
        - [ ] id-verification-settings.tsx
        - [ ] index.ts
        - [ ] payment-settings.tsx
        - [ ] security-settings.tsx
        - [ ] social-settings.tsx
        - [ ] storage-settings.tsx
    - [ ] **auth/**
      - [ ] auth-modal.tsx
      - [ ] forgot-password-form.tsx
      - [ ] login-form.tsx
      - [ ] recaptcha.tsx
      - [ ] register-form.tsx
      - [ ] reset-password-form.tsx
    - [ ] **chat/**
      - [ ] chat-room.tsx
    - [ ] **legal/**
      - [ ] ai-policy.tsx
      - [ ] backer-agreement.tsx
      - [ ] chargebacks-policy.tsx
      - [ ] content-guidelines.tsx
      - [ ] cookie-policy.tsx
      - [ ] creator-agreement.tsx
      - [ ] data-deletion-policy.tsx
      - [ ] dmca-policy.tsx
      - [ ] fraud-policy.tsx
      - [ ] gdpr-ccpa-policy.tsx
      - [ ] index.ts
      - [ ] nsfw-policy.tsx
      - [ ] pci-compliance.tsx
      - [ ] privacy-policy.tsx
      - [ ] refund-policy.tsx
      - [ ] shipping-policy.tsx
      - [ ] terms-of-service.tsx
    - [ ] **marketplace/**
      - [ ] audio-visualizer.tsx
      - [ ] marketplace-payment-settings.tsx
      - [ ] movie-browse.tsx
      - [ ] music-browse.tsx
      - [ ] music-player.tsx
    - [ ] **messaging/**
      - [ ] messages-panel.tsx
    - [ ] **notifications/**
      - [ ] notifications-dropdown.tsx
    - [ ] **project-details/**
      - [ ] **tabs/**
        - [ ] campaign-tab.tsx
        - [ ] comments-tab.tsx
        - [ ] community-tab.tsx
        - [ ] creator-tab.tsx
        - [ ] faq-tab.tsx
        - [ ] index.ts
        - [ ] rewards-tab.tsx
        - [ ] updates-tab.tsx
      - [ ] index.ts
      - [ ] social-icons.tsx
      - [ ] types.ts
      - [ ] utils.ts
    - [ ] **providers/**
      - [ ] auth-provider.tsx
      - [ ] theme-provider.tsx
    - [ ] **ui/**
      - [ ] accordion.tsx
      - [ ] alert-dialog.tsx
      - [ ] alert.tsx
      - [ ] avatar.tsx
      - [ ] badge.tsx
      - [ ] block-editor.tsx
      - [ ] button.tsx
      - [ ] calendar.tsx
      - [ ] card.tsx
      - [ ] checkbox.tsx
      - [ ] collapsible.tsx
      - [ ] confirm-dialog.tsx
      - [ ] countdown-timer.tsx
      - [ ] dialog.tsx
      - [ ] drag-drop-image-cell.tsx
      - [ ] dropdown-menu.tsx
      - [ ] editable-input.tsx
      - [ ] email-editor.tsx
      - [ ] form.tsx
      - [ ] image-upload.tsx
      - [ ] input.tsx
      - [ ] label.tsx
      - [ ] location-autocomplete.tsx
      - [ ] popover.tsx
      - [ ] progress.tsx
      - [ ] radio-group.tsx
      - [ ] rich-text-editor.tsx
      - [ ] screen-reader-announcer.tsx
      - [ ] scroll-area.tsx
      - [ ] secure-key-input.tsx
      - [ ] select.tsx
      - [ ] separator.tsx
      - [ ] sheet.tsx
      - [ ] skeleton.tsx
      - [ ] slider.tsx
      - [ ] sonner.tsx
      - [ ] star-rating.tsx
      - [ ] switch.tsx
      - [ ] table.tsx
      - [ ] tabs.tsx
      - [ ] textarea.tsx
      - [ ] tooltip.tsx
    - [ ] PdfPageFlipReader.tsx
    - [ ] PdfThumbnail.tsx
    - [ ] announcement-bar.tsx
    - [ ] back-to-top.tsx
    - [ ] consent-banner.tsx
    - [ ] email-verification-banner.tsx
    - [ ] error-reporter.tsx
    - [ ] footer.tsx
    - [ ] google-analytics.tsx
    - [ ] hero-slider.tsx
    - [ ] home-stats-poller.tsx
    - [ ] json-ld.tsx
    - [ ] mobile-profile-links.tsx
    - [ ] payment-settings.tsx
    - [ ] promo-popup.tsx
    - [ ] site-header.tsx
    - [ ] theme-toggle.tsx
    - [ ] tracking-provider.tsx
    - [ ] user-profile-dropdown.tsx
  - [ ] **lib/**
    - [ ] **ai/**
      - [ ] anthropic.ts
      - [ ] automation.ts
      - [ ] index.ts
      - [ ] marketing-services.ts
      - [ ] settings-integration.ts
      - [ ] user-interests.ts
    - [ ] **auth/**
      - [x] actions.ts
      - [ ] constants.ts
      - [ ] email-access.ts
      - [ ] index.ts
      - [ ] rate-limit.ts
      - [ ] recaptcha.ts
      - [ ] session.ts
    - [ ] **db/**
      - [ ] index.ts
    - [ ] **email/**
      - [x] email-config.ts
      - [ ] email-templates-auth.ts
      - [x] email-templates-misc.ts
      - [ ] email-templates-pledge.ts
      - [ ] email-templates-project.ts
      - [ ] safe-image-url.ts
      - [ ] sendgrid-verify.ts
      - [ ] strip-base64-html.ts
    - [ ] **gdpr/**
      - [ ] execute-deletions.ts
    - [ ] **notifications/**
      - [ ] core.ts
      - [ ] email-templates.ts
      - [ ] index.ts
      - [ ] marketplace-notifications.ts
      - [ ] pledge-notifications.ts
      - [ ] project-notifications.ts
      - [ ] social-notifications.ts
      - [ ] types.ts
    - [ ] **oauth/**
      - [ ] config.ts
    - [ ] **payments/**
      - [ ] **divinitycoin/**
        - [ ] cards.ts
        - [ ] client.ts
        - [ ] config.ts
        - [ ] index.ts
        - [ ] payments.ts
        - [ ] types.ts
        - [ ] webhooks.ts
      - [ ] **paypal/**
        - [!] capture-authorized.ts
        - [ ] checkout.ts
        - [ ] config.ts
        - [ ] index.ts
      - [ ] **stripe/**
        - [!] charges.ts
        - [ ] checkout.ts
        - [ ] config.ts
        - [ ] connect.ts
        - [ ] customers.ts
        - [ ] index.ts
        - [ ] intents.ts
        - [x] rewards.ts
        - [!] webhooks.ts
      - [ ] **whop/**
        - [ ] checkout.ts
        - [ ] config.ts
        - [ ] index.ts
    - [ ] **recommendations/**
      - [ ] engine.ts
    - [ ] **seo/**
      - [ ] indexing.ts
    - [ ] **stats/**
      - [ ] actions.ts
      - [ ] index.ts
      - [ ] utils.ts
    - [ ] **stores/**
      - [ ] project-store.ts
    - [ ] **tracking/**
      - [ ] index.ts
    - [ ] **utils/**
      - [ ] api-params.ts
      - [ ] sanitize.ts
    - [ ] api-error.ts
    - [ ] audit.ts
    - [ ] auth-helpers.ts
    - [ ] bot-blocker.ts
    - [ ] circuit-breaker.ts
    - [ ] consent.ts
    - [ ] correlation.ts
    - [ ] csrf.ts
    - [ ] email.ts
    - [ ] encryption.ts
    - [ ] error-tracker.ts
    - [ ] feature-flags.ts
    - [ ] fetch-utils.ts
    - [ ] local-books-db.ts
    - [ ] logger.ts
    - [ ] metrics.ts
    - [ ] notifications.ts
    - [ ] og-image-dimensions.ts
    - [ ] pdf-cover-extractor.ts
    - [ ] project-auth.ts
    - [ ] project-permissions.ts
    - [ ] r2.ts
    - [ ] rate-limiter.ts
    - [ ] retailer-auth.ts
    - [ ] seo-audit.ts
    - [ ] seo-defaults.ts
    - [ ] shopify-push.ts
    - [ ] shufti.ts
    - [ ] stats.ts
    - [ ] tracking.ts
    - [ ] usePdfAsImages.ts
    - [ ] utils.ts
    - [ ] vault.ts
  - [ ] **pages/**
    - [ ] _error.js
  - [ ] **types/**
    - [ ] api.ts
    - [ ] index.ts
  - [ ] instrumentation.ts
  - [x] middleware.ts
- [ ] debug-stats.js
- [ ] ecosystem.config.js
- [ ] eslint.config.mjs
- [ ] next.config.js
- [ ] postcss.config.js
- [ ] prisma.config.ts
- [ ] tailwind.config.ts
- [ ] vitest.config.ts