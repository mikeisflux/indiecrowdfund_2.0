/**
 * Script to populate changelog entries from git history
 * Run with: npx ts-node scripts/populate-changelog.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface ChangelogEntryData {
  title: string;
  description: string;
  category: string;
  commitHash?: string;
  branch?: string;
  isPublished: boolean;
}

const changelogEntries: ChangelogEntryData[] = [
  // Digital Marketplace Integration (Most Recent Major Feature)
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

  // DivinityCoin Integration
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

  // IndieKit Creator Dashboard
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

  // Backer Dashboard Improvements
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

  // Security Improvements
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

  // Payment System Fixes
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

  // Vanity URL System
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

  // Pre-launch Pages
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

  // UI/UX Improvements
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

  // Email System
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

  // Bug Fixes (Grouped by Area)
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

  // Performance Improvements
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

  // Admin Features
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
    commitHash: "80eb963",
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

  // API Improvements
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

  // Documentation
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

async function populateChangelog() {
  console.log("Starting changelog population...\n");

  let created = 0;
  let skipped = 0;

  for (const entry of changelogEntries) {
    // Check if entry with same title already exists
    const existing = await prisma.changelogEntry.findFirst({
      where: { title: entry.title },
    });

    if (existing) {
      console.log(`⏭️  Skipped (exists): ${entry.title}`);
      skipped++;
      continue;
    }

    try {
      await prisma.changelogEntry.create({
        data: {
          title: entry.title,
          description: entry.description,
          category: entry.category as "FEATURE" | "BUGFIX" | "IMPROVEMENT" | "SECURITY" | "PERFORMANCE" | "UI_UX" | "API" | "DOCUMENTATION" | "OTHER",
          commitHash: entry.commitHash || null,
          branch: entry.branch || "main",
          isPublished: entry.isPublished,
          publishedAt: entry.isPublished ? new Date() : null,
        },
      });
      console.log(`✅ Created: ${entry.title}`);
      created++;
    } catch (error) {
      console.error(`❌ Failed to create: ${entry.title}`, error);
    }
  }

  console.log(`\n📊 Summary: ${created} created, ${skipped} skipped`);
}

populateChangelog()
  .then(() => {
    console.log("\nChangelog population complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
