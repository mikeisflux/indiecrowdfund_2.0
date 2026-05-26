# IndieCrowdfund — Site UX & Usability Audit

**Date:** 2026-05-19
**Scope:** Full public + authenticated site — discovery, conversion, creator tools, backer tools, auth, global chrome.
**Method:** Code-level audit of pages, components, and markup (flows, states, copy, accessibility, responsiveness, consistency). This is not a live click-through — findings are read from the source, so a handful may already be mitigated; each should be verified before/while fixing.

---

## Executive Summary

The site is feature-complete and the core flows work, but the audit surfaced **~90 discrete UX issues**. They cluster into six recurring themes — fixing the theme-level root causes resolves most individual findings:

1. **Missing or weak empty states.** Comments, project sections, IndieKit tabs, dashboards — several render blank or ambiguous space when there's no data, instead of a helpful message + CTA.
2. **Spinners with no escape hatch.** Multiple loading states (payment setup, dashboards) can hang with no error fallback and no "try again."
3. **Accessibility gaps — icon-only controls.** Theme toggle, share, follow, shipping-info, and social buttons frequently lack `aria-label`s; several images lack alt text; heading hierarchy skips levels in places.
4. **Destructive actions under-guarded.** IndieKit "Lock Orders" / "Charge Cards" and Digital Shop deletes use raw `confirm()` or fire immediately — high blast radius, easy misclick.
5. **Multi-step forms lose work.** The project builder and Digital Shop upload wizards keep step state in memory only — a refresh or navigation wipes everything; no "unsaved changes" guard.
6. **Stale copy + inconsistent terminology.** Post-rename leftovers ("Marketplace" / "Discover"), `href="#"` dead links, and step/button labels that differ across screens for the same action.

**Top 10 highest-impact fixes** (detailed below): #B1, #B3, #B5, #C5, #C7, #A5, #C9, #B2, #A1, #D1.

---

## A. Public Discovery — Home, Crowdfunds, Project Pages

| # | Sev | Issue | Location | Fix |
|---|-----|-------|----------|-----|
| A1 | High | All three featured-project sections can silently render blank with no fallback message | `src/app/page.tsx` (~452-555) | Show "No projects available yet" when all sections return 0 |
| A2 | High | Project-detail share/follow icon buttons fall below the 44×44px touch-target minimum on mobile | `src/app/projects/[vanityname]/[slug]/page.tsx` (~776-790) | Enlarge tap targets or add visible labels on mobile |
| A3 | High | Crowdfunds mobile filter bar gives no indication which filters are active when collapsed | `src/app/crowdfunds/page.tsx` (~320-341) | Surface an active-filter count/badges on mobile, not just desktop sidebar |
| A4 | High | Project-card creator avatars use `alt=""` — invisible to screen readers | `src/app/crowdfunds/page.tsx` (~690, 851) | Set `alt={project.creator.name}` |
| A5 | High | Comments section has zero empty state — blank space, no "be the first to comment" | `src/components/project-details/tabs/comments-tab.tsx` | Add an empty-state message + CTA |
| A6 | Med | Heading hierarchy skips `h2` (jumps `h1` → `h3`) on the Crowdfunds page | `src/app/crowdfunds/page.tsx` (~279, 563) | Use `h2` for section/empty-state headings |
| A7 | Med | Sticky project-detail header truncates long titles; "Manage Pledge" pushes the title off-screen at ~768px | `src/app/projects/[vanityname]/[slug]/page.tsx` (~528-532) | Add ellipsis + test the tablet breakpoint |
| A8 | Med | Crowdfunds sticky filter bar eats ~60px of viewport on scroll (~19% on a 320px screen) | `src/app/crowdfunds/page.tsx` (~292) | Collapse the bar on mobile scroll or reduce its height |
| A9 | Med | Project-detail tabs scroll horizontally on mobile with no scroll affordance — users miss Updates/Comments/Community | `src/app/projects/[vanityname]/[slug]/page.tsx` (~861) | Add an edge-fade gradient or scroll indicator |
| A10 | Med | Rewards sidebar scrolls independently; selecting a reward off-screen gives no feedback | `src/components/project-details/tabs/rewards-tab.tsx` | Scroll the selected reward into view |
| A11 | Med | Funding-amount "Info" icon is hover-only — keyboard + screen-reader users can't reach the explanation | `src/app/projects/[vanityname]/[slug]/page.tsx` (~678) | Use an accessible popover / `aria-describedby` |
| A12 | Low | `href="#"` dead links: "All or nothing" explainer, "Be constructive" guidelines, creator-bio "See more" | project page ~803; comments-tab ~404; campaign-tab ~148 | Point to real pages or implement the toggle |
| A13 | Low | "Clear all filters" empty-state CTA shows even when no filters are applied | `src/app/crowdfunds/page.tsx` (~567) | Swap to "Browse all projects" when `activeFilterCount === 0` |
| A14 | Low | Home skeleton shows 3 cards but sections render 6 — layout jank on load | `src/app/page.tsx` (~396) | Render skeleton count to match the query `take` |
| A15 | Low | Countdown shows "0 days" in the final 24h — no urgency for last-minute backers | project page (~710-713) | Show "23h 45m left" under 24h |
| A16 | Low | Background animated orbs have no `prefers-reduced-motion` guard (also a low-end-GPU concern) | `src/app/page.tsx` (~801-803) | Gate animation on `prefers-reduced-motion` |
| A17 | Low | Copy drift: "Discover Projects" vs "Explore Projects"; small avatar initials at `text-[10px]` | home vs crowdfunds | Standardize wording; bump initials to `text-xs` |

---

## B. Conversion Funnel — Pledge Flow, Digital Shop, Cart, Checkout

| # | Sev | Issue | Location | Fix |
|---|-----|-------|----------|-----|
| B1 | High | Pledge breadcrumb has no visual distinction between current / done / upcoming steps | `pledge/components/Breadcrumb.tsx` | Style active (filled) and completed (check) states distinctly |
| B2 | High | "Setting up payment…" spinner can hang with no error + no escape (partially mitigated by a 30s timeout already added — verify it covers the hosted-checkout + setup-intent paths) | `pledge/components/OrderSummary.tsx` | Confirm the timeout → error-with-retry path fires on every processor branch |
| B3 | High | `/cart` silently redirects to `/shop` with no explanation | `src/app/cart/page.tsx` | Explain (or remove the route) — a silent redirect reads as a bug |
| B4 | High | Shop purchase errors close the modal with no reason shown and no retry | `src/app/shop/books/[slug]/page.tsx` | Keep modal open on error, show a specific reason + retry |
| B5 | High | Disabled breadcrumb steps still look clickable (no `opacity`/`cursor` change) | `pledge/components/Breadcrumb.tsx` (~50-52) | Add `disabled:opacity-50 disabled:cursor-not-allowed` |
| B6 | High | Shop payment modal shows all 3 processor buttons even when the item allows only one — clicking the others fails confusingly | `src/app/shop/books/[slug]/page.tsx` (~918) | Hide unavailable processors; show "Seller accepts X only" |
| B7 | High | All-or-Nothing vs Keep-It-All charge timing is disclosed only on the final payment step | `pledge/components/OrderSummary.tsx` | Move the "when you're charged" disclosure to the rewards step |
| B8 | Med | "Continue" button label is identical on every pledge step — unclear intent | `OrderSummary.tsx` (~122, 214, 306) | Contextual labels: "Continue to Payment", "Confirm & Pay" |
| B9 | Med | Bonus-support input has no max — accepts "$999999" with no validation | `OrderSummary.tsx` (~274) | Add a sane max + inline validation |
| B10 | Med | Address warning banner is not dismissible and reappears every session | `pledge/components/AddressWarning.tsx` | Add a dismiss control; remember the choice |
| B11 | Med | Shipping cost updates in RewardSelector on country change but not in OrderSummary until the next step | `pledge/` RewardSelector + OrderSummary | Recalculate the sidebar total on country change |
| B12 | Med | Shop loading skeleton (16 tiles, 8-col grid) doesn't match the mobile 2-col layout — jarring reflow | shop listing components | Match skeleton count/grid to the responsive breakpoints |
| B13 | Med | Promo-code field auto-uppercases each keystroke with no explanation; no "applied" confirmation | `src/app/shop/books/[slug]/page.tsx` (~879) | Note "case-insensitive"; show a green "applied" state |
| B14 | Med | Shop gallery thumbnails clip on <375px screens with no lightbox/expand | `src/app/shop/books/[slug]/page.tsx` (~518) | Add a lightbox; or 2-col on all breakpoints |
| B15 | Low | Custom "pledge without reward" amount can clear to `NaN` in the button with no validation message | `pledge/` (~72) | Inline error: "Pledge must be at least $1" |
| B16 | Low | `PaymentStep` heading always says "Confirm your payment method" even in setup-intent (card-save) mode | `pledge/components/PaymentStep.tsx` (~176) | "Save your card" for setup-intent, "Confirm payment" otherwise |
| B17 | Low | Promo-code input has no associated `<label>` (placeholder ≠ label) | `src/app/shop/books/[slug]/page.tsx` (~877) | Add a real label with `htmlFor` |
| B18 | Low | Shipping-info icon button has no `aria-label` | `pledge/` RewardSelector (~137) | Add `aria-label` + `title` |
| B19 | Low | Success page confetti has no `prefers-reduced-motion` guard | `pledge/components/SuccessPage.tsx` (~44-62) | Disable animation under reduced-motion |
| B20 | Low | Terminology drift: "Reward" vs "Your pledge" across steps; back-link still reads "Back to Marketplace" | `OrderSummary.tsx`; shop detail back-link | Standardize wording (and "Marketplace" → "Digital Shop") |

---

## C. Creator Surfaces — Dashboard, Project Builder, IndieKit, Shop Management

| # | Sev | Issue | Location | Fix |
|---|-----|-------|----------|-----|
| C1 | High | Switching projects mid-edit on the dashboard has no unsaved-changes guard | `src/app/dashboard/page.tsx` (~174-176) | Confirm before switching when state is dirty |
| C2 | High | Project builder has no `beforeunload` / navigation guard — closing the tab loses the whole campaign draft | `src/components/project/builder/project-builder.tsx` | Add an unsaved-changes warning |
| C3 | High | Project builder save button has a loading state but no success state — unclear it saved | `project-builder.tsx` (~53-54) | Add a brief "Saved" state or toast |
| C4 | High | Digital Shop deletes use raw browser `confirm()` — unbranded, easy to miss on mobile | `src/app/dashboard/shop/page.tsx` (~139, 200) | Replace with the styled `AlertDialog` showing consequences |
| C5 | High | Digital Shop upload wizard keeps steps 1-4 in `useState` only — navigating away wipes all input | `src/app/dashboard/shop/books/new/page.tsx` (~658-706) | Persist to URL `?step=` or a draft API |
| C6 | High | IndieKit "Lock Orders" fires the API directly — no confirmation; one misclick is irreversible for 50+ backers | `src/app/dashboard/indiekit/page.tsx` (~325-373) | Add an `AlertDialog` + preview before executing |
| C7 | High | IndieKit "Charge Cards" dialog truncates the backer list ("and X more…") — creator can't verify full scope before charging | `src/app/dashboard/indiekit/page.tsx` (~898-1040) | Show the full list (scrollable) or an explicit count + total |
| C8 | Med | Dashboard empty state ("Select a project") gives no guidance on how | `src/app/dashboard/page.tsx` (~579-581) | Add a one-line "pick a project from the dropdown above" |
| C9 | Med | No first-run / "create your first project" guided path for brand-new creators | `src/app/dashboard/page.tsx` (~250-267) | Add an onboarding empty state with next steps |
| C10 | Med | Builder progress bar is `(step+1)/total` — doesn't reflect real completion, misleads | `project-builder.tsx` (~63) | Base progress on completed/validated steps |
| C11 | Med | Builder validation errors toast then vanish — fields aren't highlighted afterward | `project-builder.tsx` (~70-74) | Persist inline field-level error state |
| C12 | Med | No autosave / "saving…" indicator in the builder — unclear if a crash lost work | `project-builder.tsx` (~65-67) | Add autosave + a visible save status |
| C13 | Med | Shop upload step lives in state, not URL — a refresh resets to Step 1 with no resume | `src/app/dashboard/shop/books/new/page.tsx` | Put the step in the URL |
| C14 | Med | Genre dropdown silently clears when the media category changes | `src/app/dashboard/shop/books/new/page.tsx` (~864-867) | Warn, or preserve the selection where valid |
| C15 | Med | IndieKit phase selector doesn't show which phase is active | `src/app/dashboard/indiekit/page.tsx` (~596-598) | Add an active-state style to the phase buttons |
| C16 | Med | IndieKit tab switches reset scroll to top — context lost in long lists | `src/app/dashboard/indiekit/page.tsx` (~574-623) | Preserve scroll per tab |
| C17 | Med | IndieKit email access is gated with jargon ("approved prelaunch page or campaign") | `src/app/dashboard/components/EmailTab.tsx` (~91-94) | Plain-language explanation + docs link |
| C18 | Med | Dashboard has 8+ tabs with no hierarchy — unclear where to start | `src/app/dashboard/page.tsx` (~371-487) | Group/prioritize; lead with the most-used |
| C19 | Med | Digital Shop dashboard header + "Upload" dropdown collapse awkwardly on mobile | `src/app/dashboard/shop/page.tsx` (~263-337) | Reflow header for small screens |
| C20 | Low | Builder form labels frequently lack `htmlFor` — breaks screen-reader association | `src/components/project/builder/basics-step.tsx` | Wire `htmlFor`/`id` on every label-input pair |
| C21 | Low | IndieKit workflow buttons ("Lock Orders", "Charge Cards") have no tooltip explaining what they do | `indiekit/components/layout/WorkflowProgress.tsx` | Add help text/tooltips |
| C22 | Low | Dashboard email unread badge causes nav jitter (variable digit width + pulse) | `src/app/dashboard/page.tsx` (~427-430) | Fixed-width badge |

---

## D. Backer Tools, Auth & Global Chrome

| # | Sev | Issue | Location | Fix |
|---|-----|-------|----------|-----|
| D1 | High | `/choose-role` doesn't explain what a "role" is or why it's needed | `src/app/choose-role/page.tsx` | Add a one-line explainer + Creator/Backer icons & descriptions |
| D2 | High | Theme-toggle button has no `aria-label` | `src/components/site-header.tsx` (~270/313) | Add `aria-label="Toggle dark mode"` |
| D3 | Med | Register password rule shown is "At least 8 characters" but uppercase + number are also required — user finds out mid-typing | `src/components/auth/register-form.tsx` (~238) | State all rules upfront |
| D4 | Med | reCAPTCHA failing to load leaves users stuck with no messaging | `src/components/auth/login-form.tsx` (~192) | Show a fallback message on CAPTCHA timeout |
| D5 | Med | Global `error.tsx` shows generic "Something went wrong" with no error code or self-serve path | `src/app/error.tsx` (~53) | Show the `digest` code + a link to /help |
| D6 | Med | Review dialog lets users rate sub-criteria before the overall rating — confusing primary/secondary | `src/app/dashboard/backer/page.tsx` (~1354) | Require overall rating first, then expand the rest |
| D7 | Med | "Bug Report/Changelog" header dropdown is vague + has no `aria-label` | `src/components/site-header.tsx` (~224) | Rename "Help & Updates" / add aria-label |
| D8 | Med | Address dialog body scrolls with no scroll affordance on <600px screens | `src/app/dashboard/backer/components/address-management-tab.tsx` (~401) | Add a scroll hint |
| D9 | Med | Mobile search-suggestions dropdown can be clipped by the on-screen keyboard | `src/components/site-header.tsx` (~354) | Cap height + internal scroll; close on blur |
| D10 | Med | Refund-request dialog doesn't hint that a reason is required until it's open | `src/app/dashboard/pledges/[pledgeId]/page.tsx` (~124) | Pre-dialog note: "you'll need to provide a reason" |
| D11 | Low | `verify-email` success gives no real next-step guidance ("Go to Dashboard" means nothing to a new user) | `src/app/verify-email/page.tsx` (~86) | "You're verified — browse Crowdfunds or finish your profile" with links |
| D12 | Low | `not-found.tsx` (404) has no search affordance — users may retry the dead URL | `src/app/not-found.tsx` (~19) | Add a search box or "search projects" CTA |
| D13 | Low | "Add Address" / "Edit" address buttons share no distinguishing `aria-label` | `address-management-tab.tsx` (~253) | `aria-label="Add new address"` / `"Edit {label} address"` |
| D14 | Low | Stale terminology in handbooks — "Marketplace", "Discover" still appear post-rename | `src/app/backer-handbook/`, other handbook pages | Find/replace to "Digital Shop" / "Crowdfunds" |
| D15 | Low | "Retailers" nav item is unexplained (B2B? comic shops?) | `src/components/site-header.tsx` (~218) | Tooltip, or move under a dropdown |
| D16 | Low | Backer dashboard skeleton always shows 3 stat cards regardless of real data volume | `src/app/dashboard/backer/page.tsx` (~504) | Match skeleton to expected layout |
| D17 | Low | Dark-mode contrast risk: hard-coded blue text on blue-tinted info panels | `address-management-tab.tsx` (~260); `survey-hub-tab.tsx` | Verify WCAG AA; adjust dark text tokens |
| D18 | Low | Keyboard users tab through 12-16 dashboard nav buttons to reach content — no skip link | `src/app/dashboard/backer/page.tsx` (~714) | Add a skip-to-content link |

---

## Cross-Cutting Themes (fix once, resolves many)

**Accessibility**
- Icon-only buttons missing `aria-label`: theme toggle (D2), share/follow (A2), shipping-info (B18), Add/Edit address (D13), dashboard nav (C/D). → Sweep every `size="icon"` button and ensure an `aria-label` or `sr-only` span.
- Images missing `alt`: project-card avatars (A4) and likely others. → Audit every `<Image>` / `<img>`.
- Heading hierarchy skips levels (A6) on multiple pages. → One `h1`, then sequential `h2`/`h3`.
- Form labels not associated (`htmlFor`/`id`) — builder (C20), promo code (B17). → Lint rule + sweep.
- No `prefers-reduced-motion` guard on confetti (B19) and background orbs (A16).
- No skip-to-content link (D18).

**Loading / empty / error states**
- Empty states missing or unhelpful: comments (A5), home sections (A1), IndieKit tabs (C), dashboards (C8). → Standardize an `<EmptyState>` component (icon + message + CTA) and use it everywhere a list can be empty.
- Spinners with no timeout/escape (B2). → Every loading state needs a timeout → error-with-retry.
- Generic global error page (D5). → Include the error code + a help link.

**Destructive actions**
- IndieKit lock/charge (C6, C7) and shop deletes (C4) need consistent `AlertDialog` confirmation with a clear consequence preview. → Standardize a `<ConfirmDialog>` and ban raw `confirm()`.

**Multi-step forms losing work**
- Builder (C2, C12) and shop upload (C5, C13) keep step state in memory. → Persist step + draft to URL/localStorage/API; add `beforeunload` guards.

**Copy & consistency**
- Dead `href="#"` links (A12). Stale "Marketplace"/"Discover" copy in handbooks + comments (D14, B20). Inconsistent button/step labels (B8, A17, B20). → A copy pass + a CI grep for `href="#"`.

**Mobile**
- Tap targets under 44px (A2), sticky bars eating viewport (A8), skeleton/grid mismatch (B12), header collapse (C19), keyboard-clipped dropdowns (D9).

---

## Recommended Fix Priority

**Tier 1 — ship first (correctness / money / data-loss / a11y blockers)**
B3 (cart redirect), B6 (wrong processor buttons), B7 (charge-timing disclosure), C5 + C2 (form data loss), C6 + C7 (IndieKit destructive actions), B2 (verify payment-spinner timeout), A5 + A1 (missing empty states), D1 (choose-role clarity), D2 (theme-toggle a11y).

**Tier 2 — high-value, low-effort**
B1 + B5 (breadcrumb states), B8 (button labels), C4 (styled delete dialog), C3 + C12 (save feedback), A4 + B17 + B18 + D13 (a11y labels), A12 (dead links), D5 (error page), B13 (promo feedback).

**Tier 3 — polish**
The remaining Low-severity items: copy consistency, skeleton matching, reduced-motion guards, countdown granularity, dark-mode contrast, tooltips.

---

## Notes

- Findings are from a static read of the code; line numbers are approximate — confirm against the current file when fixing.
- A few items may already be partially addressed by recent commits (e.g. the pledge-flow 30s payment timeout, the address-dialog scroll fix). B2 and D8 specifically should be re-verified against `main` before reworking.
- Scope did not include performance profiling, SEO, or a live cross-browser/device pass — recommend a follow-up live QA sweep on real devices once the Tier 1 items land.
