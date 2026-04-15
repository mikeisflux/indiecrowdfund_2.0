# Next.js 16 + React 19 Upgrade Research

**Date:** 2026-04-15
**Current state:** Next.js 15.5.15, React 18.x, TypeScript 5.9.3, Node 22.22.2
**Target:** Next.js 16.x (latest stable), optionally React 19

---

## Research sources

- Next.js 16 GitHub release notes (`v16.0.0` tag)
- Official Next.js 16 upgrade guide (raw markdown from `vercel/next.js` repo)
- React 19 GitHub release notes (`v19.0.0` tag)
- `npm view` for peer dependency verification of `next@16.0.0` → `16.2.3`

---

## Critical findings

### 1. React 19 is OPTIONAL for Next.js 16

Verified via actual npm peer dependencies for every `next@16.x.y`:

```
react: ^18.2.0 || 19.0.0-rc-... || ^19.0.0
react-dom: ^18.2.0 || 19.0.0-rc-... || ^19.0.0
```

**Next.js 16 accepts React 18.2+ across every 16.x release.** The two upgrades are
fully decoupled — we can do Next 16 on React 18 first, then React 19 independently.
The official upgrade guide *recommends* React 19.2 but it's not enforced.

### 2. Node.js 20.9.0 minimum

We're on Node 22.22.2. ✅

### 3. TypeScript 5.1.0 minimum

We have `typescript: "^5"` which resolves to 5.9.3. ✅

### 4. `middlewareClientMaxBodySize` status unclear

The upgrade guide does **not** mention this config key. It's an experimental option tied to
the `middleware` convention. When we move to `proxy.ts` (which uses `nodejs` runtime, not
`edge`), body size limits work differently. Must verify empirically after the bump.

### 5. `middleware.ts` is DEPRECATED BUT NOT REMOVED

Quote from the upgrade guide:

> Keep using `middleware.ts` if you need `edge` runtime. The `edge` runtime is NOT supported in `proxy`.

Our `middleware.ts` has no explicit `runtime` export and no DB/Prisma imports, so it could
migrate to `proxy.ts` (nodejs runtime) and Just Work — or sit on `middleware.ts` with a
deprecation warning for a while.

---

## Codebase audit against Next 16 breaking changes

| # | Breaking change | Our status | Action |
|---|---|---|---|
| 1 | Node 20.9.0 minimum | ✅ We're on 22.22.2 | None |
| 2 | TypeScript 5.1.0 minimum | ✅ We're on 5.9.3 | None |
| 3 | `middleware` → `proxy` rename | ⚠️ 784-line `middleware.ts` exists | Codemod |
| 4 | `skipMiddlewareUrlNormalize` → `skipProxyUrlNormalize` | ✅ Not used | None |
| 5 | Sync `cookies()`/`headers()` removed | ✅ All 14 call sites already `await`ed | None |
| 6 | Sync `params`/`searchParams` removed | ✅ 167 files already `Promise<...>`, zero sync | None |
| 7 | `unstable_cache*` renamed | ✅ Zero usage | None |
| 8 | `experimental_ppr` removed | ✅ Zero usage | None |
| 9 | `dynamicIO` / `useCache` → `cacheComponents` | ✅ Zero usage | None |
| 10 | `publicRuntimeConfig` / `serverRuntimeConfig` removed | ✅ Zero usage | None |
| 11 | `amp` config removed | ✅ Not used | None |
| 12 | `next lint` command removed | ✅ We run `eslint .` directly | None |
| 13 | ESLint Flat Config default | ✅ We have `eslint.config.mjs` | None |
| 14 | `images.domains` deprecated | ✅ Already on `remotePatterns` | None |
| 15 | `images.localPatterns` required for query-string local Image | ✅ Only `?v=` in og:image metadata, not `<Image>` | None |
| 16 | `images.minimumCacheTTL` default changed to 4h | ✅ We set it explicitly to 30 days | None |
| 17 | `images.qualities` default changed to `[75]` | ⚠️ We don't set it | Verify after bump |
| 18 | `revalidateTag('key')` now needs 2nd arg | ⚠️ Used in 2 places in `retailers/route.ts` | Update in same commit as bump (2-arg sig doesn't exist on Next 15) |
| 19 | Parallel routes require `default.js` | ✅ `app/@modal/default.tsx` already exists | None |
| 20 | Turbopack default for `dev` + `build` | ⚠️ Unknown compat | Test, opt to `--webpack` if needed |
| 21 | `serverExternalPackages` | ✅ Still supported, we use it | None |
| 22 | `experimental.serverActions.bodySizeLimit` | ✅ Still supported | None |
| 23 | `experimental.middlewareClientMaxBodySize` | ⚠️ Unclear fate | Verify after bump |
| 24 | New `.next/dev` vs `.next` dirs | ⚠️ Our `distDir` uses `NEXT_BUILD_OUTPUT` env | Verify deploy scripts |
| 25 | React 19 required | ✅ 18.2+ still accepted | Defer |

---

## React 18 → 19 breaking changes audit

| # | React 19 change | Our status | Action |
|---|---|---|---|
| 1 | `forwardRef` | ⚠️ 75 usages (all shadcn/ui) | None — still supported, ref-as-prop is additive |
| 2 | `useFormState` → `useActionState` | ✅ Zero usage | None |
| 3 | `useFormStatus` | ✅ Zero usage | None |
| 4 | `defaultProps` on function components removed | ✅ Zero usage | None |
| 5 | `propTypes` removed | ✅ Zero usage | None |
| 6 | String refs removed | ✅ Zero usage | None |
| 7 | `ReactDOM.render` / `ReactDOM.hydrate` removed | ✅ Zero usage (Next owns rendering) | None |
| 8 | `React.VFC` removed | ✅ Zero usage | None |
| 9 | New JSX Transform | ✅ Already using it via Next | None |
| 10 | Radix UI React 19 compat | ✅ All accept `^19.0.0` | None |
| 11 | TipTap React 19 compat | ✅ Latest accepts `^19` | None |
| 12 | Recharts / react-hook-form / sonner / cmdk / react-day-picker / input-otp | ✅ All accept React 19 | None |
| 13 | `react-pageflip` (old 2.0.x) | ⚠️ No peer deps declared | Test after bump |

**React 19 migration surface for us is nearly zero.** Our codebase is well-maintained.
The 75 `forwardRef` usages all continue to work unchanged.

---

## The Baby-Step Plan

### Philosophy

Split into independent sub-concerns so a rollback is surgical:
1. Codemod changes (middleware rename, async dynamic APIs — we're already compliant, revalidateTag second arg)
2. Package bumps themselves
3. React 19 bump (optional, decoupled)
4. Turbopack-vs-webpack decision

### Phase 1 — Pre-flight prep

#### Step 1: `revalidateTag` 2nd arg ~~(safe on Next 15)~~
**DEFERRED to Step 3.** Next 15.5.15 only accepts 1 arg for `revalidateTag`.
The 2-arg signature is a Next 16 addition. Will land alongside the bump.

#### Step 2: Bump `eslint-config-next` to latest compatible with both 15.5 and 16
TBD — need to check if there's a version that straddles both majors.

### Phase 2 — The Next.js bump

#### Step 3: Bump Next.js 15.5.15 → 16.0.0

**Files:** `package.json` (`next`)

- Drop `--turbopack` from `dev` script if present (now default)
- **Leave `middleware.ts` unrenamed** for this commit — codemod is its own step
- Update both `revalidateTag(...)` call sites to `revalidateTag(..., "max")` in this commit
- Run `tsc --noEmit`, fix any new type errors
- Run `next build` — expect noise about middleware deprecation, config key renames, missing `qualities` default

**Expected failure modes:**
- `experimental.middlewareClientMaxBodySize` may emit a warning or error
- `images.qualities` may need explicit config to match previous behavior
- `.next/dev` vs `.next` directory split may break our `distDir` env var logic
- Turbopack may choke on something → opt out with `--webpack`

**Commit:** `Bump Next.js 15.5.15 → 16.0.0`

#### Step 4: Run the `middleware → proxy` codemod

**Command:** `npx @next/codemod@latest upgrade latest` (or specifically `middleware-to-proxy`)

- Review the 784-line diff **by hand** before committing
- Verify `NextResponse.next()`, `NextResponse.rewrite()`, `NextResponse.redirect()`, `NextResponse.json()` all still work
- Critical: verify `config.matcher` export still works (or gets renamed)
- Test locally: bot blocker, CSRF, crawler allowlist, maintenance mode path
- `proxy.ts` uses `nodejs` runtime — confirm no edge-specific code in our middleware

**Commit:** `Migrate middleware.ts → proxy.ts via Next 16 codemod`

#### Step 5: Clean up Next 16 deprecation warnings

Whatever `next build` complains about that the codemod missed.

**Commit:** `Clean up Next 16 deprecation warnings`

#### Step 6: Bump to latest 16.x patch

After 16.0 is stable, bump straight to the latest 16.x.y.

**Commit:** `Bump Next.js 16.0 → 16.x.y`

### Phase 3 — Optional React 19 upgrade (DECOUPLED)

**Do NOT stack this on Next 16 in the same deploy.**

#### Step 7: Bump React 18 → 19

**Files:** `package.json` (`react`, `react-dom`, `@types/react`, `@types/react-dom`)

- Run React 19 types codemod: `npx types-react-codemod@latest preset-19 ./src`
- Run `tsc --noEmit`
- Full regression test: every form, every modal, every dropdown, every dialog

**Commit:** `Bump React 18 → 19`

#### Step 8: (Optional, future) Migrate `forwardRef` to ref-as-prop

75 shadcn/ui components. Zero functional change. **Don't do this** unless we have a specific reason.

---

## Risk assessment

| Step | Risk | Mitigation |
|---|---|---|
| Step 3 (bump to 16.0.0 + revalidateTag fix) | Medium | Keep `middleware.ts` unrenamed at this step; isolate failures from version bump vs rename |
| Step 4 (middleware codemod) | **High** — bot blocker, CSRF, everything critical flows through here | Manual diff review, test locally before push, rollback ready |
| Step 5 (deprecation cleanup) | Low | Minor config tweaks |
| Step 6 (16.0 → 16.x patch) | Very low | Same as any patch bump |
| Step 7 (React 19) | Medium — 75 forwardRef components could regress | Defer until Next 16 confirmed stable; full UI regression test |

---

## Sequencing recommendation

**Do NOT start until both of these are confirmed stable on prod:**
1. Prisma 7.7.0 + override deploy (`100ae35e` + `0722f937`)
2. Email reconciliation fix (`1935c36f` + `56280fcc`)

Once baked for ~24 hours:
- **Steps 3–6** (Next 16): in sequence over a day or two, not all at once
- **Step 4** (middleware codemod) deserves its own deploy
- **Step 7** (React 19): wait for Next 16 to prove stable for at least a few days

**Do NOT:**
- Combine Next 16 + React 19 in one commit
- Run the middleware codemod before verifying the base Next 16 bump works
- Do the `forwardRef` cleanup (zero value, adds diff noise)
