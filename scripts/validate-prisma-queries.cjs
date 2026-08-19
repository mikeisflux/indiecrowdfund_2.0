#!/usr/bin/env node
/**
 * Pre-flight: check Prisma query field names against the real schema.
 *
 * TypeScript does not do this. A probe of
 *   db.user.findFirst({ select: { totallyBogusFieldXyz: true } })
 *   db.project.findMany({ where: { alsoBogusXyz: 1 } })
 * type-checks clean against tsconfig.build.json, so an invalid query passes
 * the build, passes lint, deploys, and then throws
 * PrismaClientValidationError on every single request behind whatever
 * catch-all the route happens to use.
 *
 * That has shipped three times: User.stripeAccountId and
 * User.stripeAccountStatus took down the whole IndieKit Integrations panel,
 * Project.shortDescription took down the admin Insert-campaign menu, and a
 * missing bannedAt in a creator select silently made a project's
 * banned-creator flag permanently false.
 *
 * This walks the source with the TypeScript parser, finds Prisma calls, and
 * checks the field names in select / include / where / orderBy against the
 * generated client's DMMF — the same model definitions Prisma validates
 * against at runtime.
 *
 * DELIBERATELY CONSERVATIVE. It gates deploys, so a false positive is worse
 * than a miss. Anything it cannot read statically — a spread, a computed key,
 * an object passed by variable — is skipped rather than guessed at.
 *
 *   node scripts/validate-prisma-queries.cjs [--verbose]
 *
 * Exit 0 = clean, 1 = invalid field found, 2 = could not run.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");
const VERBOSE = process.argv.includes("--verbose");

let ts, Prisma;
try {
  ts = require(path.join(ROOT, "node_modules/typescript"));
} catch {
  console.error("Could not load typescript — skipping Prisma query validation.");
  process.exit(2);
}
try {
  ({ Prisma } = require(path.join(ROOT, "node_modules/@prisma/client")));
} catch {
  console.error("Could not load @prisma/client — run `npx prisma generate` first.");
  process.exit(2);
}

const dmmf = Prisma && Prisma.dmmf && Prisma.dmmf.datamodel;
if (!dmmf || !Array.isArray(dmmf.models)) {
  console.error("Prisma DMMF unavailable — skipping Prisma query validation.");
  process.exit(2);
}

// ── Compound keys ──────────────────────────────────────────────────────────
// `@@unique([projectId, provider])` is addressable in a where clause as
// `projectId_provider`, and a multi-field `@@id` likewise. These are real
// input keys that are not fields, so without them every findUnique/upsert on
// a compound key would be reported as an error.
//
// Prisma 7's runtime DMMF datamodel carries only name/fields/dbName — no
// uniqueFields or uniqueIndexes — so this reads the declarations out of the
// schema files directly.
const compoundKeys = new Map();
{
  const schemaDir = path.join(ROOT, "prisma", "schema");
  const schemaFiles = fs.existsSync(schemaDir)
    ? fs.readdirSync(schemaDir).filter((f) => f.endsWith(".prisma")).map((f) => path.join(schemaDir, f))
    : [path.join(ROOT, "prisma", "schema.prisma")].filter((f) => fs.existsSync(f));

  for (const file of schemaFiles) {
    let current = null;
    for (const raw of fs.readFileSync(file, "utf8").split("\n")) {
      const line = raw.trim();
      const model = line.match(/^model\s+(\w+)\s*\{/);
      if (model) { current = model[1]; compoundKeys.set(current, compoundKeys.get(current) || new Set()); continue; }
      if (line === "}") { current = null; continue; }
      if (!current) continue;

      const block = line.match(/^@@(unique|id)\s*\((.*)\)\s*$/);
      if (!block) continue;
      const body = block[2];

      // Explicit name wins: @@unique([a, b], name: "ab") is addressed as `ab`.
      const named = body.match(/name\s*:\s*"([^"]+)"/);
      if (named) compoundKeys.get(current).add(named[1]);

      const list = body.match(/\[([^\]]*)\]/);
      if (list) {
        const parts = list[1].split(",").map((s) => s.trim().replace(/\(.*\)$/, "")).filter(Boolean);
        if (parts.length > 1) compoundKeys.get(current).add(parts.join("_"));
      }
    }
  }
}

// ── Model index ────────────────────────────────────────────────────────────
// Delegate name is the model name with a lower-cased first character, which
// is how Prisma exposes it (`db.user`, `db.iPBlocklist`).
const byDelegate = new Map();
for (const m of dmmf.models) {
  const fields = new Map();
  for (const f of m.fields) {
    fields.set(f.name, f.kind === "object" ? f.type : null); // related model or scalar
  }

  byDelegate.set(m.name.charAt(0).toLowerCase() + m.name.slice(1), {
    name: m.name,
    fields,
    compound: compoundKeys.get(m.name) || new Set(),
  });
}
const byModelName = new Map([...byDelegate.values()].map((m) => [m.name, m]));

const PRISMA_METHODS = new Set([
  "findFirst", "findFirstOrThrow", "findUnique", "findUniqueOrThrow", "findMany",
  "create", "createMany", "createManyAndReturn", "update", "updateMany", "upsert",
  "delete", "deleteMany", "count", "aggregate", "groupBy",
]);

// Keys that are Prisma operators rather than model fields.
const LOGICAL = new Set(["AND", "OR", "NOT"]);
const SELECT_EXTRA = new Set(["_count"]);
const ORDER_EXTRA = new Set(["_count", "_relevance", "_avg", "_sum", "_min", "_max"]);
// Nested relation-filter and write operators — the object under them belongs to
// the RELATED model, and we recurse through them.
const RELATION_FILTER = new Set(["some", "every", "none", "is", "isNot"]);
const WRITE_OPS = new Set([
  "create", "createMany", "connect", "connectOrCreate", "update", "updateMany",
  "upsert", "delete", "deleteMany", "set", "disconnect", "push",
  "increment", "decrement", "multiply", "divide",
]);

const problems = [];
let checked = 0;
let skipped = 0;

// ── Helpers ────────────────────────────────────────────────────────────────
function propName(prop) {
  if (ts.isIdentifier(prop.name)) return prop.name.text;
  if (ts.isStringLiteral(prop.name)) return prop.name.text;
  return null; // computed — unreadable
}

/** Object literal we can fully read, or null if it has anything dynamic. */
function readable(node) {
  if (!node || !ts.isObjectLiteralExpression(node)) return null;
  for (const p of node.properties) {
    if (!ts.isPropertyAssignment(p) && !ts.isShorthandPropertyAssignment(p)) return null;
    if (ts.isPropertyAssignment(p) && propName(p) === null) return null;
  }
  return node;
}

function report(file, node, sf, message) {
  const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
  problems.push({ file: path.relative(ROOT, file), line: line + 1, message });
}

// ── Validators ─────────────────────────────────────────────────────────────
function checkSelect(model, node, file, sf, label) {
  const obj = readable(node);
  if (!obj) { skipped++; return; }
  for (const p of obj.properties) {
    if (!ts.isPropertyAssignment(p)) continue;
    const key = propName(p);
    if (SELECT_EXTRA.has(key)) continue;
    const related = model.fields.get(key);
    if (!model.fields.has(key)) {
      report(file, p, sf, `${label}: \`${key}\` is not a field on model ${model.name}`);
      continue;
    }
    checked++;
    // Nested select/include on a relation belongs to the related model.
    if (related && ts.isObjectLiteralExpression(p.initializer)) {
      const child = byModelName.get(related);
      if (!child) continue;
      for (const q of p.initializer.properties) {
        if (!ts.isPropertyAssignment(q)) continue;
        const k = propName(q);
        if (k === "select" || k === "include") checkSelect(child, q.initializer, file, sf, k);
        else if (k === "where") checkWhere(child, q.initializer, file, sf, "where");
        else if (k === "orderBy") checkOrderBy(child, q.initializer, file, sf);
      }
    }
  }
}

function checkWhere(model, node, file, sf, label) {
  const obj = readable(node);
  if (!obj) { skipped++; return; }
  for (const p of obj.properties) {
    if (!ts.isPropertyAssignment(p)) continue;
    const key = propName(p);
    if (LOGICAL.has(key)) {
      // AND/OR/NOT take the same model, as an object or an array of them.
      const inner = p.initializer;
      if (ts.isArrayLiteralExpression(inner)) {
        for (const el of inner.elements) checkWhere(model, el, file, sf, label);
      } else {
        checkWhere(model, inner, file, sf, label);
      }
      continue;
    }
    if (model.compound.has(key)) { checked++; continue; } // compound unique/id selector
    if (!model.fields.has(key)) {
      report(file, p, sf, `${label}: \`${key}\` is not a field on model ${model.name}`);
      continue;
    }
    checked++;
    const related = model.fields.get(key);
    if (related && ts.isObjectLiteralExpression(p.initializer)) {
      const child = byModelName.get(related);
      if (!child) continue;
      for (const q of p.initializer.properties) {
        if (!ts.isPropertyAssignment(q)) continue;
        const k = propName(q);
        if (RELATION_FILTER.has(k)) checkWhere(child, q.initializer, file, sf, `${label}.${key}.${k}`);
      }
    }
  }
}

function checkOrderBy(model, node, file, sf) {
  if (node && ts.isArrayLiteralExpression(node)) {
    for (const el of node.elements) checkOrderBy(model, el, file, sf);
    return;
  }
  const obj = readable(node);
  if (!obj) { skipped++; return; }
  for (const p of obj.properties) {
    if (!ts.isPropertyAssignment(p)) continue;
    const key = propName(p);
    if (ORDER_EXTRA.has(key)) continue;
    if (!model.fields.has(key)) {
      report(file, p, sf, `orderBy: \`${key}\` is not a field on model ${model.name}`);
      continue;
    }
    checked++;
  }
}

function checkData(model, node, file, sf) {
  if (node && ts.isArrayLiteralExpression(node)) {
    for (const el of node.elements) checkData(model, el, file, sf);
    return;
  }
  const obj = readable(node);
  if (!obj) { skipped++; return; }
  for (const p of obj.properties) {
    if (!ts.isPropertyAssignment(p)) continue;
    const key = propName(p);
    if (!model.fields.has(key)) {
      report(file, p, sf, `data: \`${key}\` is not a field on model ${model.name}`);
      continue;
    }
    checked++;
    const related = model.fields.get(key);
    if (related && ts.isObjectLiteralExpression(p.initializer)) {
      const child = byModelName.get(related);
      if (!child) continue;
      for (const q of p.initializer.properties) {
        if (!ts.isPropertyAssignment(q)) continue;
        const k = propName(q);
        // Only recurse into the write ops whose payload is the related model.
        if (k === "create" || k === "update" || k === "createMany") {
          checkData(child, q.initializer, file, sf);
        } else if (!WRITE_OPS.has(k)) {
          // Unknown key under a relation — too ambiguous to judge. Skip.
          skipped++;
        }
      }
    }
  }
}

function checkArgs(model, argNode, file, sf) {
  const obj = readable(argNode);
  if (!obj) { skipped++; return; }
  for (const p of obj.properties) {
    if (!ts.isPropertyAssignment(p)) continue;
    const key = propName(p);
    switch (key) {
      case "select":
      case "include":
        checkSelect(model, p.initializer, file, sf, key);
        break;
      case "where":
        checkWhere(model, p.initializer, file, sf, "where");
        break;
      case "orderBy":
        checkOrderBy(model, p.initializer, file, sf);
        break;
      case "data":
      case "create":
      case "update":
        checkData(model, p.initializer, file, sf);
        break;
      default:
        break; // take/skip/cursor/distinct/by/_count/... nothing to verify
    }
  }
}

// ── Walk ───────────────────────────────────────────────────────────────────
function walkFile(file) {
  const text = fs.readFileSync(file, "utf8");
  if (!/\b(db|tx|prisma)\s*\./.test(text)) return;
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  (function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isPropertyAccessExpression(node.expression.expression)
    ) {
      const method = node.expression.name.text;
      const delegate = node.expression.expression.name.text;
      const model = byDelegate.get(delegate);
      if (PRISMA_METHODS.has(method) && model && node.arguments.length > 0) {
        checkArgs(model, node.arguments[0], file, sf);
      }
    }
    ts.forEachChild(node, visit);
  })(sf);
}

function allFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...allFiles(p));
    else if (/\.tsx?$/.test(e.name) && !e.name.endsWith(".d.ts")) out.push(p);
  }
  return out;
}

const files = allFiles(SRC);
for (const f of files) {
  try {
    walkFile(f);
  } catch (err) {
    if (VERBOSE) console.error(`  (could not parse ${path.relative(ROOT, f)}: ${err.message})`);
  }
}

// ── Baseline ───────────────────────────────────────────────────────────────
// The codebase already had 42 of these when the check was written, spread
// across the fulfillment push routes, the GDPR data export and a few admin
// queries. Every one is a real runtime failure worth fixing, but blocking all
// deploys until they are would be its own outage.
//
// So the gate is on REGRESSION: findings recorded in the baseline are
// reported as known debt and do not fail the build; anything new does. Fix
// one, drop it from the baseline, and it can never come back.
//
// Line numbers are deliberately excluded from the key — editing a file above
// a known issue must not look like a new one.
const BASELINE_PATH = path.join(__dirname, "prisma-query-baseline.json");
const keyOf = (p) => `${p.file} :: ${p.message}`;

let baseline = new Set();
if (fs.existsSync(BASELINE_PATH)) {
  try {
    baseline = new Set(JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8")).known || []);
  } catch {
    console.error(`Could not read ${path.relative(ROOT, BASELINE_PATH)} — treating every finding as new.`);
  }
}

if (process.argv.includes("--update-baseline")) {
  const known = [...new Set(problems.map(keyOf))].sort();
  fs.writeFileSync(
    BASELINE_PATH,
    JSON.stringify(
      {
        note:
          "Known-invalid Prisma field references, recorded so the deploy gate fails on NEW ones only. " +
          "Fix an entry and delete its line — it can never regress after that. Regenerate with " +
          "`node scripts/validate-prisma-queries.cjs --update-baseline`.",
        known,
      },
      null,
      2
    ) + "\n"
  );
  console.log(`Baseline written: ${known.length} known issue(s).`);
  process.exit(0);
}

const fresh = problems.filter((p) => !baseline.has(keyOf(p)));
const known = problems.length - fresh.length;

if (fresh.length === 0) {
  console.log(
    `Prisma queries OK — ${checked} field reference(s) verified across ${files.length} file(s)` +
      (skipped ? `, ${skipped} dynamic object(s) skipped` : "") +
      (known ? `, ${known} known issue(s) carried in the baseline` : "")
  );
  // Surface the debt without failing, so it doesn't quietly become permanent.
  if (known && VERBOSE) {
    console.log("\nKnown (baselined) issues:");
    for (const p of problems) console.log(`  ${p.file}:${p.line}  ${p.message}`);
  }
  process.exit(0);
}

console.error("NEW INVALID PRISMA FIELDS:\n");
for (const p of fresh) console.error(`  ${p.file}:${p.line}  ${p.message}`);
console.error(
  `\n${fresh.length} new invalid field reference(s)` +
    (known ? ` (plus ${known} already in the baseline)` : "") +
    `.\nThese compile fine but throw PrismaClientValidationError on every request at runtime.\n` +
    `Fix them, or if a finding is wrong, run with --update-baseline and say why in the commit.`
);
process.exit(1);
