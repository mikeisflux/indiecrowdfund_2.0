#!/usr/bin/env bash
#
# make-copyright-pdf.sh — screenshot every page of the site into one PDF.
#
# Run it on the host server (or any machine that can reach the site):
#     bash scripts/make-copyright-pdf.sh
#
# It self-installs its tooling (Playwright + pdf-lib) into an isolated folder,
# installs a headless Chromium (and its system libraries), screenshots each
# page full-length, and assembles them into a single PDF. Nothing here touches
# the app's own node_modules or package.json.
#
# It captures in TWO passes:
#   1. Public pages (logged out) — marketing, legal, shop, handbooks, etc.
#   2. Authenticated pages (logged in) — the whole /dashboard, /admin and
#      /settings tree — but ONLY if you provide credentials (see below).
# It also harvests real links off the index pages, so individual projects,
# books, comics, music and movies get captured too (not just the index).
#
# Output (default): ./copyrightpdf/indiecrowdfund-public-pages.pdf
#                   ./copyrightpdf/screenshots/*.png
#
# Config via environment variables:
#   BASE_URL     Site to capture.  Default: https://indiecrowdfund.com
#                Tip: to bypass a CDN/bot-blocker, run this ON the server and
#                set BASE_URL=http://localhost:3000 (your app's port).
#   IC_COOKIE    Raw "Cookie:" header of an already-logged-in session. When
#                set, the authenticated pass uses it instead of a form login
#                (this is how the /admin Copyright tab authenticates). Takes
#                precedence over IC_EMAIL/IC_PASSWORD.
#   IC_EMAIL     Login email for the authenticated pass. If none of IC_COOKIE /
#   IC_PASSWORD  Login password.   IC_EMAIL+IC_PASSWORD are set, pass 2 is
#                skipped and only public pages are captured.
#   OUT_DIR      Where the PDF + screenshots go. Default: ./copyrightpdf
#   MAX_PAGES    Safety cap on number of pages. Default: 500
#   SAMPLE       How many detail links to harvest per index page. Default: 8
#   FRESH        Set FRESH=1 to re-capture everything. By default a page whose
#                screenshot already exists is SKIPPED and reused, so re-runs
#                only shoot what's new/missing (resumable).
#
# Example — capture EVERYTHING (public + logged-in) from the local app:
#   IC_EMAIL='you@example.com' IC_PASSWORD='secret' \
#     BASE_URL=http://localhost:3000 bash scripts/make-copyright-pdf.sh
#
set -euo pipefail

BASE_URL="${BASE_URL:-https://indiecrowdfund.com}"
OUT_DIR="${OUT_DIR:-$(pwd)/copyrightpdf}"
MAX_PAGES="${MAX_PAGES:-500}"
SAMPLE="${SAMPLE:-8}"
TOOLING_DIR="$OUT_DIR/.tooling"

echo "==> Site:    $BASE_URL"
echo "==> Output:  $OUT_DIR"
echo "==> Auth:    $( { [ -n "${IC_COOKIE:-}" ] || { [ -n "${IC_EMAIL:-}" ] && [ -n "${IC_PASSWORD:-}" ]; }; } && echo "yes (will capture logged-in pages)" || echo "no (public pages only — set IC_COOKIE, or IC_EMAIL & IC_PASSWORD, for dashboards)")"
echo

command -v node >/dev/null 2>&1 || { echo "ERROR: node is not installed (need Node 18+)."; exit 1; }
command -v npm  >/dev/null 2>&1 || { echo "ERROR: npm is not installed."; exit 1; }

# Diagnostics — when this runs spawned by the app (pm2), a stripped environment
# is the usual reason npm dies instantly. Log what we actually resolved.
echo "==> Env:     node=$(command -v node) npm=$(command -v npm) HOME=${HOME:-<unset>}"

mkdir -p "$TOOLING_DIR" "$OUT_DIR/screenshots"
cd "$TOOLING_DIR"

# --- Install tooling (isolated) ---------------------------------------------
if [ ! -d node_modules/playwright ] || [ ! -d node_modules/pdf-lib ]; then
  echo "==> Installing Playwright + pdf-lib (one-time)..."
  [ -f package.json ] || npm init -y >/dev/null 2>&1
  # Skip the playwright package's postinstall browser download here (it pulls
  # all engines and commonly hangs on a server). We install just Chromium in
  # the next step. Check the exit code explicitly so a failure is LOUD, not
  # swallowed by set -e / the pipeline. Merge stderr into stdout so npm's error
  # can't be lost when this runs detached with output redirected to a log.
  set +e
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-audit --no-fund playwright pdf-lib 2>&1
  rc=$?
  set -e
  # Verify the install actually produced the packages — a stripped-env npm can
  # exit oddly without writing node_modules; don't march on into a broken run.
  if [ $rc -ne 0 ] || [ ! -d node_modules/playwright ] || [ ! -d node_modules/pdf-lib ]; then
    echo "ERROR: installing playwright + pdf-lib failed (exit $rc; node_modules present: playwright=$([ -d node_modules/playwright ] && echo yes || echo no), pdf-lib=$([ -d node_modules/pdf-lib ] && echo yes || echo no))."
    echo "       This usually means the environment is missing HOME/PATH (common when"
    echo "       spawned by pm2). Run it by hand in an SSH shell to restore the tooling:"
    echo "         cd \"$TOOLING_DIR\" && npm install playwright pdf-lib"
    exit 1
  fi
fi

# --- Install Chromium + its system libraries --------------------------------
# install-deps apt-installs the shared libraries Chromium needs (libnspr4,
# libnss3, libgbm, ...). Do NOT hide its output — a silent failure here is what
# produces the "libnspr4.so: cannot open shared object file" crash at launch.
echo "==> Installing Chromium system libraries (needs root/sudo; apt)..."
if ! npx --yes playwright install-deps chromium; then
  echo "    !! install-deps failed. If capture crashes on a missing library, run:"
  echo "       apt-get update && apt-get install -y libnspr4 libnss3 libnssutil3 libsmime3 \\"
  echo "         libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 \\"
  echo "         libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2t64"
fi
echo "==> Installing headless Chromium browser..."
npx --yes playwright install chromium

# --- Screenshot + assemble ---------------------------------------------------
cat > shoot.mjs <<'NODE'
import { chromium } from "playwright";
import { PDFDocument } from "pdf-lib";
import fs from "fs";
import path from "path";

const BASE = (process.env.BASE_URL || "https://indiecrowdfund.com").replace(/\/$/, "");
const OUT_DIR = process.env.OUT_DIR || path.join(process.env.HOME || ".", "indiecrowdfund_2.0/copyrightpdf");
const SHOT_DIR = path.join(OUT_DIR, "screenshots");
const PDF_PATH = path.join(OUT_DIR, "indiecrowdfund-all-pages.pdf");
const MAX_PAGES = parseInt(process.env.MAX_PAGES || "500", 10);
const SAMPLE = parseInt(process.env.SAMPLE || "8", 10);
const FRESH = /^(1|true|yes)$/i.test(process.env.FRESH || "");
const EMAIL = process.env.IC_EMAIL || "";
const PASSWORD = process.env.IC_PASSWORD || "";
// Raw "Cookie:" header value of an already-authenticated session. When set,
// we attach it to the browser instead of doing a form login — this is how the
// /admin Copyright tab authenticates the capture as the current admin (no
// password handling, and it sidesteps NextAuth's origin/CSRF checks).
const COOKIE = process.env.IC_COOKIE || "";
const HAS_AUTH = !!COOKIE || (!!EMAIL && !!PASSWORD);

// ---- Route inventory (from the app's src/app tree) -------------------------
// Public pages — captured logged OUT.
const PUBLIC_PATHS = [
  "/", "/discover", "/crowdfunds", "/how-we-stack-up", "/about-us",
  "/what-is-divinitycoin", "/fees", "/retailers", "/retailers/apply",
  "/retailers/login", "/marketplace", "/marketplace/books", "/press",
  "/success-stories", "/faq", "/help", "/help/whitelist", "/contact",
  "/bug-report", "/creator-handbook", "/backer-handbook", "/indiekit-handbook",
  "/shop-handbook/backers", "/shop-handbook/creators", "/content-guidelines",
  "/trust-safety", "/terms", "/privacy", "/changelog", "/cart", "/projects/new",
  "/survey/preview",
  // Shop storefront
  "/shop", "/shop/books", "/shop/books/featured", "/shop/books/staff-picks",
  "/shop/comics", "/shop/comics/all", "/shop/comics/dollar-bin",
  "/shop/comics/featured", "/shop/comics/staff-picks", "/shop/movies",
  "/shop/music", "/shop/music/featured", "/shop/music/hot", "/shop/music/new",
  "/shop/music/staff-picks", "/shop/physical-media",
  // Auth entry pages (rendered logged out)
  "/login", "/register", "/forgot-password",
];

// Authenticated pages — captured logged IN (needs IC_EMAIL / IC_PASSWORD).
const AUTH_PATHS = [
  "/dashboard", "/dashboard/activity", "/dashboard/backer", "/dashboard/following",
  "/dashboard/projects", "/dashboard/indiekit", "/dashboard/indiekit-v2",
  "/dashboard/messages", "/dashboard/notifications", "/dashboard/profile",
  "/dashboard/settings", "/dashboard/shop", "/dashboard/shop/company",
  "/dashboard/shop/books/new", "/dashboard/shop/movies/new",
  "/dashboard/shop/music/new", "/dashboard/social", "/dashboard/updates",
  "/settings/payment", "/chat",
  // Admin (visible to SUPER_ADMIN)
  "/admin", "/admin/ai", "/admin/ai-marketing", "/admin/analytics",
  "/admin/announcement-bar", "/admin/bug-reports", "/admin/changelog",
  "/admin/consent-banner", "/admin/cron", "/admin/dev-calendar",
  "/admin/divinitycoin-redemptions", "/admin/email", "/admin/email-queue",
  "/admin/email/creator-sent", "/admin/error-logs", "/admin/hero-slider",
  "/admin/link-sanitizer", "/admin/media", "/admin/moderation",
  "/admin/notifications", "/admin/page-builder", "/admin/payouts",
  "/admin/prelaunch", "/admin/press", "/admin/projects", "/admin/promo-popup",
  "/admin/reconcile", "/admin/retailers", "/admin/security", "/admin/seo",
  "/admin/settings", "/admin/shop", "/admin/themes", "/admin/transactions",
  "/admin/users",
];

// Index pages we harvest real detail links from, and the pattern a detail
// link must match. Gives us live project/book/comic/etc. pages, not just the
// index. Kept modest (SAMPLE per index) so the PDF stays a reasonable size.
const DISCOVER = [
  { from: "/crowdfunds",       re: /^\/projects\/[^/]+\/[^/]+$|^\/[^/]+\/[^/]+$/ },
  { from: "/discover",         re: /^\/projects\/[^/]+\/[^/]+$|^\/[^/]+\/[^/]+$/ },
  { from: "/marketplace/books",re: /^\/marketplace\/books\/[^/]+$/ },
  { from: "/press",            re: /^\/press\/[^/]+$/ },
  { from: "/shop/books",       re: /^\/shop\/books\/[^/]+$/ },
  { from: "/shop/comics/all",  re: /^\/shop\/comics\/[^/]+$/ },
  { from: "/shop/music",       re: /^\/shop\/music\/[^/]+$/ },
  { from: "/shop/movies",      re: /^\/shop\/movies\/[^/]+$/ },
];

const normPath = (p) => (p.replace(/\/+$/, "") || "/");
const abs = (p) => BASE + (p === "/" ? "" : p);
const slugFor = (u) => {
  try {
    const p = new URL(u, BASE).pathname.replace(/\/+$/, "");
    return (p === "" ? "home" : p.slice(1).replace(/[^a-z0-9]+/gi, "-")).slice(0, 90) || "home";
  } catch { return "page"; }
};

async function shoot(ctx, url, idx, total, shots, tag) {
  // Deterministic name per URL (no run-index) so re-runs can detect & skip it.
  const file = path.join(SHOT_DIR, `${tag}-${slugFor(url)}.png`);
  // Resume: if we already have a non-empty screenshot, reuse it.
  if (!FRESH) {
    try {
      if (fs.statSync(file).size > 0) {
        shots.push(file);
        console.log(`  [${idx + 1}/${total}] SKIP (cached) (${tag}) ${url}`);
        return true;
      }
    } catch { /* not captured yet — fall through and shoot it */ }
  }
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: file, fullPage: true });
    shots.push(file);
    console.log(`  [${idx + 1}/${total}] OK  (${tag}) ${url}`);
    return true;
  } catch (e) {
    console.log(`  [${idx + 1}/${total}] ERR (${tag}) ${url} :: ${String(e).slice(0, 110)}`);
    return false;
  } finally {
    await page.close();
  }
}

async function harvest(ctx) {
  const found = new Set();
  for (const d of DISCOVER) {
    const page = await ctx.newPage();
    try {
      await page.goto(abs(d.from), { waitUntil: "networkidle", timeout: 45000 });
      await page.waitForTimeout(800);
      const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")));
      let n = 0;
      for (const h of hrefs) {
        if (!h) continue;
        let p;
        try { p = normPath(new URL(h, BASE).pathname); } catch { continue; }
        if (d.re.test(p) && !found.has(p)) { found.add(p); if (++n >= SAMPLE) break; }
      }
      console.log(`  harvested ${n} link(s) from ${d.from}`);
    } catch (e) {
      console.log(`  harvest ERR ${d.from} :: ${String(e).slice(0, 90)}`);
    } finally {
      await page.close();
    }
  }
  return [...found];
}

async function login(ctx) {
  const page = await ctx.newPage();
  try {
    if (COOKIE) {
      // Session cookie is already attached to the context (extraHTTPHeaders).
      // Nothing to submit — just verify it grants access.
      console.log("  using forwarded session cookie");
    } else {
      await page.goto(abs("/login"), { waitUntil: "networkidle", timeout: 45000 });
      await page.fill("input#email, input[name=email]", EMAIL);
      await page.fill("input#password, input[name=password]", PASSWORD);
      await Promise.all([
        page.waitForLoadState("networkidle", { timeout: 45000 }).catch(() => {}),
        page.click("button[type=submit]"),
      ]);
      await page.waitForTimeout(2500);
    }
    // Verify: hit /dashboard and confirm we weren't bounced back to /login.
    await page.goto(abs("/dashboard"), { waitUntil: "networkidle", timeout: 45000 });
    const ok = !/\/login/.test(new URL(page.url()).pathname);
    console.log(ok ? "  auth OK" : `  auth FAILED — landed on ${page.url()}`);
    return ok;
  } catch (e) {
    console.log(`  auth ERR :: ${String(e).slice(0, 140)}`);
    return false;
  } finally {
    await page.close();
  }
}

async function main() {
  fs.mkdirSync(SHOT_DIR, { recursive: true });

  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const mkctx = (extra = {}) => browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    ...extra,
  });

  const shots = [];
  let idx = 0;

  // ---- Pass 0: harvest dynamic detail links (logged out) ----
  const pub = new Set(PUBLIC_PATHS.map(normPath));
  const anon = await mkctx();
  console.log("==> Harvesting detail links from index pages...");
  const dynamic = await harvest(anon);
  for (const p of dynamic) pub.add(p);

  // ---- Pass 1: public pages (logged out) ----
  let publicUrls = [...pub].map(abs).slice(0, MAX_PAGES);
  console.log(`\n==> Pass 1: ${publicUrls.length} public page(s)...\n`);
  for (const url of publicUrls) { await shoot(anon, url, idx, publicUrls.length, shots, "pub"); idx++; }
  await anon.close();

  // ---- Pass 2: authenticated pages (logged in) ----
  const authUrlsAll = [...new Set(AUTH_PATHS.map(normPath))].map(abs).slice(0, MAX_PAGES);
  const cached = (url, tag) => {
    try { return fs.statSync(path.join(SHOT_DIR, `${tag}-${slugFor(url)}.png`)).size > 0; }
    catch { return false; }
  };
  const authNeeded = FRESH || authUrlsAll.some((u) => !cached(u, "auth"));
  if (HAS_AUTH && !authNeeded) {
    // Everything's cached — reuse the existing shots, no login/browser work.
    console.log("\n==> All authenticated pages already captured — skipping login, reusing cached shots.");
    for (const url of authUrlsAll) {
      if (cached(url, "auth")) shots.push(path.join(SHOT_DIR, `auth-${slugFor(url)}.png`));
    }
  } else if (HAS_AUTH) {
    // Attach the forwarded session cookie to the context if we have one.
    const auth = await mkctx(COOKIE ? { extraHTTPHeaders: { Cookie: COOKIE } } : {});
    console.log(`\n==> Authenticating${COOKIE ? " (session cookie)" : ` as ${EMAIL}`} ...`);
    if (await login(auth)) {
      console.log(`\n==> Pass 2: ${authUrlsAll.length} authenticated page(s)...\n`);
      let j = 0;
      for (const url of authUrlsAll) { await shoot(auth, url, j, authUrlsAll.length, shots, "auth"); j++; }
    } else {
      console.log("!! Skipping authenticated pass — authentication did not succeed.");
      console.log("   (For form login on localhost, NextAuth may reject the origin. Prefer IC_COOKIE,");
      console.log("    or set BASE_URL to your real domain / double-check IC_EMAIL / IC_PASSWORD.)");
    }
    await auth.close();
  } else {
    console.log("\n==> Skipping authenticated pass (no IC_COOKIE or IC_EMAIL / IC_PASSWORD set).");
  }

  await browser.close();

  if (shots.length === 0) { console.error("\nNo screenshots captured — nothing to assemble."); process.exit(1); }

  console.log(`\n==> Assembling PDF from ${shots.length} screenshot(s)...`);
  const pdf = await PDFDocument.create();
  for (const f of shots) {
    const png = await pdf.embedPng(fs.readFileSync(f));
    const p = pdf.addPage([png.width, png.height]);
    p.drawImage(png, { x: 0, y: 0, width: png.width, height: png.height });
  }
  fs.writeFileSync(PDF_PATH, await pdf.save());
  console.log(`\nDone. ${shots.length} page(s) captured.`);
  console.log(`PDF:         ${PDF_PATH}`);
  console.log(`Screenshots: ${SHOT_DIR}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
NODE

IC_COOKIE="${IC_COOKIE:-}" IC_EMAIL="${IC_EMAIL:-}" IC_PASSWORD="${IC_PASSWORD:-}" \
  BASE_URL="$BASE_URL" OUT_DIR="$OUT_DIR" MAX_PAGES="$MAX_PAGES" SAMPLE="$SAMPLE" FRESH="${FRESH:-}" node shoot.mjs

echo
echo "==> Finished. Your PDF is at: $OUT_DIR/indiecrowdfund-all-pages.pdf"
