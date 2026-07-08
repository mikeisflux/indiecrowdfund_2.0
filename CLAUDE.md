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
- The database credentials in this file are for reference when the **user** runs commands on the production server — not for Claude to use

### Database Credentials (for user reference only)
- **ALWAYS** use the full connection string with credentials in every command:
  ```
  PGPASSWORD='AH2hqkufqtrp9BmdRkAsdU83N9fW4Q6w' psql -h localhost -U indieuser -d indiecrowdfund -c "..."
  ```
- Never use placeholder `DATABASE_URL` or `your_database_url_here` — always include the real credentials
- When the user needs to run database queries or fixes, **ALWAYS** provide ready-to-run one-shot commands
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
8. **TEST ALL FUNCTIONALITY** - Before marking any feature complete:
   - Actually test the feature works end-to-end, not just that code compiles
   - Test the full user flow: input → save → navigate away → return → verify data persists
   - Don't assume code works just because it looks correct - verify it functions as intended
   - If you can't test directly, clearly communicate what needs to be tested by the user
