# Claude Code Guidelines for IndieCrowdfund

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

## Database Commands
- **ALWAYS** use the full connection string with credentials in every command:
  ```
  PGPASSWORD='01JSN9vhvVTiMEU7odCpF6L3' psql -h db.indiecrowdfund.com -U indieuser -d indiecrowdfund -c "..."
  ```
- Never use placeholder `DATABASE_URL` or `your_database_url_here` — always include the real credentials
- When the user needs to run database queries or fixes, **ALWAYS** provide ready-to-run one-shot commands
- Never give raw SQL without wrapping it in a runnable shell command
- Never give multi-step instructions when a single command will do

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
