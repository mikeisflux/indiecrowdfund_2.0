# Race Condition Audit — IndieCrowdfund

**Date started:** 2026-04-15
**Full re-audit started:** 2026-04-16
**Status:** COMPLETE — all 1,313 files checked
**Total files:** 1,313
**Total fixes applied:** 25+ race condition fixes across all audit sessions

---

## Checklist Files

The full audit is split across these files (each under ~300 lines):

1. [Part 1 — Root, config, docs, scripts, prisma](raceconditionaudit-part1-root.md) (145 files)
2. [Part 2 — src/app/api/admin](raceconditionaudit-part2-api-admin.md) (119 files)
3. [Part 3a — src/app/api (non-admin, A-M)](raceconditionaudit-part3a-api.md) (141 files)
4. [Part 3b — src/app/api (non-admin, N-Z)](raceconditionaudit-part3b-api.md) (140 files)
5. [Part 4 — src/app/admin (pages)](raceconditionaudit-part4-admin-pages.md) (157 files)
6. [Part 5 — src/app/dashboard (pages)](raceconditionaudit-part5-dashboard.md) (204 files)
7. [Part 6 — src/app other pages](raceconditionaudit-part6-app-other.md) (137 files)
8. [Part 7 — src/components](raceconditionaudit-part7-components.md) (165 files)
9. [Part 8 — src/lib + src/types + src/middleware + src/tests](raceconditionaudit-part8-lib.md) (105 files)

---

## Rules

- Every file is read top to bottom, every function/handler inspected
- A box is checked ONLY after the full file has been read and reviewed
- If a fix is needed, it's applied before checking the box
- No grep-scanning — full reads only
