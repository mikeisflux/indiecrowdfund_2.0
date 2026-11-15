#!/usr/bin/env node
/**
 * Scan the client JavaScript Next.js is about to ship for anything that
 * looks like a secret.
 *
 * The FBI's ARTEX FLASH lists "hardcoded administrator passwords in SPA
 * JavaScript bundles" as an observed initial-access route, and recommends
 * continuous scanning of build artifacts for exposed secrets. Anything under
 * .next/static is served to every visitor; a server-only key that leaks
 * into it through a NEXT_PUBLIC_ variable or a misplaced import is public
 * the moment the build is swapped in.
 *
 *   node scripts/scan-client-bundle.cjs [.next-new]
 *
 * Exits 1 with the offending file and a redacted excerpt when a pattern
 * matches. Run by build-and-swap.sh after a successful build, before the
 * swap, so a leaking build never goes live.
 */
const fs = require("fs");
const path = require("path");

const buildDir = process.argv[2] || ".next";
const staticDir = path.join(buildDir, "static");

// Each pattern: a name and a regex that should never appear in client code.
const PATTERNS = [
  { name: "Stripe secret key", re: /\bsk_(live|test)_[0-9A-Za-z]{16,}/ },
  { name: "Stripe restricted key", re: /\brk_(live|test)_[0-9A-Za-z]{16,}/ },
  { name: "Stripe webhook secret", re: /\bwhsec_[0-9A-Za-z]{16,}/ },
  { name: "IndieCrowdfund Agent API secret", re: /\bicsk_[0-9A-Za-z_-]{16,}/ },
  { name: "IndieCrowdfund Agent API key id", re: /\bick_[0-9A-Za-z_-]{12,}/ },
  { name: "AWS access key id", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "Private key block", re: /-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/ },
  { name: "Postgres connection string", re: /postgres(ql)?:\/\/[^\s"'<>]+:[^\s"'<>@]+@/ },
  { name: "Mailgun key", re: /\bkey-[0-9a-f]{32}\b/ },
  { name: "SendGrid key", re: /\bSG\.[0-9A-Za-z_-]{16,}\.[0-9A-Za-z_-]{16,}/ },
  { name: "Anthropic key", re: /\bsk-ant-[0-9A-Za-z_-]{20,}/ },
  { name: "OpenAI key", re: /\bsk-proj-[0-9A-Za-z_-]{20,}/ },
  { name: "Slack token", re: /\bxox[baprs]-[0-9A-Za-z-]{10,}/ },
  { name: "Google API key", re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: "JWT-looking secret assignment", re: /(JWT_SECRET|NEXTAUTH_SECRET|SESSION_SECRET|INTERNAL_API_SECRET|CRON_SECRET|VAULT_KEY|BANK_ACCOUNT_ENCRYPTION_KEY)["']?\s*[:=]\s*["'][^"']{8,}/ },
  { name: "Server env var name in client code", re: /process\.env\.(DATABASE_URL|CRON_SECRET|INTERNAL_API_SECRET|VAULT_KEY|BANK_ACCOUNT_ENCRYPTION_KEY|DIVINITYCOIN_API_KEY|MAILGUN_API_KEY|SENDGRID_API_KEY|ANTHROPIC_API_KEY)\b/ },
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.(js|mjs|json|txt|html|css)$/.test(entry.name)) out.push(p);
  }
  return out;
}

const files = walk(staticDir);
if (files.length === 0) {
  console.log(`[bundle-scan] nothing to scan under ${staticDir}`);
  process.exit(0);
}

const findings = [];
for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  for (const { name, re } of PATTERNS) {
    const m = re.exec(text);
    if (!m) continue;
    const at = m.index;
    const excerpt = text.slice(Math.max(0, at - 40), at + Math.min(m[0].length, 24)).replace(/\s+/g, " ");
    findings.push({ file: path.relative(process.cwd(), file), name, excerpt: excerpt.replace(m[0], m[0].slice(0, 8) + "…[redacted]") });
  }
}

if (findings.length === 0) {
  console.log(`[bundle-scan] OK: ${files.length} client files, no secret-like strings`);
  process.exit(0);
}

console.error(`[bundle-scan] FAIL: ${findings.length} secret-like string(s) in client code`);
for (const f of findings) console.error(`  - ${f.name} in ${f.file}\n      …${f.excerpt}…`);
console.error("A server-only value is reaching the browser bundle. Find the NEXT_PUBLIC_ variable or client import carrying it; do not ship this build.");
process.exit(1);
