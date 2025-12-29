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

## Pre-Commit Checklist
1. All imports are used
2. No unused function parameters
3. Run lint check mentally before committing
