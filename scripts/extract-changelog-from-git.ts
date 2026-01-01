/**
 * Extract Changelog Entries from Git History
 *
 * This script scans ALL commits from ALL branches and automatically
 * categorizes them for the changelog based on commit message patterns.
 *
 * Usage:
 *   npx tsx scripts/extract-changelog-from-git.ts           # Normal run
 *   npx tsx scripts/extract-changelog-from-git.ts --dry-run # Preview only
 *   npx tsx scripts/extract-changelog-from-git.ts --force   # Update existing
 */

import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const FORCE_UPDATE = args.includes("--force");

/**
 * Forbidden words that should never appear in public changelog
 */
const FORBIDDEN_WORDS = [
  "kickstarter",
  "backerkit",
  "indiegogo",
  "patreon",
  "gofundme",
  "clone",
  "competitor",
  "copy",
  "ripoff",
  "rip-off",
];

/**
 * Commit message patterns to SKIP (not meaningful for changelog)
 */
const SKIP_PATTERNS = [
  /^merge/i,
  /^wip/i,
  /^temp/i,
  /^test commit/i,
  /^initial commit/i,
  /^revert.*revert/i,
  /^bump version/i,
  /^update package/i,
  /^chore:/i,
  /^docs:/i,
  /^\[skip/i,
  /^formatting/i,
  /^lint/i,
  /^typo/i,
  /^whitespace/i,
  /^cleanup/i,
  /^remove console/i,
  /^add console/i,
  /^debug/i,
  /^logging/i,
  /^minor/i,
  /^small/i,
  /^tweak/i,
  /^adjust/i,
  /^update.*readme/i,
  /^update.*changelog/i,
  /^update.*plan/i,
  /^mark.*complete/i,
  /^integration plan/i,
];

type Category = "FEATURE" | "BUGFIX" | "IMPROVEMENT" | "SECURITY" | "PERFORMANCE" | "UI_UX" | "API" | "DOCUMENTATION" | "OTHER";

interface GitCommit {
  hash: string;
  message: string;
  date: Date;
  branch: string;
}

interface ChangelogEntry {
  title: string;
  description: string;
  category: Category;
  commitHash: string;
  publishedAt: Date;
}

/**
 * Categorize commit based on message
 */
function categorizeCommit(message: string): Category {
  const lower = message.toLowerCase();

  // Security
  if (lower.includes("security") || lower.includes("csrf") || lower.includes("auth") || lower.includes("rate limit") || lower.includes("xss") || lower.includes("injection")) {
    return "SECURITY";
  }

  // Performance
  if (lower.includes("performance") || lower.includes("optimize") || lower.includes("cache") || lower.includes("speed") || lower.includes("faster") || lower.includes("gpu")) {
    return "PERFORMANCE";
  }

  // Bug fixes
  if (lower.startsWith("fix") || lower.includes("bug") || lower.includes("patch") || lower.includes("resolve") || lower.includes("correct")) {
    return "BUGFIX";
  }

  // Features
  if (lower.startsWith("add") || lower.startsWith("implement") || lower.startsWith("create") || lower.includes("new feature") || lower.includes("introduce")) {
    return "FEATURE";
  }

  // UI/UX
  if (lower.includes("ui") || lower.includes("ux") || lower.includes("style") || lower.includes("design") || lower.includes("responsive") || lower.includes("mobile") || lower.includes("dark mode") || lower.includes("light mode")) {
    return "UI_UX";
  }

  // API
  if (lower.includes("api") || lower.includes("endpoint") || lower.includes("route") || lower.includes("webhook")) {
    return "API";
  }

  // Documentation
  if (lower.includes("doc") || lower.includes("readme") || lower.includes("handbook") || lower.includes("guide")) {
    return "DOCUMENTATION";
  }

  // Improvements
  if (lower.includes("improve") || lower.includes("enhance") || lower.includes("update") || lower.includes("upgrade") || lower.includes("refactor") || lower.includes("better")) {
    return "IMPROVEMENT";
  }

  return "OTHER";
}

/**
 * Check if commit should be skipped
 */
function shouldSkip(message: string): boolean {
  for (const pattern of SKIP_PATTERNS) {
    if (pattern.test(message)) {
      return true;
    }
  }
  return false;
}

/**
 * Check for forbidden words
 */
function containsForbidden(text: string): string | null {
  const lower = text.toLowerCase();
  for (const word of FORBIDDEN_WORDS) {
    if (lower.includes(word)) {
      return word;
    }
  }
  return null;
}

/**
 * Clean up commit message for display
 */
function cleanMessage(message: string): string {
  // Remove common prefixes
  let cleaned = message
    .replace(/^(fix|add|implement|update|improve|enhance|create):\s*/i, "")
    .replace(/^(feat|feature):\s*/i, "")
    .replace(/^(bug|bugfix):\s*/i, "")
    .trim();

  // Capitalize first letter
  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

  return cleaned;
}

/**
 * Get all commits from all branches
 */
function getAllCommits(): GitCommit[] {
  console.log("📥 Extracting commits from all branches...");

  const output = execSync(
    'git log --all --format="%H|%s|%aI|%D" --date-order',
    { encoding: "utf-8", maxBuffer: 50 * 1024 * 1024 }
  );

  const commits: GitCommit[] = [];
  const lines = output.trim().split("\n");

  for (const line of lines) {
    const [hash, message, dateStr, refs] = line.split("|");
    if (!hash || !message) continue;

    // Extract branch from refs if available
    let branch = "main";
    if (refs) {
      const branchMatch = refs.match(/origin\/([^,\s]+)/);
      if (branchMatch) {
        branch = branchMatch[1];
      }
    }

    commits.push({
      hash: hash.substring(0, 7),
      message: message.trim(),
      date: new Date(dateStr),
      branch,
    });
  }

  console.log(`   Found ${commits.length} total commits\n`);
  return commits;
}

/**
 * Process commits into changelog entries
 */
function processCommits(commits: GitCommit[]): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  const seenMessages = new Set<string>();

  for (const commit of commits) {
    // Skip if message pattern matches skip list
    if (shouldSkip(commit.message)) {
      continue;
    }

    // Skip duplicates (same message from different branches)
    const normalizedMsg = commit.message.toLowerCase().trim();
    if (seenMessages.has(normalizedMsg)) {
      continue;
    }
    seenMessages.add(normalizedMsg);

    // Check for forbidden words
    const forbidden = containsForbidden(commit.message);
    if (forbidden) {
      console.log(`   🚫 Skipping (forbidden: "${forbidden}"): ${commit.message.substring(0, 50)}...`);
      continue;
    }

    // Categorize
    const category = categorizeCommit(commit.message);

    // Skip "OTHER" category - not meaningful enough
    if (category === "OTHER") {
      continue;
    }

    entries.push({
      title: cleanMessage(commit.message),
      description: commit.message, // Use full message as description
      category,
      commitHash: commit.hash,
      publishedAt: commit.date,
    });
  }

  return entries;
}

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║     EXTRACT CHANGELOG FROM GIT HISTORY                     ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  if (DRY_RUN) {
    console.log("🔍 DRY RUN MODE - No changes will be made\n");
  }

  // Get all commits
  const commits = getAllCommits();

  // Process into entries
  console.log("🔄 Processing commits...");
  const entries = processCommits(commits);
  console.log(`   Extracted ${entries.length} meaningful entries\n`);

  // Get existing entries from database
  console.log("📊 Checking existing entries...");
  const existing = await prisma.changelogEntry.findMany({
    select: { id: true, title: true, commitHash: true },
  });
  console.log(`   Found ${existing.length} existing entries\n`);

  // Find new entries (not already in database)
  const existingHashes = new Set(existing.map((e) => e.commitHash).filter(Boolean));
  const existingTitles = new Set(existing.map((e) => e.title.toLowerCase()));

  const newEntries = entries.filter((e) => {
    if (existingHashes.has(e.commitHash)) return false;
    if (existingTitles.has(e.title.toLowerCase())) return false;
    return true;
  });

  const toUpdate = FORCE_UPDATE
    ? entries.filter((e) => existingHashes.has(e.commitHash))
    : [];

  console.log("📈 Summary:");
  console.log(`   • ${newEntries.length} new entries to create`);
  console.log(`   • ${entries.length - newEntries.length} entries already exist`);
  if (FORCE_UPDATE) {
    console.log(`   • ${toUpdate.length} entries to update`);
  }
  console.log("");

  // Category breakdown
  const byCat: Record<string, number> = {};
  for (const e of newEntries) {
    byCat[e.category] = (byCat[e.category] || 0) + 1;
  }
  console.log("📊 New entries by category:");
  for (const [cat, count] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) {
    console.log(`   • ${cat}: ${count}`);
  }
  console.log("");

  if (DRY_RUN) {
    console.log("📝 Would CREATE (first 50):");
    for (const entry of newEntries.slice(0, 50)) {
      console.log(`   ✚ [${entry.category}] ${entry.title.substring(0, 60)}...`);
    }
    if (newEntries.length > 50) {
      console.log(`   ... and ${newEntries.length - 50} more`);
    }
  } else {
    // Create new entries
    let created = 0;
    let errors = 0;

    console.log("📝 Creating entries...");
    for (const entry of newEntries) {
      try {
        await prisma.changelogEntry.create({
          data: {
            title: entry.title,
            description: entry.description,
            category: entry.category,
            commitHash: entry.commitHash,
            branch: "main",
            isPublished: true,
            publishedAt: entry.publishedAt,
          },
        });
        created++;
        if (created % 50 === 0) {
          console.log(`   ... ${created} created`);
        }
      } catch (error) {
        errors++;
      }
    }

    // Update existing if --force
    let updated = 0;
    if (FORCE_UPDATE && toUpdate.length > 0) {
      console.log("\n🔄 Updating existing entries...");
      for (const entry of toUpdate) {
        const existingEntry = existing.find((e) => e.commitHash === entry.commitHash);
        if (existingEntry) {
          try {
            await prisma.changelogEntry.update({
              where: { id: existingEntry.id },
              data: {
                publishedAt: entry.publishedAt,
              },
            });
            updated++;
          } catch {
            errors++;
          }
        }
      }
    }

    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║                       COMPLETE                             ║");
    console.log("╠════════════════════════════════════════════════════════════╣");
    console.log(`║  Created: ${created.toString().padEnd(4)} | Updated: ${updated.toString().padEnd(4)} | Errors: ${errors.toString().padEnd(4)}       ║`);
    console.log("╚════════════════════════════════════════════════════════════╝");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
