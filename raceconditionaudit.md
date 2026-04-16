# Race Condition Audit — IndieCrowdfund

**Date started:** 2026-04-15
**Full re-audit started:** 2026-04-16
**Status:** In progress — reading every file top to bottom
**Total files:** 274

---

## Checklist Files

The full audit is split across these files (each under 1000 lines):

1. [Part 1 — Admin routes](raceconditionaudit-part1-admin.md) (77 files)
2. [Part 2 — Auth, Backer, Chat, Collaborator, Contact](raceconditionaudit-part2-auth-backer.md) (19 files)
3. [Part 3 — Creator routes](raceconditionaudit-part3-creator.md) (55 files)
4. [Part 4 — Cron, Email, Marketplace, Messages, Pay, PayPal, Pledges](raceconditionaudit-part4-cron-pledges.md) (33 files)
5. [Part 5 — Projects, Retailers, Rewards, Stripe, Surveys](raceconditionaudit-part5-projects-rewards.md) (38 files)
6. [Part 6 — Tracking, User, Webhooks, Whop, Lib files](raceconditionaudit-part6-user-lib.md) (52 files)

---

## Rules

- Every file is read top to bottom, every HTTP handler inspected
- A box is checked ONLY after the full file has been read and all handlers reviewed
- If a fix is needed, it's applied before checking the box
- No grep-scanning — full reads only
