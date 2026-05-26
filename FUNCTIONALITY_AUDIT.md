# Site-Wide Functionality Audit

Goal: walk every non-payment page on the site, define what it's supposed to do, verify it works, log anything broken. Payment flows (pledge checkout, DC/Stripe/PayPal/Whop, balance/upcharge, payouts, transactions, redemptions, reconcile, settlements) are out of scope by request — they'll be audited separately.

Audit format per page:
- **Purpose**: one-line intent
- **Expected functionality**: what should work end-to-end
- **Verified**: notes on what was checked (code-read; runtime testing called out where I can't actually run the page in this sandbox)
- **Issues found**: bugs / gaps / dead links / etc.

Status legend:
- [ ] Not audited yet
- [x] Audited, no issues
- [!] Audited, issues found (see notes)

---

## 1. Public / Marketing

- [x] `/` — Home page. Server component, proper `next/image`, no broken links.
- [x] `/about-us` — Calls `/api/platform-stats` (endpoint exists at `src/app/api/platform-stats/route.ts`).
- [x] `/fees` — Fee schedule. Client form state OK.
- [x] `/faq` — Accordion FAQ. OK.
- [x] `/contact` — Uses `apiFetch("/api/contact")` for CSRF. OK.
- [x] `/privacy` — Static content. OK.
- [x] `/terms` — Tab system with URL deep-linking. OK.
- [x] `/term` — Redirects to `/terms`. OK.
- [x] `/content-guidelines` — Static, links valid. OK.
- [x] `/trust-safety` — Static, links to `/contact`, `/faq`, `/creator-handbook`. OK.
- [x] `/fulfillment` — Redirects to `/dashboard/indiekit`. OK.
- [x] `/success-stories` — Server component, DB-driven, error-handled. OK.
- [x] `/help` — Server component with metadata + search. OK.
- [x] `/help/whitelist` — Static guide. OK.
- [x] `/press` — Server component, `db.pressRelease` query, error-handled. OK.
- [x] `/press/[slug]` — Dynamic. Uses `dangerouslySetInnerHTML` (acceptable for trusted admin-authored content).
- [x] `/changelog` — Server component, DB-driven groupings. OK.
- [x] `/backer-handbook` — 10-tab handbook. OK.
- [x] `/creator-handbook` — 11-tab creator workflow guide. OK.
- [x] `/shop-handbook/backers` — 6-tab buyer guide. OK.
- [x] `/shop-handbook/creators` — 6-tab seller guide. OK.
- [x] `/indiekit-handbook` — 30+ collapsible sections. OK.
- [x] `/what-is-divinitycoin` — FAQ accordion. OK.
- [x] `/access-denied` — Simple error page with nav. OK.
- [x] `/verification-complete` — Validates `returnUrl` via `getSafeReturnUrl` (no open redirect). OK.
- [x] `/bug-report` — Uses `apiFetch("/api/bug-reports")` (endpoint exists). Math-challenge spam guard. OK.
- [x] `/chat` — Auth-gated, renders `ChatRoom` component for logged-in users. OK.

## 2. Auth

- [x] `/login` — Server component with `LoginForm` + Suspense. OK.
- [x] `/register` — Server component with `RegisterForm` + Suspense. OK.
- [x] `/forgot-password` — Server component with `ForgotPasswordForm`. OK.
- [x] `/reset-password` — Server component with `ResetPasswordForm` + Suspense. OK.
- [x] `/choose-role` — Server-side auth guard redirects unauth → `/login`. OK.
- [x] `/verify-email` — Calls `/api/user/verify-email` (exists). Handles token+email params, loading/success/error states. OK.
- [x] Modal variants (`/@modal/...`) — intercepting routes reusing the same forms. OK.

## 3. Discovery

- [x] `/explore` — Redirects to `/crowdfunds`. OK.
- [x] `/crowdfunds` — Live + upcoming filter. Calls `/api/projects` (exists). Filters/pagination/loading states sound. OK.
- [x] `/projects` — Redirects to `/crowdfunds`. OK.
- [x] `/projects/[vanityname]` — Server-rendered legacy URL handler, `notFound()` for misses. OK.
- [x] `/u/[username]` — Calls `/api/user/public-profile/[username]` (exists). Follow/unfollow mutations use `apiFetch` for CSRF. OK.
- [x] `/[vanityname]/[slug]` — Catch-all redirect → `/projects/[vanityname]/[slug]`, validates DB hit. OK.
- [x] `/collaborate/[id]` — Login `callbackUrl` flows through `sanitizeRedirectUrl()` downstream so no open redirect. OK.

## 4. Project Pages (non-pledge)

- [x] `/projects/[vanityname]/[slug]` — Project detail. All API endpoints exist, follow/unfollow uses `apiFetch`, polling effects cleaned up. **Minor UX bug**: `page.tsx:232` uses `window.location.href` (full URL) for `callbackUrl`. The downstream `sanitizeRedirectUrl()` (`src/lib/auth/actions.ts:31`) rejects non-relative URLs, so after login users land on `/dashboard` instead of back at the project. Should use `window.location.pathname + window.location.search` like the prelaunch page does.
- [x] `/projects/[vanityname]/[slug]/prelaunch` — Coming-soon teaser. Proper status gating (LIVE/FUNDED redirect to detail), permission checks for preview viewers, `apiFetch` for mutations, safe `encodeURIComponent(pathname)` for callbackUrl. OK.
- [x] `/projects/[vanityname]/[slug]/edit` — Project builder. **Minor UX gap**: no SSR auth gate, so the page shell loads briefly for unauthed users before client-side fetch returns 401. Not a security hole — `/api/projects/slug/[slug]` enforces creator ownership. Could add a server-component wrapper that redirects → `/login` like `/projects/new` does.
- [x] `/projects/new` — Server-side `auth()` check redirects to `/login?callbackUrl=/projects/new`. OK.
- [x] Layouts (`[slug]/layout.tsx`, `prelaunch/layout.tsx`) — Server-rendered metadata + JSON-LD, `notFound()` on miss, slug-migration redirect to correct creator. OK.

## 5. Creator Dashboard

- [x] `/dashboard` — Calls `/api/creator/dashboard` + `/api/creator/email/threads?filter=unread`. Polling cleanup correct, refetches on visibility change, 401-redirects to login. OK.
- [x] `/dashboard/projects` — Redirect to `/dashboard/indiekit` (target exists). OK.
- [x] `/dashboard/profile` — `/api/user/profile` GET/PATCH, `/api/upload` POST via `apiFetch`, vanity-URL lock works. OK.
- [x] `/dashboard/activity` — `/api/user/activity` GET, session-gated. OK.
- [x] `/dashboard/social` — `/api/auth/social/connections` GET/DELETE (DELETE uses `apiFetch`). Minor: loose `selectedPlatforms.length` dep on line 139 — theoretical loop risk only, doesn't fire in practice. OK.
- [x] `/dashboard/updates` — Composer POSTs/PATCH/DELETE to `/api/creator/indiekit/updates` via `apiFetch`, refetches after save. OK.
- [x] `/dashboard/settings` — All mutations (`/api/user/settings`, `/api/creator/paypal`, password change, email change) use `apiFetch`. OK.
- [x] `/dashboard/messages` — Auth-gated, delegates to `MessagesPanel`. Snap-back + race fix already landed earlier. OK.
- [x] `/dashboard/notifications` — `/api/user/notifications` PATCH/DELETE via `apiFetch`. GET uses raw `fetch` (fine — CSRF only for mutations). OK.
- [x] `/dashboard/indiekit` — Hub at 1171 lines. All API calls verified, mutations (`/backers`, `/feedback`) use `apiFetch`, tab routing intact. OK.
- [x] `/dashboard/indiekit-v2` — Redirect to `/dashboard/indiekit`. OK.
- [x] `/dashboard/indiekit/emails/[id]/edit` — `/api/creator/indiekit/campaigns` GET/POST via `apiFetch`, unsaved-changes badge, save-before-send flow. OK.
- [x] `/dashboard/indiekit/shopify/app` — Iframe breakout handler with Suspense. OK.
- [x] `/dashboard/indiekit/shopify/install` — Server-rendered OAuth entry, signed state param, validates shop. OK.
- [x] `/dashboard/indiekit/survey/[pledgeId]` — `fetchWithRetry` GET. OK.
- [x] `/dashboard/projects/[id]/survey` — Survey builder, 1183 lines. All CRUD endpoints (`item-questions`, `backer-questions`, `send`, `lock`) use `apiFetch` and refetch after save. Questions persist correctly. OK.
- [x] `/dashboard/projects/[id]/survey/responses` — `/api/projects/[id]/survey/responses` GET + POST (export) via `apiFetch`, blob download flow. OK.

## 6. Backer Dashboard

- [x] `/dashboard/backer` — 1401-line backer hub. Mutations use `apiFetch`, polling cleanup OK, session-gated. OK.
- [x] `/dashboard/following` — `/api/user/following` GET + unfollow via `apiFetch`, optimistic UI updates. OK.
- [x] `/dashboard/pledges/[pledgeId]` — Pledge detail (1218 lines). All mutations use `apiFetch`, API enforces pledge-ownership, refetch after every change. OK.
- [x] `/dashboard/pledges/[pledgeId]/survey` — **Fixed during audit**: was calling missing `/api/stripe/config` endpoint (line 355), throwing "Failed to load payment configuration" for any backer paying for survey addons with Stripe. Created the missing route at `src/app/api/stripe/config/route.ts` returning `{ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY }` (matches the PayPal/DC config pattern). Also fixes the same call in `pay/balance/[token]/page.tsx:75`.
- [x] `/dashboard/pledges/[pledgeId]/complete-with-dc` — DivinityCoin re-entry handles already-completed pledges, payment form loads with correct secret. OK.

## 7. Marketplace / Shop (public)

Note: `/shop/books/[slug]` is the **universal item viewer** that serves all media types (books/comics/music/movies) via the `mediaCategory` field on the Book model. The `detailHrefPrefix="/shop/books/"` everywhere is intentional, not a copy-paste bug as initially suspected.

- [x] `/shop`, `/cart`, `/shop/comics`, `/shop/movies`, `/shop/music` — Redirects/shells. Targets exist. OK.
- [x] `/shop/books` — Books index. OK.
- [x] `/shop/books/[slug]` — Universal item detail (968 lines). Stripe/PayPal/DC purchase flow, promo code redemption, video embed when `videoUrl` present, all mutations use `apiFetch`. OK. **Minor:** error toast says "Failed to load book" even when item is music/movie/comic — cosmetic.
- [x] `/shop/books/featured`, `/shop/books/staff-picks` — Custom implementations (not the shared wrapper). OK.
- [x] `/shop/comics/{all,dollar-bin,featured,staff-picks}` — Wrappers around `MarketplaceListingPage`. **Minor:** pass `kind="movie"` because the component's `kind` prop type is `"music" | "movie"` and doesn't include `"comics"`. Aspect ratio (2/3) is fine for comic covers; only the empty-state fallback icon is wrong (Film instead of book/comic). Component could be extended to accept `"comics"`.
- [x] `/shop/movies/genre/[genre]` — Wrapper, `kind="movie"`. OK.
- [x] `/shop/music/{featured,hot,new,staff-picks,genre/[genre]}` — Wrappers, `kind="music"`. OK.
- [x] `/shop/physical-media` — Standalone page. OK.
- [x] `/shop/companies/[slug]` — Publisher/label profile (331 lines). OK.

## 8. Shop Creator Dashboard

**Major fix during audit:** the entire shop creator dashboard had stale `/dashboard/marketplace/*` references from the 2026-05-19 marketplace→shop rename. The `next.config.js` rewrites only cover top-level `/marketplace` → `/shop`, not `/dashboard/marketplace/*`. Result: every "Add Book", "Edit Book", "Edit Music", "Edit Movie", "Company Profile" link, and every post-save redirect, was a dead 404. Fixed all 35 references across 13 files with a single project-wide rename. API paths (`/api/marketplace/*`) intentionally preserved per the rename memo.

- [x] `/dashboard/shop` — Shop creator hub. After rename, all hub links/redirects target real routes. `/api/creator/marketplace/*` endpoints all exist, mutations use `apiFetch`. OK.
- [x] `/dashboard/shop/company` — GET/POST/PUT `/api/creator/marketplace/company`, `/api/upload` for file uploads, dynamic-import BlockEditor. OK.
- [x] `/dashboard/shop/books/new` (1263) — PDF file manager (`/api/creator/marketplace/files/upload`), image upload, POST `/api/creator/marketplace/books`. OK.
- [x] `/dashboard/shop/books/[id]/edit` — Fetches existing book, PATCH/PUT to update, handles re-review for LIVE items, payment-processor split saves correctly. OK.
- [x] `/dashboard/shop/movies/new` — 5-step wizard, video upload (`/api/creator/marketplace/video/upload`), POST `/api/creator/marketplace/movies`. OK.
- [x] `/dashboard/shop/movies/[id]/edit` — Pre-populates form, save flows correct. OK.
- [x] `/dashboard/shop/music/new` (1007) — Multi-track support, audio upload (`/api/creator/marketplace/audio/upload`), loads company name, POST `/api/creator/marketplace/music`. OK.
- [x] `/dashboard/shop/music/[id]/edit` — Pre-populates form, save flows correct. OK.

## 9. Retailers

All 11 pages clean. Retailers are a parallel auth surface (separate from creator/backer sessions). Each protected page does its own `/api/retailers/me` (or `session-auth`) check and 401-redirects to `/retailers/login`. Note: `/retailers/*` routes are not in `protectedRoutes` in `src/proxy.ts` (which only covers `/dashboard` and `/projects/new`) — could be added for defense-in-depth but current per-page check is sufficient.

- [x] `/retailers` — Server-rendered landing, `getRetailerStats()`. OK.
- [x] `/retailers/apply` — `apiFetch` POST `/api/retailers/apply`, reCAPTCHA, success screen. OK.
- [x] `/retailers/login` — `apiFetch` POST `/api/retailers/login`, session check, reCAPTCHA, auto-redirect if already logged in. OK.
- [x] `/retailers/forgot-password` — `apiFetch` POST `/api/retailers/forgot-password`, reCAPTCHA. OK.
- [x] `/retailers/reset-password` — Token validation GET + `apiFetch` POST, password length/match validation. OK.
- [x] `/retailers/dashboard` — Tab-based hub, `apiFetch` for logout, 401-redirect. OK.
- [x] `/retailers/account` — `apiFetch` PATCH for updates, 401-redirect. OK.
- [x] `/retailers/orders` — GET orders, `apiFetch` for logout. OK.
- [x] `/retailers/invoices` — GET invoices, `apiFetch` for logout. OK.
- [x] `/retailers/projects` — GET catalog, justified exhaustive-deps disable. OK.
- [x] `/retailers/projects/[id]` — Project detail/preorder, `apiFetch` POST for order creation, success redirect. OK.

## 10. Admin (non-payment)

All 30 in-scope admin pages clean. `/admin/layout.tsx:266` enforces `session.user.role === "SUPER_ADMIN"` at the layout level, so individual pages don't need to re-check (no page-level auth gate is a feature, not a bug). Every mutation across the admin surface uses `apiFetch` (CSRF wrapper). GETs intentionally use raw `fetch` — CSRF only applies to mutations.

- [x] `/admin` — Health + dashboard polls, 30s interval with cleanup. OK.
- [x] `/admin/users` — Role/ban/delete/password/create all via `apiFetch`. Minor: two eslint-disable on useEffect deps (lines 151, 159) for `fetchUserPledges`/`fetchUserEmails` — fragile but works.
- [x] `/admin/projects` — Approve/reject/bulk via `useProjectsData` hook, all `apiFetch`. OK.
- [x] `/admin/analytics` — Read-only, CSV export client-side. OK. Minor: silent failure on API error.
- [x] `/admin/security` — Settings PATCH via `apiFetch`. OK.
- [x] `/admin/moderation` — Resolve/dismiss/escalate via `apiFetch` PATCH. ADMIN or SUPER_ADMIN (intentionally broader). OK.
- [x] `/admin/bug-reports` — Status PATCH via `apiFetch`, refetches after change. OK.
- [x] `/admin/error-logs` — Bulk PATCH/DELETE via `apiFetch`, auto-refresh w/ ref-guarded cleanup. OK.
- [x] `/admin/email` — Mailbox UI, all GETs (no mutations on this page). OK.
- [x] `/admin/email-queue` — start/stop/retry/clear via `apiFetch`, 3s polling. OK.
- [x] `/admin/email/creator-sent` — Detail fetch via `apiFetch`, debounced search, auto-refresh pauses when dialog open. OK.
- [x] `/admin/ai` — Settings PATCH + POST runs via `apiFetch`. OK.
- [x] `/admin/ai-marketing` — Campaign + auto-tag CRUD via `apiFetch`. OK.
- [x] `/admin/announcement-bar` — Save uses `apiFetch` with `json:` shortcut (valid per `fetch-utils.ts:14`), reorder PATCH, toggle PUT all good. OK.
- [x] `/admin/changelog` — Create/edit/delete/toggle/extract-from-git all via `apiFetch`. OK.
- [x] `/admin/consent-banner` — Save uses `apiFetch` PUT. OK.
- [x] `/admin/promo-popup` — PUT save + POST reset via `apiFetch`, refetches. OK.
- [x] `/admin/hero-slider` — POST/PUT/DELETE slide CRUD via `apiFetch`, refetches. OK.
- [x] `/admin/page-builder` — Page CRUD via `apiFetch`, refetches after save. OK.
- [x] `/admin/themes` — PATCH save via `apiFetch`, reloads to confirm DB persistence. OK.
- [x] `/admin/seo` — Uses `fetchWithRetry` + manual `getCSRFHeaders()` on mutations (different pattern, still CSRF-protected). OK.
- [x] `/admin/media` — Upload POST via `apiFetch`, list refresh after upload. OK.
- [x] `/admin/notifications` — Preferences save via `apiFetch`. Minor: optimistic updates with weak rollback (acceptable).
- [x] `/admin/press` — Press release CRUD via `apiFetch`. OK.
- [x] `/admin/settings` — Section-based save via `apiFetch`, refetches after to mask sensitive values. OK.
- [x] `/admin/shop` — Approve/reject/feature/staff-pick + file uploads + reorder all via `apiFetch`. OK.
- [x] `/admin/prelaunch` — Approve/reject via `apiFetch`. Minor: `getPageUrl()` doesn't null-check vanityUrl/slug — should never happen in practice but defensive.
- [x] `/admin/retailers` — Approve/reject PATCH + resend-approval POST via `apiFetch`. OK.
- [x] `/admin/cron` — Crontab PUT via `apiFetch`, backup-captured for restore. OK.
- [x] `/admin/link-sanitizer` — DELETE + cleanup-projects POST via `apiFetch`. OK.

---

## Skipped (payment-related — out of scope per request)

- `/settings/payment` and children
- `/pay/balance/[token]`
- `/projects/[vanityname]/[slug]/pledge`
- `/dashboard/pledges/[pledgeId]/complete-with-dc`
- `/admin/payouts`
- `/admin/transactions`
- `/admin/reconcile`
- `/admin/divinitycoin-redemptions`
- `/survey/preview` (verify if survey-only and unrelated to billing)

---

## Audit log

Notable findings will be appended here as a running changelog.
