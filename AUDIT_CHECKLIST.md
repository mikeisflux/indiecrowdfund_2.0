# IndieCrowdfund 2.0 - Comprehensive Audit Checklist

**Generated:** December 11, 2025
**Status:** In Progress - Critical items being addressed
**Last Updated:** December 11, 2025

---

## Summary

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| Security | 3 | 6 | 6 | 5 | 20 |
| API Endpoints | 1 | 2 | 3 | 2 | 8 |
| Frontend/UX | 6 | 8 | 4 | 2 | 20 |
| Code Quality | 5 | 12 | 18 | 8 | 43 |
| Dead Code/Logging | 2 | 5 | 8 | 10 | 25 |
| **TOTAL** | **17** | **33** | **39** | **27** | **116** |

---

## CRITICAL PRIORITY (Fix Immediately)

### Security - Critical

- [x] **XSS Vulnerability in Campaign Descriptions** `src/app/projects/[slug]/page.tsx`
  - Issue: `dangerouslySetInnerHTML` used without sanitization
  - Fix: Implemented DOMPurify sanitization via `src/lib/utils/sanitize.ts`
  - **FIXED:** Added `isomorphic-dompurify` and `sanitizeHtml()` utility

- [x] **XSS Vulnerability in Page Builder** `src/app/admin/page-builder/page.tsx`
  - Issue: Raw HTML rendering without sanitization
  - **VERIFIED:** No dangerouslySetInnerHTML found in page builder - no issue exists

- [x] **Hardcoded Secrets in Codebase** `src/lib/ai/providers.ts`
  - Issue: API keys potentially hardcoded
  - **VERIFIED:** All API keys use `process.env` - no hardcoded secrets found

### API - Critical

- [x] **Disabled Auth Check in Admin Route** `src/app/api/admin/projects/[id]/review/route.ts`
  - Issue: `requireAdmin()` call may be commented out or bypassed
  - **FIXED:** Enabled admin role checks in 4 routes:
    - `src/app/api/admin/projects/review/route.ts`
    - `src/app/api/admin/projects/history/route.ts`
    - `src/app/api/admin/projects/status/route.ts`
    - `src/app/api/admin/retailers/route.ts`

### Frontend - Critical

- [x] **Missing Privacy Policy Page** `/privacy`
  - Issue: Link exists in footer but page returns 404
  - **FIXED:** Created comprehensive privacy policy page

- [x] **Missing Trust & Safety Page** `/trust-safety`
  - Issue: Link exists but page doesn't exist
  - **FIXED:** Created trust & safety page with accountability info

- [x] **Non-functional Contact Form** `src/app/contact/page.tsx`
  - Issue: Form submission doesn't work - no API endpoint
  - **FIXED:** Created `/api/contact` endpoint and connected form

- [ ] **Broken "Start a Project" Flow** Multiple locations
  - Issue: Button links to `/start` which may not have complete flow
  - Fix: Verify complete project creation wizard works

- [x] **Missing Terms of Service Page** `/terms`
  - Issue: Footer links to non-existent page
  - **VERIFIED:** Terms page exists at `src/app/terms/page.tsx`

- [ ] **Email Verification Flow Incomplete**
  - Issue: Email change feature may not send verification emails
  - Fix: Verify email sending is configured and working

### Code Quality - Critical

- [x] **Memory Leak in Admin Dashboard** `src/app/admin/page.tsx`
  - Issue: `setInterval` without cleanup in useEffect
  - **VERIFIED:** No setInterval in admin dashboard - no memory leak exists

- [x] **Memory Leak in Admin Layout** `src/app/admin/layout.tsx:148`
  - Issue: Stats polling interval may not clean up properly
  - **VERIFIED:** Proper cleanup exists with `return () => clearInterval(interval)`

- [ ] **Unsafe Array Access** Multiple files
  - Issue: Accessing array indices without bounds checking
  - Files: `src/app/projects/[slug]/page.tsx`, pledge components
  - Fix: Add null checks before array access

- [ ] **Missing React Keys in Lists** Multiple components
  - Issue: Using index as key or missing keys entirely
  - Fix: Use unique identifiers for keys

- [ ] **Unhandled Promise Rejections** Various API routes
  - Issue: Some async operations don't have proper error handling
  - Fix: Add try/catch blocks to all async operations

---

## HIGH PRIORITY (Fix This Week)

### Security - High

- [ ] **Missing CSRF Protection** All form submissions
  - Issue: Forms don't include CSRF tokens
  - Fix: Implement CSRF token validation

- [ ] **No Rate Limiting on Auth Endpoints** `src/app/api/auth/*`
  - Issue: Login/register vulnerable to brute force
  - Fix: Add rate limiting middleware (e.g., express-rate-limit equivalent)

- [ ] **Insufficient Input Validation** Various API routes
  - Issue: Some endpoints don't validate all inputs with Zod
  - Fix: Add comprehensive Zod schemas to all routes

- [ ] **Missing Authorization on Some Endpoints**
  - Files to check:
    - [ ] `src/app/api/projects/route.ts` - verify user can only edit own projects
    - [ ] `src/app/api/rewards/route.ts` - verify ownership checks
    - [ ] `src/app/api/updates/route.ts` - verify ownership checks

- [ ] **SQL Injection Risk** `src/app/api/admin/media/route.ts:54-58`
  - Issue: Search parameter used in OR query without sanitization
  - Fix: Ensure Prisma parameterizes all queries (verify)

- [ ] **Insecure Direct Object Reference** Various endpoints
  - Issue: Some endpoints may allow accessing other users' data by ID
  - Fix: Add ownership verification to all resource access

### API - High

- [ ] **Missing Error Handling** `src/app/api/webhooks/stripe/route.ts`
  - Issue: Webhook may not handle all Stripe event types
  - Fix: Add comprehensive event handling

- [ ] **Incomplete Pagination** Various list endpoints
  - Issue: Some endpoints don't limit results
  - Fix: Add default pagination limits

### Frontend - High

- [ ] **Placeholder Links in Navigation** Header/Footer components
  - Issue: "How It Works", "Explore", "About" may be placeholders
  - Fix: Connect to actual pages or create them

- [ ] **Dashboard Analytics Not Implemented** `src/app/dashboard/analytics/page.tsx`
  - Issue: May show placeholder data or errors
  - Fix: Implement actual analytics data fetching

- [ ] **Settings Pages Incomplete** `src/app/settings/*`
  - Issue: Some settings sections may not save properly
  - Fix: Verify all settings persist correctly

- [ ] **Search Functionality Limited** Header search
  - Issue: Search may only search project titles
  - Fix: Implement full-text search across relevant fields

- [ ] **Mobile Navigation Issues**
  - Issue: Some dropdowns may not work on mobile
  - Fix: Test and fix mobile interactions

- [ ] **Form Validation Messages** Various forms
  - Issue: Error messages may not display clearly
  - Fix: Improve error message visibility and clarity

- [ ] **Loading States Missing** Various components
  - Issue: Some actions don't show loading indicators
  - Fix: Add loading spinners to all async actions

- [ ] **Image Upload Previews** Project creation, media library
  - Issue: Preview may not work for all image types
  - Fix: Test and fix image preview functionality

### Code Quality - High

- [ ] **Console.log Statements in Production** 451 instances found
  - Priority files to clean:
    - [ ] `src/lib/payments/stripe.ts` - 15+ console statements
    - [ ] `src/app/api/webhooks/stripe/route.ts` - 12+ console statements
    - [ ] `src/app/projects/[slug]/pledge/page.tsx` - 10+ console statements
    - [ ] `src/lib/auth/index.ts` - 8+ console statements
  - Fix: Replace with proper logging service or remove

- [ ] **Async useEffect Issues** Multiple components
  - Issue: Async functions directly in useEffect
  - Fix: Define async function inside and call it

- [ ] **Prop Drilling** Deep component hierarchies
  - Issue: Props passed through many levels
  - Fix: Consider React Context or state management

- [ ] **Large Component Files** Several 500+ line components
  - Files:
    - [ ] `src/app/admin/media/page.tsx` - Split into smaller components
    - [ ] `src/app/projects/[slug]/page.tsx` - Extract sections
    - [ ] `src/app/admin/page.tsx` - Break into dashboard widgets
  - Fix: Refactor into smaller, focused components

- [ ] **Duplicate Code** Various locations
  - Issue: Similar logic repeated in multiple places
  - Examples:
    - [ ] Admin auth checking - create shared hook
    - [ ] Form handling patterns - create reusable form hooks
    - [ ] API error handling - create shared error handler
  - Fix: Extract into shared utilities/hooks

---

## MEDIUM PRIORITY (Fix This Month)

### Security - Medium

- [ ] **Session Configuration** `src/lib/auth/index.ts`
  - Issue: Session settings may need review
  - Fix: Verify secure session configuration

- [ ] **Missing Content Security Policy**
  - Issue: No CSP headers configured
  - Fix: Add CSP headers in `next.config.js` or middleware

- [ ] **Password Policy** Registration flow
  - Issue: May allow weak passwords
  - Fix: Implement password strength requirements

- [ ] **Sensitive Data in Error Messages**
  - Issue: Some errors may expose internal details
  - Fix: Sanitize error messages in production

- [ ] **Missing Security Headers**
  - Issue: Headers like X-Frame-Options, X-Content-Type-Options missing
  - Fix: Add security headers in middleware

- [ ] **File Upload Validation** Media upload
  - Issue: May not fully validate uploaded files
  - Fix: Add MIME type and extension validation

### API - Medium

- [ ] **Missing API Documentation**
  - Issue: No OpenAPI/Swagger documentation
  - Fix: Add API documentation

- [ ] **Inconsistent Response Formats**
  - Issue: Some endpoints return different error formats
  - Fix: Standardize API response structure

- [ ] **Missing API Versioning**
  - Issue: No API version in routes
  - Fix: Consider adding `/api/v1/` prefix for future compatibility

### Frontend - Medium

- [ ] **Accessibility Issues** Various components
  - Issues:
    - [ ] Missing aria-labels on icon buttons
    - [ ] Insufficient color contrast in some areas
    - [ ] Missing focus indicators
    - [ ] Form labels not properly associated
  - Fix: Audit with axe-core and fix issues

- [ ] **SEO Improvements**
  - Issues:
    - [ ] Missing meta descriptions on some pages
    - [ ] Missing Open Graph tags
    - [ ] Missing structured data (JSON-LD)
  - Fix: Add proper meta tags and structured data

- [ ] **Performance Optimization**
  - Issues:
    - [ ] Large bundle size
    - [ ] Missing image optimization
    - [ ] No lazy loading for below-fold content
  - Fix: Implement code splitting, image optimization

- [ ] **Error Boundaries Missing**
  - Issue: No error boundaries to catch React errors
  - Fix: Add error boundaries around major sections

### Code Quality - Medium

- [ ] **TypeScript `any` Usage** 50+ instances
  - Priority files:
    - [ ] `src/lib/payments/stripe.ts`
    - [ ] `src/app/api/webhooks/stripe/route.ts`
    - [ ] Various API routes
  - Fix: Add proper types

- [ ] **Unused Imports** Various files
  - Fix: Run `eslint --fix` to auto-remove

- [ ] **Inconsistent Naming Conventions**
  - Issue: Mix of camelCase and snake_case
  - Fix: Standardize on camelCase for JS/TS

- [ ] **Missing JSDoc Comments** Utility functions
  - Issue: Complex functions lack documentation
  - Fix: Add JSDoc to public APIs

- [ ] **Test Coverage**
  - Issue: Limited or no test coverage
  - Fix: Add unit tests for critical paths

### Dead Code/Logging - Medium

- [ ] **Unused Hooks** `src/hooks/`
  - Files to review:
    - [ ] `use-media-upload.ts` - May be unused
    - [ ] `use-stripe-payment.ts` - Check if still needed
  - Fix: Remove if not used anywhere

- [ ] **Commented Out Code** Various files
  - Issue: Old code left in comments
  - Fix: Remove commented code (use git history if needed)

- [ ] **Unused Environment Variables**
  - Issue: Some env vars may not be used
  - Fix: Audit and clean up `.env.example`

- [ ] **Unused Dependencies** `package.json`
  - Fix: Run `npx depcheck` and remove unused packages

---

## LOW PRIORITY (Backlog)

### Security - Low

- [ ] **Add Audit Logging**
  - Issue: No audit trail for admin actions
  - Fix: Implement audit logging for sensitive operations

- [ ] **Two-Factor Authentication**
  - Issue: 2FA not implemented
  - Fix: Add optional 2FA for users

- [ ] **IP-based Suspicious Activity Detection**
  - Issue: No detection of suspicious login patterns
  - Fix: Implement login anomaly detection

- [ ] **Dependency Security Audit**
  - Fix: Run `npm audit` and address vulnerabilities

- [ ] **Secrets Rotation Policy**
  - Issue: No policy for rotating API keys
  - Fix: Document and implement rotation schedule

### Frontend - Low

- [ ] **Dark Mode Improvements**
  - Issue: Some components may not style correctly in dark mode
  - Fix: Audit and fix dark mode styles

- [ ] **Internationalization Preparation**
  - Issue: Hardcoded strings throughout
  - Fix: Extract strings for future i18n support

### Code Quality - Low

- [ ] **Code Comments Quality**
  - Issue: Some comments are outdated or unhelpful
  - Fix: Review and update comments

- [ ] **Consistent Error Messages**
  - Issue: Error messages vary in tone/format
  - Fix: Create error message constants

- [ ] **Magic Numbers**
  - Issue: Hardcoded numbers without explanation
  - Fix: Extract to named constants

- [ ] **Development-only Code**
  - Issue: Some dev helpers may be in production
  - Fix: Guard with `process.env.NODE_ENV` checks

### Dead Code - Low

- [ ] **Unused CSS Classes** Various stylesheets
  - Fix: Use PurgeCSS or similar to remove unused styles

- [ ] **Unused Type Definitions** `src/types/`
  - Fix: Audit and remove unused types

- [ ] **Orphaned Components** `src/components/`
  - Fix: Identify and remove components not imported anywhere

---

## Disconnected Features (Not Hooked to UX)

These features have backend code but no visible way for users to access them:

- [ ] **AI Marketing Tools** `src/app/admin/ai-marketing/`
  - Status: Page exists but may not be fully connected
  - Action: Verify AI features work end-to-end

- [ ] **Notification Center** `src/app/admin/notifications/`
  - Status: Backend exists, UI may be incomplete
  - Action: Complete notification management UI

- [ ] **Campaign Moderation Queue** `src/app/admin/moderation/`
  - Status: Check if fully functional
  - Action: Verify moderation workflow

- [ ] **Payout Management** `src/app/admin/payouts/`
  - Status: May have placeholder UI
  - Action: Verify payout processing works

- [ ] **Email Templates** `src/lib/email/templates/`
  - Status: Templates may exist but not all are used
  - Action: Audit which templates are active

- [ ] **Analytics Dashboard** `src/app/dashboard/analytics/`
  - Status: May show placeholder data
  - Action: Connect to real analytics data

- [ ] **User Verification Badges**
  - Status: Schema supports verification but UI may not
  - Action: Add verification badge display

- [ ] **Campaign Categories/Tags**
  - Status: Schema supports tags but filtering may not work
  - Action: Verify category filtering works

- [ ] **Social Sharing**
  - Status: Share buttons may not function
  - Action: Test and fix social sharing

- [ ] **Export Functionality** (Backers list, analytics)
  - Status: Export buttons may be non-functional
  - Action: Implement CSV/PDF exports

---

## Files to Review/Clean Up

### Potentially Unnecessary Files

- [ ] Review `src/components/ui/` - May have unused shadcn components
- [ ] Review `src/lib/utils/` - Check for unused utility functions
- [ ] Review `public/` - Check for unused static assets
- [ ] Review `prisma/migrations/` - Ensure no test migrations

### Large Files That Need Refactoring

| File | Lines | Action |
|------|-------|--------|
| `src/app/admin/media/page.tsx` | 800+ | Split into components |
| `src/app/projects/[slug]/page.tsx` | 600+ | Extract sections |
| `src/app/admin/page.tsx` | 500+ | Create widget components |
| `src/lib/payments/stripe.ts` | 400+ | Split by concern |

---

## Quick Wins (Easy Fixes)

- [ ] Remove all `console.log` statements (find & replace)
- [ ] Run `npm run lint -- --fix` to auto-fix lint issues
- [x] Add `prefetch={false}` to admin navigation links (Done)
- [x] Create missing static pages (privacy, terms, trust-safety) **DONE**
- [ ] Add proper TypeScript types to replace `any`
- [ ] Remove unused imports with ESLint
- [ ] Add loading spinners to buttons during async actions

---

## Testing Checklist

Before deploying, verify these critical flows:

### Authentication
- [ ] User registration works
- [ ] Email verification works
- [ ] Login works
- [ ] Password reset works
- [ ] OAuth login works (Google, etc.)
- [ ] Logout works
- [ ] Session persistence works

### Campaign Creation
- [ ] Create new project works
- [ ] Edit project works
- [ ] Add rewards works
- [ ] Add updates works
- [ ] Submit for review works
- [ ] Project goes live correctly

### Payments
- [ ] Stripe Connect onboarding works
- [ ] Pledging to unfunded campaign (SetupIntent) works
- [ ] Pledging to funded campaign (PaymentIntent) works
- [ ] Payment confirmation redirect works
- [ ] Webhook processing works
- [ ] Refunds work (if implemented)

### Admin Functions
- [ ] Admin dashboard loads
- [ ] User management works
- [ ] Project moderation works
- [ ] Media library works
- [ ] Settings save correctly

---

## DETAILED AUDIT: Excessive Logging, Disconnected Code & Unused Files

### Excessive Console Logging (451 Total Statements)

**Files with Most Console Statements (Top Priority for Cleanup):**

| File | Count | Priority |
|------|-------|----------|
| `src/app/api/projects/[id]/route.ts` | 22 | HIGH |
| `src/lib/email.ts` | 12 | HIGH |
| `src/app/api/admin/settings/route.ts` | 12 | MEDIUM |
| `src/app/admin/users/page.tsx` | 12 | MEDIUM |
| `src/app/admin/email/page.tsx` | 12 | MEDIUM |
| `src/app/admin/settings/page.tsx` | 11 | MEDIUM |
| `src/app/dashboard/projects/[id]/survey/page.tsx` | 9 | MEDIUM |
| `src/components/project/builder/rewards-step.tsx` | 8 | MEDIUM |
| `src/app/api/webhooks/email/inbound/route.ts` | 8 | HIGH |
| `src/lib/ai/settings-integration.ts` | 7 | MEDIUM |
| `src/components/id-verification-gate.tsx` | 7 | LOW |
| `src/app/api/webhooks/email/events/route.ts` | 7 | HIGH |
| `src/app/api/admin/projects/review/route.ts` | 7 | HIGH |
| `src/app/admin/media/page.tsx` | 7 | LOW |
| `src/app/admin/ai-marketing/page.tsx` | 7 | LOW |

**Critical Payment/Webhook Paths to Clean:**
- [ ] `src/lib/payments/stripe.ts` - 3 console.warn for settings fetch failures
- [ ] `src/app/api/webhooks/stripe/route.ts` - Error logging
- [ ] `src/app/api/pledges/route.ts` - 2 error logs

**Recommended Action:** Replace with proper logging service (e.g., Pino, Winston) or remove entirely in production.

---

### Disconnected Features (Backend Exists, UX Not Wired)

| Feature | Backend Location | Status | Issue |
|---------|-----------------|--------|-------|
| **Admin Notifications API** | `/api/admin/notifications` | DISCONNECTED | Admin page uses hardcoded mock data instead of calling API |
| **ID Verification Gate** | `src/components/id-verification-gate.tsx` | UNUSED | Component exported but never imported |
| **Notifications Dropdown** | `src/components/notifications/notifications-dropdown.tsx` | UNUSED | Component exists but not in any layout |
| **Project Tracking Hook** | `src/components/tracking-provider.tsx` | UNUSED | `useProjectTracking` exported but never called |
| **Search Tracking Hook** | `src/components/tracking-provider.tsx` | UNUSED | `useSearchTracking` documented but not implemented |

---

### Unused Custom Hooks

| Hook | Location | Lines | Notes |
|------|----------|-------|-------|
| `useTracking` | `src/hooks/use-tracking.ts:42-186` | 144 | Comprehensive tracking hook with 12+ methods, never imported |
| `useScrollTracking` | `src/hooks/use-tracking.ts:191-214` | 23 | Scroll depth tracking, never used |
| `useTimeOnPage` | `src/hooks/use-tracking.ts:219-234` | 15 | Time tracking, never used |

**Total Unused Hook Code:** ~220+ lines

---

### Orphaned/Duplicate Files

| File | Issue | Action |
|------|-------|--------|
| `/src/app/about/page.tsx` | 44-line stub; `/about-us/page.tsx` (730 lines) is the actual page | **DELETED** |
| `/next.config.mjs` | Empty duplicate of `/next.config.js` | **DELETED** |
| `/postcss.config.mjs` | Duplicate of `/postcss.config.js` | **DELETED** |
| `/src/app/success-stories/page.tsx` | Not linked from any navigation | VERIFY/DELETE |

---

### Commented Out Code Blocks

| Location | Lines | Pattern |
|----------|-------|---------|
| `src/app/api/admin/projects/status/route.ts:18` | ~5 | ~~Commented user lookup~~ **FIXED** |
| `src/app/api/admin/projects/history/route.ts:17` | ~5 | ~~Commented user lookup~~ **FIXED** |
| `src/app/api/admin/projects/review/route.ts:23` | ~5 | ~~Commented user lookup~~ **FIXED** |
| `src/app/api/admin/retailers/route.ts:32` | ~5 | ~~Commented user lookup~~ **FIXED** |
| `src/types/index.ts:119-340` | ~220 | Disabled category definitions (Food, Journalism, etc.) |

**Total Commented Code:** ~220 lines remaining (disabled categories)

---

### Incomplete Features (TODO Comments)

| File | Line | TODO |
|------|------|------|
| `src/types/index.ts` | 119, 202, 234, 269, 305, 327 | "Reactivate [X] category in the future" - 6 disabled categories |
| `src/lib/ai/marketing-services.ts` | 835 | Implement fetching test from DB |
| `src/app/projects/[slug]/page.tsx` | 451, 453 | Fetch similar projects & comments from API |
| `src/app/api/user/settings/email/route.ts` | 106 | Send verification email to new address |
| `src/app/api/admin/projects/status/route.ts` | 133 | Send email notification if sendEmail is true |

---

### API Endpoints Potentially Not Called

| Endpoint | Location | Evidence |
|----------|----------|----------|
| `/api/admin/notifications` | `src/app/api/admin/notifications/route.ts` | Admin page uses mock data |
| `/api/admin/email` | `src/app/api/admin/email/route.ts` | No frontend calls found |
| `/api/health` | `src/app/api/health/route.ts` | Only referenced in middleware |

---

### Test Coverage

**Status:** ⚠️ CRITICAL - **ZERO TEST FILES**

No test files found (searched: `*.test.ts`, `*.test.tsx`, `*.spec.ts`, `*.spec.tsx`)

**Recommended:** Add tests for critical paths:
- Authentication flow
- Payment processing
- Webhook handlers
- API endpoints

---

### Cleanup Commands

```bash
# Find all console statements
grep -r "console\." --include="*.ts" --include="*.tsx" src/ | wc -l

# Find unused exports (requires ts-prune)
npx ts-prune | head -50

# Find unused dependencies
npx depcheck

# Remove unused imports (ESLint fix)
npm run lint -- --fix
```

---

## Notes

- Priority should be given to Critical and High items
- Security issues should be addressed before public launch
- Dead code cleanup can be done incrementally
- Consider setting up automated security scanning (Snyk, etc.)

---

*Last Updated: December 11, 2025*
