# WhiteLabelFlip

Plan of attack for the DivinityCoin (DC) upgrade: receive the new
`payment.requires_action` webhook, adopt the white-label hosted
checkout, and ultimately hide Stripe from our origin entirely.

Scope of this round: **Phase 1 → Phase 3**. Phase 4 (full Stripe
removal) is documented for context but only ships after Phase 3 has
been stable in production for 7-14 days.

---

## Decisions Made (Mike + Claude)

- [x] Rollout granularity: Phase 1 ships as a standalone commit first
      so webhook handling can be verified in isolation. Phase 2 lands
      separately, behind the env flag.
- [x] `partnerLogoUrl`: passed explicitly on every
      `create-checkout-session` call. Easier staging + we stay in
      control if DC loses their stored copy.
- [x] `payment.requires_action` recovery UX (Phase 1): log + email
      only. No recovery page built yet — that flow becomes "redirect
      to a new hosted checkout session" in Phase 4, so building a
      Stripe Elements recovery page now would be throwaway work.

---

## Backwards-Compatibility Guarantees

Every state transition that updates campaign counters routes through
the same helper. Whether the trigger is direct-Elements
`payment.succeeded`, hosted-checkout `checkout.completed`, or the
cron `verify-payment` sweep, they all converge on the same commit
primitive. The existing CAS pattern (atomic
`confirmationEmailSent: false → true` flip) prevents double-counting
under any combination of triggers.

| Concern | Today | Phase 1 (additive) | Phase 2 (opt-in) | Phase 4 (cleanup) |
| --- | --- | --- | --- | --- |
| Existing PENDING pledges (Elements) | `/confirm-dc-setup` + `payment.succeeded` | unchanged | unchanged | unchanged — legacy route kept for stragglers |
| Campaign progress (`currentAmount`, `backerCount`, reward/addon slots) | `confirm-dc-setup` (saved-card) or `handlePaymentSucceeded` (immediate) | unchanged | new checkout-callback delegates to existing helpers — same counters, same CAS | unchanged |
| In-flight 3DS challenges | inline Elements → `confirm-dc-setup` | unchanged + new `payment.requires_action` webhook as backstop | unchanged | replaced by hosted checkout redirect |
| Off-session charges (`charge-saved-payment-method`) | synchronous response | unchanged + webhook backstop | unchanged | unchanged |
| Webhook idempotency (`payment.succeeded` + `checkout.completed` both fire in PAYMENT mode) | n/a | dedupe via pledge status check (no-op if already `COMPLETED`) | dedupe | dedupe |
| Cron safety net (`verifyStuckDcImmediateCharges`) | `verify-payment` | unchanged | unchanged (works for both flows) | unchanged |
| Refunds (`refund.completed`) | `handleRefundCompleted` | unchanged | unchanged | unchanged |
| Settlement webhooks (`settlement.*`) | already handled | unchanged | unchanged | unchanged |

---

## White-Label / Stripe-Hiding Confirmation

- Hosted checkout runs at `divinitycoin.com/checkout/cs_...`. Card
  capture, 3DS, brand UI, any Stripe Elements rendering — all on DC's
  domain.
- After Phase 4 cleanup, indiecrowdfund.com loads **zero Stripe
  code**: `@stripe/stripe-js` and `@stripe/react-stripe-js` removed
  from `package.json`; `js.stripe.com`, `api.stripe.com`,
  `hooks.stripe.com` removed from CSP in `src/proxy.ts`.
- DevTools on our origin shows only divinitycoin.com network traffic.
  Network tab, Sources tab, console — nothing Stripe.
- DC docs explicitly state: *"any Stripe Elements branding to live
  entirely on divinitycoin.com rather than your own page."* Matches
  the "I don't want anyone opening the network tab and seeing
  divinitycoin is using stripe" requirement on our domain.
- Caveat: what users see on divinitycoin.com is DC's surface. They've
  told us it's white-labelable via `partnerLogoUrl` + `description`.

---

## Phase 1 — Additive Support (zero customer impact)

Goal: receive the new webhook events, add lib helpers, no UI / pledge
flow change.

- [x] Add `divinityCoinCheckoutSessionId String? @unique` to Pledge
      model in `prisma/schema/pledge.prisma`
- [x] Hand-written SQL migration:
      `prisma/migrations/add_dc_checkout_session.sql` — single
      `ALTER TABLE "Pledge" ADD COLUMN "divinityCoinCheckoutSessionId" TEXT`
      + `CREATE UNIQUE INDEX`. Instant, no table rewrite, existing
      pledges get NULL
- [x] Create `src/lib/payments/divinitycoin/checkout-sessions.ts`
      with `createDcCheckoutSession()` + `getDcCheckoutSession()`
      wrappers around `callDivinityCoinAPI`. Plain helpers; no
      callers yet
- [x] Extend `src/lib/payments/divinitycoin/types.ts` with
      `CheckoutCompletedEvent`, `CheckoutFailedEvent`,
      `CheckoutExpiredEvent`, `CheckoutCanceledEvent`,
      `PaymentRequiresActionEvent` payload types
- [x] Add 5 new cases to the switch in
      `src/lib/payments/divinitycoin/webhooks.ts:122` —
      `payment.requires_action`, `checkout.completed`,
      `checkout.failed`, `checkout.expired`, `checkout.canceled`
- [x] Implement handlers in `src/lib/payments/divinitycoin/payments.ts`:
      `handlePaymentRequiresAction`, `handleCheckoutCompleted`,
      `handleCheckoutFailed`, `handleCheckoutExpired`,
      `handleCheckoutCanceled`. All idempotent: check pledge status,
      no-op if already `COMPLETED` / `FAILED` / `CANCELLED`
- [x] `handlePaymentRequiresAction` persists the clientSecret to the
      pledge metadata. Recovery email **deferred** to Phase 4: a
      "your card needs verification" email with no recovery
      destination is noise, and Phase 4 wires the email link into a
      hosted-checkout setup session anyway. Admin can act on the
      persisted state if intervention is needed before then.
- [x] Extend the `eventTypes` self-documentation array in
      `src/app/api/webhooks/divinitycoin/route.ts:80-160` so the GET
      response advertises the new events
- [x] Add Prometheus counters in `src/lib/metrics.ts`:
      `dcWebhookEvents{event}` — incremented in
      `src/lib/payments/divinitycoin/webhooks.ts` before the dispatch
      switch so every event is tallied regardless of handler outcome
- [x] Lint + typecheck clean
- [x] Commit + push (standalone commit, separate from Phase 2)

---

## Phase 2 — Opt-in Hosted Checkout (behind env flag)

Goal: new pledges route to hosted checkout when
`DIVINITYCOIN_HOSTED_CHECKOUT=true`. Default off. Existing flow
untouched.

### Server-side

- [ ] Add `hostedCheckoutEnabled` flag (env-driven) to
      `src/lib/payments/divinitycoin/config.ts`
- [ ] Refactor the bookkeeping in
      `src/app/api/pledges/[pledgeId]/confirm-dc-setup/route.ts` into
      a shared `commitDcPledge()` helper in
      `src/lib/payments/divinitycoin/commit-pledge.ts`. Confirm
      behavior is byte-identical for existing callers (atomic CAS,
      counter increments, reward/addon claims, backer-number
      assignment, confirmation email, creator notification)
- [ ] Update `confirm-dc-setup` route to call the new shared helper
- [ ] In `src/app/api/pledges/route.ts` DC branch
      (lines ~238-495): when `hostedCheckoutEnabled` is true, call
      `createDcCheckoutSession()` with mode `setup` (AoN-unfunded) or
      `payment` (KIA / AoN-funded). Pass
      `returnUrl = ${BASE}/projects/[vanityname]/[slug]/pledge/return?pledgeId=...`,
      `partnerLogoUrl = ${BASE}/logo.png` (explicit, per decision
      above), `description = "Pledge to ${project.title}"`. Persist
      `divinityCoinCheckoutSessionId`. Return
      `{ checkoutUrl, sessionId, intentType: "hosted_checkout", pledgeId }`
- [ ] Create `src/app/api/pledges/[pledgeId]/confirm-dc-checkout/route.ts`
      POST endpoint. Pulls pledge, calls `getDcCheckoutSession()`, on
      `status=complete` runs `commitDcPledge()`. Atomic CAS dedupes
      against the webhook
- [ ] Flesh out `handleCheckoutCompleted` (from Phase 1) to also run
      `commitDcPledge()` when the pledge is still PENDING. Either
      path can win — CAS guarantees one commits, other is no-op

### Client-side

- [ ] Create return page:
      `src/app/projects/[vanityname]/[slug]/pledge/return/page.tsx`.
      Reads `?session_id=...&pledgeId=...` from query, POSTs to
      `/api/pledges/[pledgeId]/confirm-dc-checkout`, on success
      redirects to `/projects/[...]/pledge/success`, on failure shows
      retry / contact-support UI
- [ ] In `src/app/projects/[vanityname]/[slug]/pledge/hooks/usePledge.ts`:
      detect `intentType === "hosted_checkout"` response and
      `window.location.href = checkoutUrl`. Skip Elements mount
      entirely on this path
- [ ] Verify the Elements path (existing `setup_intent` / `payment_intent`
      responses) still works when the flag is off — no regressions in
      `PaymentStep.tsx` / `DCPaymentWrapper.tsx` / `StripePaymentForm.tsx`

### Telemetry

- [ ] Add metric `pledgesByDcFlow{flow="elements"|"hosted_checkout"}`
- [ ] Add metric `dcHostedCheckoutSessionsCreated`,
      `dcHostedCheckoutSessionsCompleted`,
      `dcHostedCheckoutSessionsAbandoned`

### Verification

- [ ] Lint + typecheck clean
- [ ] Manual test with flag off: existing flow unchanged
- [ ] Manual test with flag on (dev only): create pledge → redirect
      to DC → complete card → redirect back → pledge COMPLETED →
      counters updated correctly → email sent
- [ ] Manual test the dedupe: trigger both `payment.succeeded` AND
      `checkout.completed` against the same pledge; confirm exactly
      one commit
- [ ] Manual test SETUP mode: AoN-unfunded pledge → DC saves card →
      `checkout.completed` fires → pledge committed via
      `commitDcPledge` → no double-count vs. existing
      `confirm-dc-setup` callers
- [ ] Commit + push (separate commit from Phase 1)

---

## Phase 3 — Default-on + Monitor

Goal: flip the flag in production. Verify everything works at real
volume. Drain in-flight Elements pledges.

- [ ] Flip `DIVINITYCOIN_HOSTED_CHECKOUT=true` in production env
- [ ] Watch for 1-2 weeks:
  - [ ] `pledgesByDcFlow` ratio shifts to ~100% hosted_checkout for
        new pledges
  - [ ] `dcWebhookEventsTotal{event="checkout.completed"}` matches
        `dcHostedCheckoutSessionsCompleted`
  - [ ] Funnel: `dcHostedCheckoutSessionsCreated` →
        `dcHostedCheckoutSessionsCompleted` ratio sane
        (compare against historic Elements completion rate)
  - [ ] No spike in `pledgesByDcFlow{flow="elements"}` failures from
        old in-flight pledges
  - [ ] No spike in 5xx on `/api/webhooks/divinitycoin`
  - [ ] No spike in 5xx on `/api/pledges/[id]/confirm-dc-checkout`
  - [ ] `verifyStuckDcImmediateCharges` cron not picking up an
        unusually high number of stuck pledges
- [ ] If anything looks wrong: flip the flag back. No DB rollback
      needed — `divinityCoinCheckoutSessionId` stays as a NULL column
      on new pledges
- [ ] After ~14 days stable, schedule Phase 4

---

## Phase 4 — Cleanup (out of scope this round; documented for context)

Only after Phase 3 has been stable for 7-14 days. Mechanical removal,
but touches 5+ client-side files.

- [ ] Delete `src/app/projects/[vanityname]/[slug]/pledge/components/DCPaymentWrapper.tsx`
- [ ] Delete `src/app/projects/[vanityname]/[slug]/pledge/components/StripePaymentForm.tsx`
- [ ] Strip Stripe branches from `src/app/projects/[vanityname]/[slug]/pledge/components/PaymentStep.tsx`
- [ ] Strip `loadStripe` + Stripe state from `src/app/projects/[vanityname]/[slug]/pledge/hooks/usePledge.ts`
- [ ] Replace Elements with hosted-checkout redirect in
      `src/app/dashboard/pledges/[pledgeId]/complete-with-dc/page.tsx`
      (uses `create-checkout-session` in setup mode)
- [ ] Replace Elements with hosted checkout in
      `src/app/dashboard/pledges/[pledgeId]/survey/page.tsx` +
      `SurveyPaymentStep.tsx`
- [ ] Replace Elements with hosted checkout in
      `src/app/marketplace/books/[slug]/page.tsx`
- [ ] Replace Elements with hosted checkout in
      `src/app/pay/balance/[token]/page.tsx`
- [ ] Build the `payment.requires_action` recovery flow using hosted
      checkout (new session, not Elements)
- [ ] Remove `@stripe/stripe-js` + `@stripe/react-stripe-js` from
      `package.json`
- [ ] Remove `js.stripe.com`, `api.stripe.com`, `hooks.stripe.com`
      from CSP in `src/proxy.ts:528,543,544`
- [ ] Mark `confirm-dc-setup` route as deprecated in JSDoc but keep
      it for any straggler legacy pledges
- [ ] Verify on production: DevTools network tab shows zero Stripe
      requests on indiecrowdfund.com

---

## Risk Register

1. **Schema migration safety:** the new
   `divinityCoinCheckoutSessionId` column is NULLable with no FK —
   single `ALTER TABLE ADD COLUMN` is instant, no table rewrite. No
   rollback needed.
2. **Webhook race** (`payment.succeeded` arrives before
   `checkout.completed` in PAYMENT mode): both handlers check pledge
   state. First to flip `confirmationEmailSent: false → true` wins,
   second is no-op. Existing CAS pattern, not new.
3. **User abandons hosted checkout:** `checkout.expired` /
   `checkout.canceled` webhooks fire. Handler leaves the pledge as
   PENDING and lets the existing abandoned-cart cleanup cron handle
   it.
4. **Refund flow regression:** existing `refund.completed` handler
   operates by `paymentId` / `pledgeId`. Hosted-checkout pledges have
   the same `divinityCoinPaymentId` populated (DC creates the PI
   up-front in PAYMENT mode), so refunds work identically.
5. **Per-call coexistence:** even with the env flag on, we can still
   call the legacy `create-setup-intent` / `create-payment-intent`
   if needed. Phase 2 just flips the default for new pledges.
6. **Mid-deploy in-flight pledge:** a backer hits Pledge right as we
   deploy. Their browser has the old bundle (expects Elements
   response); the server returns hosted-checkout response. Mitigation:
   the client `usePledge.ts` change in Phase 2 also tolerates the
   legacy response shape on the way down, and the new response
   `intentType: "hosted_checkout"` is purely additive — old clients
   that don't recognise it fall through to an error toast and retry
   (which would then hit the new client bundle after page refresh).

---

## File Inventory (everything that changes in Phase 1-3)

### New files
- `prisma/migrations/add_dc_checkout_session.sql`
- `src/lib/payments/divinitycoin/checkout-sessions.ts`
- `src/lib/payments/divinitycoin/commit-pledge.ts`
- `src/app/api/pledges/[pledgeId]/confirm-dc-checkout/route.ts`
- `src/app/projects/[vanityname]/[slug]/pledge/return/page.tsx`

### Modified files
- `prisma/schema/pledge.prisma`
- `src/lib/payments/divinitycoin/config.ts`
- `src/lib/payments/divinitycoin/types.ts`
- `src/lib/payments/divinitycoin/webhooks.ts`
- `src/lib/payments/divinitycoin/payments.ts`
- `src/app/api/webhooks/divinitycoin/route.ts`
- `src/app/api/pledges/route.ts`
- `src/app/api/pledges/[pledgeId]/confirm-dc-setup/route.ts`
  (refactor only — extract `commitDcPledge` helper)
- `src/app/projects/[vanityname]/[slug]/pledge/hooks/usePledge.ts`

### Production env (Phase 3)
- `DIVINITYCOIN_HOSTED_CHECKOUT=true`
