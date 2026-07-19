#!/usr/bin/env bash
#
# make-copyright-pdf.sh — screenshot every public page of the site into one PDF.
#
# Run it on the host server (or any machine that can reach the site):
#     bash scripts/make-copyright-pdf.sh
#
# It self-installs its tooling (Playwright + pdf-lib) into an isolated folder,
# installs a headless Chromium, screenshots each public page full-length, and
# assembles them into a single PDF. Nothing here touches the app's own
# node_modules or package.json.
#
# Output (default): ./copyrightpdf/indiecrowdfund-public-pages.pdf
#                   ./copyrightpdf/screenshots/*.png
#
# Config via environment variables:
#   BASE_URL   Site to capture.        Default: https://indiecrowdfund.com
#              Tip: to bypass a CDN/bot-blocker, run this ON the server and set
#              BASE_URL=http://localhost:3000 (your app's port).
#   MODE       "sitemap" = the live /sitemap.xml UNION a curated list of known
#              public pages (comprehensive: static pages + all live projects +
#              creator profiles + books, and never misses a page the sitemap
#              happens to omit).
#              "core"    = only the curated marketing / legal / info pages.
#              Default: sitemap
#   OUT_DIR    Where the PDF + screenshots go. Default: ./copyrightpdf
#   MAX_PAGES  Safety cap on number of pages. Default: 500
#
set -euo pipefail

BASE_URL="${BASE_URL:-https://indiecrowdfund.com}"
MODE="${MODE:-sitemap}"
OUT_DIR="${OUT_DIR:-$(pwd)/copyrightpdf}"
MAX_PAGES="${MAX_PAGES:-500}"
TOOLING_DIR="$OUT_DIR/.tooling"

echo "==> Site:   $BASE_URL"
echo "==> Mode:   $MODE"
echo "==> Output: $OUT_DIR"
echo

command -v node >/dev/null 2>&1 || { echo "ERROR: node is not installed (need Node 18+)."; exit 1; }
command -v npm  >/dev/null 2>&1 || { echo "ERROR: npm is not installed."; exit 1; }

mkdir -p "$TOOLING_DIR" "$OUT_DIR/screenshots"
cd "$TOOLING_DIR"

# --- Install tooling (isolated) ---------------------------------------------
if [ ! -d node_modules/playwright ] || [ ! -d node_modules/pdf-lib ]; then
  echo "==> Installing Playwright + pdf-lib (one-time)..."
  [ -f package.json ] || npm init -y >/dev/null 2>&1
  npm install playwright pdf-lib
fi

# --- Install Chromium (+ OS libraries) --------------------------------------
# --with-deps installs the system libraries Chromium needs; it uses apt and so
# needs root/sudo. If that fails, fall back to the browser-only install (which
# works if the libraries are already present).
echo "==> Installing headless Chromium..."
if ! npx --yes playwright install --with-deps chromium 2>/dev/null; then
  echo "    (--with-deps failed — likely no sudo; trying browser-only install)"
  npx --yes playwright install chromium
fi

# --- Screenshot + assemble ---------------------------------------------------
cat > shoot.mjs <<'NODE'
import { chromium } from "playwright";
import { PDFDocument } from "pdf-lib";
import fs from "fs";
import path from "path";

const BASE = (process.env.BASE_URL || "https://indiecrowdfund.com").replace(/\/$/, "");
const MODE = process.env.MODE || "sitemap";
const OUT_DIR = process.env.OUT_DIR || "./copyrightpdf";
const MAX_PAGES = parseInt(process.env.MAX_PAGES || "500", 10);
const SHOT_DIR = path.join(OUT_DIR, "screenshots");
const PDF_PATH = path.join(OUT_DIR, "indiecrowdfund-public-pages.pdf");

// Known public pages (paths). Kept as a safety net so the capture never depends
// on the sitemap being complete/current. Redirect-only routes (e.g. /explore,
// /shop, /projects, /term, /fulfillment) are intentionally omitted to avoid
// duplicate captures of their targets.
const CORE_PATHS = [
  "/", "/discover", "/crowdfunds", "/how-we-stack-up", "/about-us",
  "/what-is-divinitycoin", "/fees", "/retailers", "/marketplace",
  "/marketplace/books", "/press", "/success-stories", "/faq", "/help",
  "/contact", "/bug-report", "/creator-handbook", "/backer-handbook",
  "/indiekit-handbook", "/content-guidelines", "/trust-safety", "/terms",
  "/privacy", "/changelog", "/login", "/register",
];

const normPath = (p) => (p.replace(/\/+$/, "") || "/");
const slugFor = (u) => {
  try {
    const p = new URL(u).pathname.replace(/\/+$/, "");
    return (p === "" ? "home" : p.slice(1).replace(/[^a-z0-9]+/gi, "-")).slice(0, 80) || "home";
  } catch { return "page"; }
};

async function sitemapPaths() {
  try {
    const res = await fetch(`${BASE}/sitemap.xml`, { redirect: "follow" });
    if (!res.ok) { console.log(`!! sitemap fetch HTTP ${res.status} — using curated list only`); return []; }
    const xml = await res.text();
    return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)]
      .map((m) => { try { return normPath(new URL(m[1].trim()).pathname); } catch { return null; } })
      .filter(Boolean);
  } catch (e) {
    console.log(`!! sitemap fetch failed (${String(e).slice(0, 80)}) — using curated list only`);
    return [];
  }
}

async function getUrls() {
  const core = CORE_PATHS.map(normPath);
  // "core" mode: curated pages only. "sitemap" mode: live sitemap UNION curated.
  const paths = MODE === "sitemap"
    ? [...new Set([...core, ...(await sitemapPaths())])]
    : [...new Set(core)];
  // Rebuild against BASE so it works for any origin (incl. localhost).
  return paths.map((p) => BASE + (p === "/" ? "" : p));
}

async function main() {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  let urls = await getUrls();
  if (urls.length > MAX_PAGES) {
    console.log(`!! ${urls.length} URLs found; capping at MAX_PAGES=${MAX_PAGES}. Raise MAX_PAGES to include all.`);
    urls = urls.slice(0, MAX_PAGES);
  }
  console.log(`==> Capturing ${urls.length} page(s)...\n`);

  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  });

  const shots = [];
  let ok = 0, err = 0;
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const file = path.join(SHOT_DIR, `${String(i).padStart(3, "0")}-${slugFor(url)}.png`);
    const page = await ctx.newPage();
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
      await page.waitForTimeout(1200);
      await page.screenshot({ path: file, fullPage: true });
      shots.push(file); ok++;
      console.log(`  [${i + 1}/${urls.length}] OK  ${url}`);
    } catch (e) {
      err++;
      console.log(`  [${i + 1}/${urls.length}] ERR ${url} :: ${String(e).slice(0, 120)}`);
    } finally {
      await page.close();
    }
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
  console.log(`\nDone. ${ok} captured, ${err} failed.`);
  console.log(`PDF:         ${PDF_PATH}`);
  console.log(`Screenshots: ${SHOT_DIR}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
NODE

BASE_URL="$BASE_URL" MODE="$MODE" OUT_DIR="$OUT_DIR" MAX_PAGES="$MAX_PAGES" node shoot.mjs

echo
echo "==> Finished. Your PDF is at: $OUT_DIR/indiecrowdfund-public-pages.pdf"
