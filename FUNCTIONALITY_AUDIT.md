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

- [ ] `/projects/[vanityname]/[slug]` — Project detail (live/funded)
- [ ] `/projects/[vanityname]/[slug]/prelaunch` — Coming soon teaser
- [ ] `/projects/[vanityname]/[slug]/edit` — Creator project builder
- [ ] `/projects/new` — Create project entrypoint

## 5. Creator Dashboard

- [ ] `/dashboard` — Creator dashboard root
- [ ] `/dashboard/projects` — Creator's projects list
- [ ] `/dashboard/profile` — Public profile editor
- [ ] `/dashboard/activity` — Activity feed
- [ ] `/dashboard/social` — Social links
- [ ] `/dashboard/updates` — Project updates composer
- [ ] `/dashboard/settings` — Account settings
- [ ] `/dashboard/messages` — DM inbox (already touched: snap-back + race fix)
- [ ] `/dashboard/notifications` — Notification center
- [ ] `/dashboard/indiekit` — IndieKit hub
- [ ] `/dashboard/indiekit-v2` — IndieKit v2 hub
- [ ] `/dashboard/indiekit/emails/[id]/edit` — Email template editor
- [ ] `/dashboard/indiekit/shopify/app` — Shopify app config
- [ ] `/dashboard/indiekit/shopify/install` — Shopify install flow
- [ ] `/dashboard/indiekit/survey/[pledgeId]` — Survey responder (creator-side preview)
- [ ] `/dashboard/projects/[id]/survey` — Survey builder
- [ ] `/dashboard/projects/[id]/survey/responses` — Survey response viewer

## 6. Backer Dashboard

- [ ] `/dashboard/backer` — Backer hub
- [ ] `/dashboard/following` — Followed projects
- [ ] `/dashboard/pledges/[pledgeId]` — Pledge detail (non-payment view)
- [ ] `/dashboard/pledges/[pledgeId]/survey` — Fill survey

## 7. Marketplace / Shop (public)

- [ ] `/shop` — Marketplace landing
- [ ] `/cart` — Shopping cart
- [ ] `/shop/books` — Books index
- [ ] `/shop/books/[slug]` — Book detail
- [ ] `/shop/books/featured` — Featured books
- [ ] `/shop/books/staff-picks` — Staff picks
- [ ] `/shop/comics` — Comics index
- [ ] `/shop/comics/all` — All comics
- [ ] `/shop/comics/dollar-bin` — $1-5 comics
- [ ] `/shop/comics/featured` — Featured comics
- [ ] `/shop/comics/staff-picks` — Staff picks
- [ ] `/shop/movies` — Movies index
- [ ] `/shop/movies/genre/[genre]` — Movies by genre
- [ ] `/shop/music` — Music index
- [ ] `/shop/music/featured` — Featured music
- [ ] `/shop/music/genre/[genre]` — Music by genre
- [ ] `/shop/music/hot` — Hot music
- [ ] `/shop/music/new` — New music
- [ ] `/shop/music/staff-picks` — Staff picks
- [ ] `/shop/physical-media` — Physical media
- [ ] `/shop/companies/[slug]` — Publisher/label profile

## 8. Shop Creator Dashboard

- [ ] `/dashboard/shop` — Shop creator hub
- [ ] `/dashboard/shop/company` — Company profile
- [ ] `/dashboard/shop/books/new` — New book
- [ ] `/dashboard/shop/books/[id]/edit` — Edit book
- [ ] `/dashboard/shop/movies/new` — New movie
- [ ] `/dashboard/shop/movies/[id]/edit` — Edit movie
- [ ] `/dashboard/shop/music/new` — New music
- [ ] `/dashboard/shop/music/[id]/edit` — Edit music

## 9. Retailers

- [ ] `/retailers` — Retailer landing
- [ ] `/retailers/apply` — Apply form
- [ ] `/retailers/login` — Retailer login
- [ ] `/retailers/forgot-password` — Reset request
- [ ] `/retailers/reset-password` — Reset via token
- [ ] `/retailers/dashboard` — Retailer hub
- [ ] `/retailers/account` — Account settings
- [ ] `/retailers/orders` — Orders list
- [ ] `/retailers/invoices` — Invoices list
- [ ] `/retailers/projects` — Available projects
- [ ] `/retailers/projects/[id]` — Project detail

## 10. Admin (non-payment)

- [ ] `/admin` — Admin dashboard
- [ ] `/admin/users` — User management
- [ ] `/admin/projects` — Project moderation/management
- [ ] `/admin/analytics` — Site analytics
- [ ] `/admin/security` — Security log
- [ ] `/admin/moderation` — Content moderation
- [ ] `/admin/bug-reports` — Bug report inbox
- [ ] `/admin/error-logs` — Error log viewer
- [ ] `/admin/email` — Admin email inbox
- [ ] `/admin/email-queue` — Email queue
- [ ] `/admin/email/creator-sent` — Creator emails
- [ ] `/admin/ai` — AI admin
- [ ] `/admin/ai-marketing` — AI marketing campaigns
- [ ] `/admin/announcement-bar` — Top announcement
- [ ] `/admin/changelog` — Changelog editor
- [ ] `/admin/consent-banner` — Cookie banner config
- [ ] `/admin/promo-popup` — Popup config
- [ ] `/admin/hero-slider` — Homepage hero
- [ ] `/admin/page-builder` — Static page editor
- [ ] `/admin/themes` — Theme config
- [ ] `/admin/seo` — SEO tools
- [ ] `/admin/media` — Media library
- [ ] `/admin/notifications` — Notification config
- [ ] `/admin/press` — Press releases
- [ ] `/admin/settings` — Platform settings
- [ ] `/admin/shop` — Shop management
- [ ] `/admin/prelaunch` — Prelaunch tools
- [ ] `/admin/retailers` — Retailer approvals
- [ ] `/admin/cron` — Cron monitor
- [ ] `/admin/link-sanitizer` — Link sanitizer tool

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
