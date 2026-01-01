/**
 * Changelog Population Script
 *
 * This script is idempotent - run it as many times as you want!
 * It will only add NEW entries that don't already exist.
 *
 * Usage:
 *   npx tsx scripts/populate-changelog.ts           # Normal run
 *   npx tsx scripts/populate-changelog.ts --dry-run # Preview what would be added
 *   npx tsx scripts/populate-changelog.ts --force   # Update existing entries too
 *
 * To add new changelog entries:
 *   1. Add your entry to the CHANGELOG_ENTRIES array below
 *   2. Run the script
 *   3. Only new entries will be added (existing ones are skipped)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Parse CLI arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const FORCE_UPDATE = args.includes("--force");

type ChangelogCategory =
  | "FEATURE"
  | "BUGFIX"
  | "IMPROVEMENT"
  | "SECURITY"
  | "PERFORMANCE"
  | "UI_UX"
  | "API"
  | "DOCUMENTATION"
  | "OTHER";

interface ChangelogEntryData {
  title: string;
  description: string;
  category: ChangelogCategory;
  commitHash?: string;
  branch?: string;
  isPublished: boolean;
  version?: string;
}

/**
 * ============================================================
 * ADD NEW CHANGELOG ENTRIES HERE
 * ============================================================
 *
 * Each entry should have:
 *   - title: Short, descriptive title (used as unique identifier)
 *   - description: Detailed description of the change
 *   - category: One of FEATURE, BUGFIX, IMPROVEMENT, SECURITY, PERFORMANCE, UI_UX, API, DOCUMENTATION, OTHER
 *   - commitHash: (optional) Git commit hash for reference
 *   - branch: (optional) Branch name, defaults to "main"
 *   - isPublished: Whether to show on public changelog
 *   - version: (optional) Version number like "1.0.0"
 *
 * The script checks for duplicates by BOTH title AND commitHash.
 * If either matches, the entry is skipped (unless --force is used).
 */
const CHANGELOG_ENTRIES: ChangelogEntryData[] = [
  // ==========================================================
  // 🆕 ADD NEW ENTRIES AT THE TOP (most recent first)
  // ==========================================================

  {
    title: "Changelog Feature with Admin Management",
    description: "Added changelog system with public blog-style page at /changelog and admin management at /admin/changelog. Includes categories, version tracking, and commit hash references.",
    category: "FEATURE",
    commitHash: "9017218",
    isPublished: true,
  },

  // ==========================================================
  // DIGITAL MARKETPLACE (Recent Major Feature)
  // ==========================================================

  {
    title: "Digital Marketplace for E-books and Digital Content",
    description: "Launched comprehensive digital marketplace allowing creators to sell e-books, PDFs, and digital content. Includes book reader with page-flip animation, staff picks, featured categories, and DivinityCoin payment support.",
    category: "FEATURE",
    commitHash: "a25b761",
    isPublished: true,
  },
  {
    title: "Marketplace Creator Dashboard",
    description: "Added complete creator dashboard for marketplace sellers including sales analytics, payout management, and book management tools.",
    category: "FEATURE",
    commitHash: "fa9c0b3",
    isPublished: true,
  },
  {
    title: "Stripe Connect Integration for Marketplace",
    description: "Integrated Stripe Connect for seamless marketplace payouts to creators with automatic fee handling.",
    category: "FEATURE",
    commitHash: "700eaea",
    isPublished: true,
  },

  // ==========================================================
  // DIVINITYCOIN INTEGRATION
  // ==========================================================

  {
    title: "DivinityCoin Payment Integration",
    description: "Replaced CCBill with DivinityCoin as primary payment processor. Users can redeem DivinityCoin codes to add credits and use them for backing projects and marketplace purchases.",
    category: "FEATURE",
    commitHash: "0696943",
    isPublished: true,
  },
  {
    title: "DivinityCoin Redemption Entry Points",
    description: "Added prominent redemption entry points in user dropdown and dedicated /redeem page after user feedback that the redemption feature was hard to find.",
    category: "IMPROVEMENT",
    commitHash: "8aea48a",
    isPublished: true,
  },
  {
    title: "DivinityCoin Webhook Support",
    description: "Implemented webhook handlers for DivinityCoin events including balance updates, refunds, and transaction notifications.",
    category: "FEATURE",
    commitHash: "b7614a3",
    isPublished: true,
  },
  {
    title: "DivinityCoin Refund System",
    description: "Added automatic DivinityCoin balance deduction when refunds are processed, with proper transaction tracking.",
    category: "FEATURE",
    commitHash: "726784c",
    isPublished: true,
  },

  // ==========================================================
  // INDIEKIT CREATOR DASHBOARD
  // ==========================================================

  {
    title: "IndieKit Fulfillment Dashboard",
    description: "Comprehensive creator dashboard for managing campaigns including fulfillment tracking, backer management, email campaigns, surveys, and digital file distribution.",
    category: "FEATURE",
    commitHash: "eb20160",
    isPublished: true,
  },
  {
    title: "Survey Builder for Creators",
    description: "Added survey creation tool with per-reward question configuration, allowing creators to collect shipping info and preferences from backers.",
    category: "FEATURE",
    commitHash: "a5e7fe1",
    isPublished: true,
  },
  {
    title: "Email Campaign Manager",
    description: "Full email campaign management with Canva import, subscriber management, CSV import, and campaign analytics.",
    category: "FEATURE",
    commitHash: "c58a7e9",
    isPublished: true,
  },
  {
    title: "Digital File Distribution",
    description: "Creators can upload and distribute digital files to backers based on reward tiers with R2 cloud storage integration.",
    category: "FEATURE",
    commitHash: "c821c88",
    isPublished: true,
  },

  // ==========================================================
  // BACKER DASHBOARD IMPROVEMENTS
  // ==========================================================

  {
    title: "PDF Book Reader with Page Flip Animation",
    description: "Added immersive book reading experience with realistic page-flip animation, bookmarks, zoom controls, and mobile support.",
    category: "FEATURE",
    commitHash: "cf3786b",
    isPublished: true,
  },
  {
    title: "Achievement Badge System",
    description: "Implemented backer achievement badges with bonus DivinityCoin earning rates (0.5% per badge, up to 3% cap).",
    category: "FEATURE",
    commitHash: "9fa7d2c",
    isPublished: true,
  },
  {
    title: "Following Badge on Project Cards",
    description: "Added visual indicator on homepage showing when logged-in users are following a project.",
    category: "IMPROVEMENT",
    commitHash: "e5ff8ad",
    isPublished: true,
  },

  // ==========================================================
  // SECURITY IMPROVEMENTS
  // ==========================================================

  {
    title: "CSRF Protection Implementation",
    description: "Added comprehensive CSRF token protection across all state-changing API endpoints with automatic header injection.",
    category: "SECURITY",
    commitHash: "4172864",
    isPublished: true,
  },
  {
    title: "DivinityCoin Security Hardening",
    description: "Implemented additional security measures to protect DivinityCoin balances and transactions against potential attacks.",
    category: "SECURITY",
    commitHash: "6d2a701",
    isPublished: true,
  },
  {
    title: "Rate Limiting System",
    description: "Added configurable rate limiting for login attempts and global API requests with admin controls.",
    category: "SECURITY",
    commitHash: "11984f3",
    isPublished: true,
  },
  {
    title: "Email Queue Rate Limiting",
    description: "Implemented email queue system with rate limiting to prevent spam and ensure reliable delivery.",
    category: "SECURITY",
    commitHash: "ced4d01",
    isPublished: true,
  },

  // ==========================================================
  // PAYMENT SYSTEM FIXES
  // ==========================================================

  {
    title: "Stripe Payment Processing Fixes",
    description: "Fixed multiple payment processing issues including duplicate pledges, webhook handling, and payment confirmation flows.",
    category: "BUGFIX",
    commitHash: "b175889",
    isPublished: true,
  },
  {
    title: "Duplicate Pledge Prevention",
    description: "Added multiple safety layers to prevent accidental double-charging and duplicate pledge creation.",
    category: "BUGFIX",
    commitHash: "fac14e5",
    isPublished: true,
  },
  {
    title: "Pledge Status Synchronization",
    description: "Fixed PENDING pledges not updating to COMPLETED after successful payment, with automatic sync functionality.",
    category: "BUGFIX",
    commitHash: "c97f57a",
    isPublished: true,
  },
  {
    title: "Stripe Reconciliation Tool",
    description: "Added admin tool to reconcile Stripe transactions with database records and fix discrepancies.",
    category: "FEATURE",
    commitHash: "ad995bd",
    isPublished: true,
  },

  // ==========================================================
  // VANITY URL SYSTEM
  // ==========================================================

  {
    title: "Vanity URL System for Projects",
    description: "Implemented custom vanity URLs allowing creators to have memorable project links like /username/project-name.",
    category: "FEATURE",
    commitHash: "fcac010",
    isPublished: true,
  },
  {
    title: "Legacy URL Compatibility",
    description: "Added backwards compatibility for legacy /projects/[slug] URLs with automatic redirection.",
    category: "IMPROVEMENT",
    commitHash: "64b3a05",
    isPublished: true,
  },

  // ==========================================================
  // PRE-LAUNCH PAGES
  // ==========================================================

  {
    title: "Pre-launch Page System",
    description: "Creators can now create pre-launch pages to build an audience before campaign launch, with follower tracking and email notifications.",
    category: "FEATURE",
    commitHash: "c19e2af",
    isPublished: true,
  },
  {
    title: "Pre-launch Approval Workflow",
    description: "Added admin review process for pre-launch pages with dedicated approval queue.",
    category: "FEATURE",
    commitHash: "6e0e918",
    isPublished: true,
  },

  // ==========================================================
  // UI/UX IMPROVEMENTS
  // ==========================================================

  {
    title: "Dark Mode with Gradient Branding",
    description: "Made dark mode the permanent theme with beautiful gradient branding and modern styling throughout the site.",
    category: "UI_UX",
    commitHash: "745536d",
    isPublished: true,
  },
  {
    title: "Mobile Responsiveness Overhaul",
    description: "Comprehensive mobile optimization across all pages including dashboard, pledge flow, and admin panels.",
    category: "UI_UX",
    commitHash: "f48a318",
    isPublished: true,
  },
  {
    title: "Glass Card Styling and Floating Orbs",
    description: "Applied modern UX enhancements with glass-morphism effects, floating orbs, and subtle animations.",
    category: "UI_UX",
    commitHash: "5065adc",
    isPublished: true,
  },
  {
    title: "Rewards Sidebar UX Improvement",
    description: "Fixed sticky sidebar behavior and improved reward selection flow with better mobile support.",
    category: "UI_UX",
    commitHash: "2404080",
    isPublished: true,
  },

  // ==========================================================
  // EMAIL SYSTEM
  // ==========================================================

  {
    title: "Mailgun Email Provider Support",
    description: "Added Mailgun as an alternative email provider with automatic fallback and queue management.",
    category: "FEATURE",
    commitHash: "c7c8dda",
    isPublished: true,
  },
  {
    title: "Creator Email Handles",
    description: "Creators can send emails to backers from their own email handle (creator@mail.indiecrowdfund.com).",
    category: "FEATURE",
    commitHash: "3e8553e",
    isPublished: true,
  },
  {
    title: "Global Email Unsubscribe",
    description: "Added one-click unsubscribe functionality for all marketing emails with preference management.",
    category: "FEATURE",
    commitHash: "aea83eb",
    isPublished: true,
  },

  // ==========================================================
  // BUG FIXES
  // ==========================================================

  {
    title: "Book Reader Stability Fixes",
    description: "Fixed numerous issues with the PDF book reader including page cropping, infinite reload loops, zoom handling, and mobile rendering.",
    category: "BUGFIX",
    commitHash: "77b6f7d",
    isPublished: true,
  },
  {
    title: "Decimal Serialization Fix",
    description: "Fixed Prisma Decimal serialization issues across 38+ files that were causing TypeErrors in production.",
    category: "BUGFIX",
    commitHash: "d2c9b25",
    isPublished: true,
  },
  {
    title: "Admin Panel Access Fixes",
    description: "Fixed various admin role checks and API authorization issues preventing SUPER_ADMIN access to endpoints.",
    category: "BUGFIX",
    commitHash: "0b9518e",
    isPublished: true,
  },
  {
    title: "Image Upload and WebP Conversion",
    description: "Fixed image upload issues and added automatic WebP conversion for better performance.",
    category: "IMPROVEMENT",
    commitHash: "7357dad",
    isPublished: true,
  },
  {
    title: "Collaborator System Fixes",
    description: "Fixed collaborator invitation, permission checking, and visibility issues in dashboards.",
    category: "BUGFIX",
    commitHash: "bc7864b",
    isPublished: true,
  },
  {
    title: "Comment System Implementation",
    description: "Added full backer comment system with creator reply functionality and email notifications.",
    category: "FEATURE",
    commitHash: "ca82c97",
    isPublished: true,
  },
  {
    title: "Canva Import Improvements",
    description: "Fixed Canva import issues including image handling, HTML preservation, and table styling.",
    category: "BUGFIX",
    commitHash: "80eb963",
    isPublished: true,
  },
  {
    title: "PDF Picker LocalStorage Fix",
    description: "Fixed PDF file picker not restoring state properly and 'Choose Existing' button not working.",
    category: "BUGFIX",
    commitHash: "740c773",
    isPublished: true,
  },
  {
    title: "CSRF Headers for Follow/Unfollow",
    description: "Fixed 403 errors when following/unfollowing projects by adding missing CSRF headers.",
    category: "BUGFIX",
    commitHash: "ab06471",
    isPublished: true,
  },
  {
    title: "Admin Email Double-Submit Prevention",
    description: "Fixed potential double-submit issue in admin email reply form by adding submission guard.",
    category: "BUGFIX",
    commitHash: "586bc0e",
    isPublished: true,
  },

  // ==========================================================
  // PERFORMANCE IMPROVEMENTS
  // ==========================================================

  {
    title: "Image Caching and GPU Rendering",
    description: "Improved book reader performance with image caching and GPU-accelerated rendering.",
    category: "PERFORMANCE",
    commitHash: "947c005",
    isPublished: true,
  },
  {
    title: "API Parallelization",
    description: "Optimized save performance by parallelizing independent API calls.",
    category: "PERFORMANCE",
    commitHash: "ed7e6af",
    isPublished: true,
  },
  {
    title: "Email Queue Optimization",
    description: "Improved email queue with parallel batch processing while maintaining rate limits.",
    category: "PERFORMANCE",
    commitHash: "667c501",
    isPublished: true,
  },

  // ==========================================================
  // ADMIN FEATURES
  // ==========================================================

  {
    title: "AI Marketing System",
    description: "Added AI-powered marketing campaign creation with user interest matching and automated targeting.",
    category: "FEATURE",
    commitHash: "e39e851",
    isPublished: true,
  },
  {
    title: "Retailer Management Portal",
    description: "Comprehensive retailer management including application review, satisfaction surveys, and access control.",
    category: "FEATURE",
    commitHash: "80eb963a",
    isPublished: true,
  },
  {
    title: "Database Backup Management",
    description: "Added database and build backup features with download, restore, and cleanup functionality.",
    category: "FEATURE",
    commitHash: "4ec2d74",
    isPublished: true,
  },
  {
    title: "Media Library with Folder Organization",
    description: "Enhanced media library with folder structure, drag-and-drop upload, and import for existing files.",
    category: "IMPROVEMENT",
    commitHash: "bb02fe5",
    isPublished: true,
  },

  // ==========================================================
  // API IMPROVEMENTS
  // ==========================================================

  {
    title: "Batch Rewards Endpoint",
    description: "Added batch rewards API endpoint to work around nginx rate limiting issues.",
    category: "API",
    commitHash: "ca6bba5",
    isPublished: true,
  },
  {
    title: "API Error Handling Improvements",
    description: "Improved error messages across API routes with proper Zod validation error formatting.",
    category: "API",
    commitHash: "a875c1a",
    isPublished: true,
  },
  {
    title: "Automatic Retry for Network Failures",
    description: "Added automatic retry with exponential backoff for transient network failures in admin pages.",
    category: "IMPROVEMENT",
    commitHash: "e6442a1",
    isPublished: true,
  },

  // ==========================================================
  // DOCUMENTATION
  // ==========================================================

  {
    title: "Backer Handbook",
    description: "Added comprehensive backer handbook with complete guide to backing projects, payments, and pledge management.",
    category: "DOCUMENTATION",
    commitHash: "70d6f98",
    isPublished: true,
  },
  {
    title: "DivinityCoin Explainer Page",
    description: "Created 'What is DivinityCoin?' informational page explaining the payment system.",
    category: "DOCUMENTATION",
    commitHash: "aa01af5",
    isPublished: true,
  },
  {
    title: "Security Documentation",
    description: "Added SECURITY.md documenting all security implementations and best practices.",
    category: "DOCUMENTATION",
    commitHash: "d58d302",
    isPublished: true,
  },
];

// ==========================================================
// SCRIPT LOGIC (no need to modify below)
// ==========================================================

interface ExistingEntry {
  id: string;
  title: string;
  commitHash: string | null;
}

async function checkForDuplicate(
  entry: ChangelogEntryData,
  existingEntries: ExistingEntry[]
): Promise<{ isDuplicate: boolean; matchedBy: string | null; existingId: string | null }> {
  // Check by title (exact match)
  const titleMatch = existingEntries.find(
    (e) => e.title.toLowerCase() === entry.title.toLowerCase()
  );
  if (titleMatch) {
    return { isDuplicate: true, matchedBy: "title", existingId: titleMatch.id };
  }

  // Check by commit hash (if provided)
  if (entry.commitHash) {
    const commitMatch = existingEntries.find(
      (e) => e.commitHash && e.commitHash.startsWith(entry.commitHash!)
    );
    if (commitMatch) {
      return { isDuplicate: true, matchedBy: "commitHash", existingId: commitMatch.id };
    }
  }

  return { isDuplicate: false, matchedBy: null, existingId: null };
}

async function populateChangelog() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║           CHANGELOG POPULATION SCRIPT                      ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  if (DRY_RUN) {
    console.log("🔍 DRY RUN MODE - No changes will be made\n");
  }
  if (FORCE_UPDATE) {
    console.log("⚠️  FORCE MODE - Existing entries will be updated\n");
  }

  // Fetch all existing entries once
  console.log("📥 Fetching existing changelog entries...");
  const existingEntries = await prisma.changelogEntry.findMany({
    select: {
      id: true,
      title: true,
      commitHash: true,
    },
  });
  console.log(`   Found ${existingEntries.length} existing entries\n`);

  let created = 0;
  let skipped = 0;
  let updated = 0;
  let errors = 0;

  const toCreate: ChangelogEntryData[] = [];
  const toSkip: { entry: ChangelogEntryData; reason: string }[] = [];
  const toUpdate: { entry: ChangelogEntryData; existingId: string }[] = [];

  // First pass: categorize entries
  for (const entry of CHANGELOG_ENTRIES) {
    const { isDuplicate, matchedBy, existingId } = await checkForDuplicate(
      entry,
      existingEntries
    );

    if (isDuplicate) {
      if (FORCE_UPDATE && existingId) {
        toUpdate.push({ entry, existingId });
      } else {
        toSkip.push({ entry, reason: `matched by ${matchedBy}` });
      }
    } else {
      toCreate.push(entry);
    }
  }

  // Report what will happen
  console.log("📊 Analysis Complete:");
  console.log(`   • ${toCreate.length} new entries to create`);
  console.log(`   • ${toSkip.length} entries to skip (already exist)`);
  if (FORCE_UPDATE) {
    console.log(`   • ${toUpdate.length} entries to update`);
  }
  console.log("");

  if (DRY_RUN) {
    // Just show what would happen
    if (toCreate.length > 0) {
      console.log("📝 Would CREATE:");
      for (const entry of toCreate) {
        console.log(`   ✚ ${entry.title}`);
      }
      console.log("");
    }

    if (toSkip.length > 0) {
      console.log("⏭️  Would SKIP:");
      for (const { entry, reason } of toSkip) {
        console.log(`   • ${entry.title} (${reason})`);
      }
      console.log("");
    }

    if (FORCE_UPDATE && toUpdate.length > 0) {
      console.log("🔄 Would UPDATE:");
      for (const { entry } of toUpdate) {
        console.log(`   ↻ ${entry.title}`);
      }
      console.log("");
    }
  } else {
    // Actually make changes

    // Create new entries
    if (toCreate.length > 0) {
      console.log("📝 Creating new entries...");
      for (const entry of toCreate) {
        try {
          await prisma.changelogEntry.create({
            data: {
              title: entry.title,
              description: entry.description,
              category: entry.category,
              version: entry.version || null,
              commitHash: entry.commitHash || null,
              branch: entry.branch || "main",
              isPublished: entry.isPublished,
              publishedAt: entry.isPublished ? new Date() : null,
            },
          });
          console.log(`   ✅ ${entry.title}`);
          created++;
        } catch (error) {
          console.error(`   ❌ Failed: ${entry.title}`, error);
          errors++;
        }
      }
      console.log("");
    }

    // Update existing entries (if --force)
    if (FORCE_UPDATE && toUpdate.length > 0) {
      console.log("🔄 Updating existing entries...");
      for (const { entry, existingId } of toUpdate) {
        try {
          await prisma.changelogEntry.update({
            where: { id: existingId },
            data: {
              title: entry.title,
              description: entry.description,
              category: entry.category,
              version: entry.version || null,
              commitHash: entry.commitHash || null,
              branch: entry.branch || "main",
              isPublished: entry.isPublished,
              publishedAt: entry.isPublished ? new Date() : null,
            },
          });
          console.log(`   ↻ ${entry.title}`);
          updated++;
        } catch (error) {
          console.error(`   ❌ Failed to update: ${entry.title}`, error);
          errors++;
        }
      }
      console.log("");
    }

    // Log skipped entries
    if (toSkip.length > 0) {
      console.log("⏭️  Skipped (already exist):");
      for (const { entry, reason } of toSkip) {
        console.log(`   • ${entry.title} (${reason})`);
      }
      console.log("");
    }

    skipped = toSkip.length;
  }

  // Summary
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║                       SUMMARY                              ║");
  console.log("╠════════════════════════════════════════════════════════════╣");
  if (DRY_RUN) {
    console.log(`║  Would create: ${toCreate.length.toString().padEnd(3)} | Would skip: ${toSkip.length.toString().padEnd(3)} | Would update: ${toUpdate.length.toString().padEnd(3)}  ║`);
    console.log("║                                                            ║");
    console.log("║  Run without --dry-run to apply changes                    ║");
  } else {
    console.log(`║  Created: ${created.toString().padEnd(3)} | Skipped: ${skipped.toString().padEnd(3)} | Updated: ${updated.toString().padEnd(3)} | Errors: ${errors.toString().padEnd(3)}  ║`);
  }
  console.log("╚════════════════════════════════════════════════════════════╝");
}

populateChangelog()
  .then(() => {
    console.log("\n✨ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Fatal error:", error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
