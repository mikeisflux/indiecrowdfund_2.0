# Race Condition Audit — Part 1: Admin Routes (77 files)

## Admin — AI Marketing (11 files)
- [x] `src/app/api/admin/ai-marketing/auto-tag/route.ts` — POST is read-only preview, PATCH is idempotent tag-setting. Clean.
- [x] `src/app/api/admin/ai-marketing/campaigns/[type]/route.ts` — GET is read-only, POST is a single create (no uniqueness pre-check). Clean.
- [x] `src/app/api/admin/ai-marketing/campaigns/fix-images/route.ts` — GET is read-only, POST updates are idempotent (base64→URL replacement). Clean.
- [x] `src/app/api/admin/ai-marketing/campaigns/manage/[id]/abort/route.ts` — CAS on status SENDING→CANCELLED prevents double PM2 restart. Clean.
- [x] `src/app/api/admin/ai-marketing/campaigns/manage/[id]/duplicate/route.ts` — Single create, no uniqueness constraint. Two duplicates is harmless. Clean.
- [x] `src/app/api/admin/ai-marketing/campaigns/manage/[id]/route.ts` — GET clean, PATCH has CAS, DELETE fixed: .delete→deleteMany with status guard.
- [x] `src/app/api/admin/ai-marketing/campaigns/manage/[id]/send/route.ts` — CAS on status→SENDING prevents double-send. Error reset to DRAFT is acceptable. Clean.
- [x] `src/app/api/admin/ai-marketing/campaigns/route.ts` — GET read-only, POST single create (no uniqueness pre-check). Clean.
- [x] `src/app/api/admin/ai-marketing/run/route.ts` — Multi-action POST. Mostly read-only. Writes are idempotent tag-setting or delegated to lib functions with their own guards. Clean.
- [x] `src/app/api/admin/ai-marketing/subscribers/import/route.ts` — createMany with skipDuplicates:true handles TOCTOU on email uniqueness. Clean.
- [x] `src/app/api/admin/ai-marketing/subscribers/route.ts` — POST uses upsert, PATCH has P2002 catch, DELETE uses updateMany. All handlers clean.

## Admin — Content & CMS (7 files)
- [ ] `src/app/api/admin/announcement-bar/route.ts`
- [ ] `src/app/api/admin/consent-banner/route.ts`
- [ ] `src/app/api/admin/hero-slides/route.ts`
- [ ] `src/app/api/admin/hero-slides/seed-features/route.ts`
- [ ] `src/app/api/admin/pages/route.ts`
- [ ] `src/app/api/admin/promo-popup/route.ts`
- [ ] `src/app/api/admin/changelog/route.ts`

## Admin — Email (5 files)
- [ ] `src/app/api/admin/email-blocklist/[id]/route.ts`
- [ ] `src/app/api/admin/email-blocklist/purge/route.ts`
- [ ] `src/app/api/admin/email-blocklist/route.ts`
- [ ] `src/app/api/admin/email-queue/route.ts`
- [ ] `src/app/api/admin/email/route.ts`

## Admin — Error Logs & Reports (4 files)
- [ ] `src/app/api/admin/error-logs/[id]/route.ts`
- [ ] `src/app/api/admin/error-logs/route.ts`
- [ ] `src/app/api/admin/reports/route.ts`
- [ ] `src/app/api/admin/notifications/route.ts`

## Admin — LCS Locator (3 files)
- [ ] `src/app/api/admin/lcs-locator/cleanup-emails/route.ts`
- [ ] `src/app/api/admin/lcs-locator/shops/route.ts`
- [ ] `src/app/api/admin/link-sanitizer/route.ts`

## Admin — Mailboxes (4 files)
- [ ] `src/app/api/admin/mailboxes/[id]/emails/[emailId]/route.ts`
- [ ] `src/app/api/admin/mailboxes/[id]/emails/route.ts`
- [ ] `src/app/api/admin/mailboxes/[id]/route.ts`
- [ ] `src/app/api/admin/mailboxes/route.ts`

## Admin — Marketplace (5 files)
- [ ] `src/app/api/admin/marketplace/books/[id]/feature/route.ts`
- [ ] `src/app/api/admin/marketplace/books/[id]/review/route.ts`
- [ ] `src/app/api/admin/marketplace/books/[id]/route.ts`
- [ ] `src/app/api/admin/marketplace/books/[id]/staff-pick/route.ts`
- [ ] `src/app/api/admin/marketplace/pdf-management/route.ts`

## Admin — Media (3 files)
- [ ] `src/app/api/admin/media/route.ts`
- [ ] `src/app/api/admin/media/scan/route.ts`
- [ ] `src/app/api/admin/media/upload/route.ts`

## Admin — Payouts (3 files)
- [ ] `src/app/api/admin/payouts/divinitycoin/route.ts`
- [ ] `src/app/api/admin/payouts/route.ts`
- [ ] `src/app/api/admin/divinity-payouts/route.ts`

## Admin — Pledges (2 files)
- [ ] `src/app/api/admin/pledges/[pledgeId]/route.ts`
- [ ] `src/app/api/admin/pledges/cleanup/route.ts`

## Admin — Projects (9 files)
- [ ] `src/app/api/admin/prelaunch/route.ts`
- [ ] `src/app/api/admin/projects/[projectId]/adjust-end-date/route.ts`
- [ ] `src/app/api/admin/projects/[projectId]/backfill-backer-numbers/route.ts`
- [ ] `src/app/api/admin/projects/[projectId]/process-pledges/route.ts`
- [ ] `src/app/api/admin/projects/normalize-nsfw-campaign-type/route.ts`
- [ ] `src/app/api/admin/projects/recover-base64-images/route.ts`
- [ ] `src/app/api/admin/projects/review/route.ts`
- [ ] `src/app/api/admin/projects/status/route.ts`
- [ ] `src/app/api/admin/projects/strip-base64-emails/route.ts`

## Admin — Retailers (2 files)
- [ ] `src/app/api/admin/retailers/resend-approval/route.ts`
- [ ] `src/app/api/admin/retailers/route.ts`

## Admin — SEO (5 files)
- [ ] `src/app/api/admin/seo/cron/route.ts`
- [ ] `src/app/api/admin/seo/fix-all/route.ts`
- [ ] `src/app/api/admin/seo/keywords/route.ts`
- [ ] `src/app/api/admin/seo/pages/route.ts`
- [ ] `src/app/api/admin/seo/redirects/route.ts`

## Admin — Settings & Security (4 files)
- [ ] `src/app/api/admin/settings/route.ts`
- [ ] `src/app/api/admin/security/encrypt-secrets/route.ts`
- [ ] `src/app/api/admin/api-keys/route.ts`
- [ ] `src/app/api/admin/wallet/route.ts`

## Admin — Users (5 files)
- [ ] `src/app/api/admin/users/[userId]/emails/route.ts`
- [ ] `src/app/api/admin/users/[userId]/vanity-url/route.ts`
- [ ] `src/app/api/admin/users/merge-duplicates/route.ts`
- [ ] `src/app/api/admin/users/route.ts`
- [ ] `src/app/api/admin/divinitycoin-redemptions/route.ts`

## Admin — Misc (4 files)
- [ ] `src/app/api/admin/backfill-backer-numbers/route.ts`
- [ ] `src/app/api/admin/cleanup-duplicate-rewards/route.ts`
- [ ] `src/app/api/admin/recalculate-pledge-amounts/route.ts`
- [ ] `src/app/api/admin/reconcile-pledges/route.ts`
