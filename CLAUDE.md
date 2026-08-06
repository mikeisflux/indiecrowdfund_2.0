# Claude Code Guidelines for IndieCrowdfund

## Permissions
- Do NOT prompt the user for permission before making changes, running commands, or taking actions
- Operate autonomously - read, edit, create, delete files, run builds, push code without asking

## ESLint Rules - IMPORTANT

### Unused Imports
- **DO NOT** import anything you're not using in the file
- Before committing, verify every import is actually used in the code
- Common mistake: importing icons from `lucide-react` that aren't rendered

### Unused Function Parameters
- For Next.js route handlers, **omit unused parameters entirely**:
  ```typescript
  // CORRECT - if you don't need req
  export async function POST() {

  // WRONG - will trigger lint error even with underscore
  export async function POST(_req: NextRequest) {
  ```
- Only include `req: NextRequest` if you actually use it (e.g., `req.headers`, `req.url`)

### Type Annotations
- Use `eslint-disable-next-line @typescript-eslint/no-explicit-any` sparingly
- Prefer proper typing when possible

### Images
- **ALWAYS** use `<Image />` from `next/image` instead of `<img>` tags
- The `<img>` element triggers `@next/next/no-img-element` lint error
- Example:
  ```typescript
  // CORRECT
  import Image from "next/image";
  <Image src="/path.jpg" alt="description" width={100} height={100} />

  // WRONG - will trigger lint error
  <img src="/path.jpg" alt="description" />
  ```

### React Hooks Dependencies
- **ALWAYS** include all dependencies in `useEffect`, `useCallback`, and `useMemo` dependency arrays
- Missing dependencies trigger `react-hooks/exhaustive-deps` lint error
- Example:
  ```typescript
  // CORRECT
  useEffect(() => {
    fetchData(projectId);
  }, [projectId, fetchData]);

  // WRONG - missing dependency
  useEffect(() => {
    fetchData(projectId);
  }, []);
  ```

## Project Patterns

### API Route Structure
- Auth check: `session?.user?.role !== "SUPER_ADMIN"`
- Error responses: `NextResponse.json({ error: "message" }, { status: code })`
- Use `getCSRFHeaders()` for mutating requests from client

### CSRF — ALWAYS CHECK BEFORE PUSHING
- Every mutating client call (POST/PUT/PATCH/DELETE) to `/api/*` **must** use `apiFetch` from `@/lib/fetch-utils` — raw `fetch()` skips the CSRF header and the proxy rejects with 403 "CSRF validation failed"
- Before committing any new/edited client fetch to `/api/*`, scan the diff: if the method is POST/PUT/PATCH/DELETE and it's not in the `csrfExemptRoutes` list in `src/proxy.ts`, it must go through `apiFetch`
- Exempt routes (webhooks, `/api/track`, `/api/error-report`, etc.) live in `csrfExemptRoutes` — check that list before assuming plain `fetch()` is OK

### Supported Creator Countries — KEEP THE GRANT AGREEMENT IN SYNC
- The single source of truth for creator payout countries is `BANK_COUNTRY_OPTIONS` / `SUPPORTED_BANK_COUNTRIES` in `src/lib/bank-countries.ts`
- It feeds the **Bank Country** dropdown in the campaign-creation payout step for **every** processor: DivinityCoin, PayPal, and Whop (`src/components/project/builder/payment-sections/*`)
- **When adding a new supported country, you MUST do all of these:**
  1. Add it to `BankCountry`, `BANK_COUNTRY_OPTIONS`, `SUPPORTED_BANK_COUNTRIES`, `BANK_COUNTRY_FIELDS`, and `parseBankCountry` in `src/lib/bank-countries.ts`
  2. Add its branch to `validateBankAccountFormat` (routing/account format for that country)
  3. Add its branch to `sanitizeBankField` if the identifiers are alphanumeric (IBAN/BIC) rather than digits
  4. **Bump `GRANT_AGREEMENT_VERSION` in `src/components/legal/grant-agreement.tsx`** — Section 6 renders its eligible-country list from `BANK_COUNTRY_OPTIONS`, so the text updates itself, but the version string is manual and acceptances record the version signed
  5. Re-read Sections 7–9 of the Grant Agreement (cross-border transfers, taxes/withholding, sanctions) and confirm they still hold for the new country
- **Never** let a creator save a payout account in a country the Grant Agreement doesn't cover. If they can pick it in the bank dropdown, Section 6 must list it.
- The Grant Agreement signing dialog (`src/components/grant/grant-agreement-dialog.tsx`) and its API route both validate the signer's country against `SUPPORTED_BANK_COUNTRIES` — no free-text country entry

### Admin Pages
- Import icons only as needed from `lucide-react`
- Use `fetchWithRetry` for API calls
- Toast notifications via `sonner`: `toast.success()`, `toast.error()`, `toast.info()`

### Database
- Soft deletes use `deletedAt` field
- Always filter with `deletedAt: null` for active records
- Projects: status enum includes DRAFT, SUBMITTED, APPROVED, LIVE, FUNDED, FAILED, CANCELLED
- **ALWAYS** check `prisma/schema.prisma` for correct model and field names before writing database queries
- Common models:
  - `Reward` - both rewards (type: TIER) and add-ons (type: ADDON) are in this model
  - `PledgeAddon` - join table between pledges and addon rewards
  - `DigitalFile` - digital download files

## Database Access
- **NO DIRECT DATABASE ACCESS** in this environment — there is no local database, no DATABASE_URL, and no psql connection available
- **DO NOT** attempt to run psql commands, database scripts, or any direct database connections
- **DO NOT** create standalone scripts that use PrismaClient directly — they will fail without DATABASE_URL
- All database operations must go through the Next.js API routes (which have access to the database at runtime)
- For admin data fixes, build authenticated API endpoints at `src/app/api/admin/...` with UI buttons to trigger them
### Production Database Commands (for user reference only)
- **NEVER write database passwords or any other secret into this repo** — no files, no code comments, no migration headers, no scripts, no commit messages, and no command examples in this file. This repo is PUBLIC on GitHub; anything committed here is compromised the moment it's pushed.
- Commands for the user to run on the production server must use `~/.pgpass` (no password on the command line):
  ```
  psql -h localhost -U indieuser -d indiecrowdfund -c "..."
  ```
- One-time `.pgpass` setup on the server (pulls the password from the app's `.env`, never types or stores it in the repo):
  ```
  echo "localhost:5432:indiecrowdfund:indieuser:$(grep -m1 '^DATABASE_URL' .env | sed -E 's|.*://[^:]+:([^@]+)@.*|\1|')" >> ~/.pgpass && chmod 600 ~/.pgpass
  ```
- When the user needs to run database queries or fixes, **ALWAYS** provide ready-to-run one-shot commands (without embedded credentials)
- Never give raw SQL without wrapping it in a runnable shell command
- Never give multi-step instructions when a single command will do

## Branch Switch Commands
- When the user asks for commands to switch to a branch and pull it down, **ALWAYS** provide all 3 commands:
  ```
  git fetch origin <branch-name>
  git checkout <branch-name>
  git pull origin <branch-name>
  ```
- Never omit the `git fetch` step

## Pre-Commit Checklist
1. All imports are used
2. No unused function parameters
3. Using `<Image />` from next/image, not `<img>`
4. All useEffect/useCallback/useMemo dependencies are included
5. Run lint check mentally before committing
6. **VERIFY API ENDPOINTS EXIST** - Before adding frontend code that calls an API endpoint, verify the endpoint exists at `src/app/api/...`. Never create fetch calls to non-existent endpoints.
7. **TEST DATABASE OPERATIONS** - After implementing any database save/update functionality:
   - Verify the data is actually persisted to the database (not just local state)
   - Test that data survives page navigation and reloads
   - Avoid using Prisma `upsert` with composite unique constraints that may not exist - use `findFirst` + `create`/`update` pattern instead
   - Always handle and log database errors properly
8. **COUNTRY CHANGES** - If the diff touches `src/lib/bank-countries.ts`, verify the Grant Agreement country requirements above were followed (esp. bumping `GRANT_AGREEMENT_VERSION`)
9. **TEST ALL FUNCTIONALITY** - Before marking any feature complete:
   - Actually test the feature works end-to-end, not just that code compiles
   - Test the full user flow: input → save → navigate away → return → verify data persists
   - Don't assume code works just because it looks correct - verify it functions as intended
   - If you can't test directly, clearly communicate what needs to be tested by the user
