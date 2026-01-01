#!/bin/bash
# Script to populate changelog entries via the API
# This uses curl to hit the admin changelog API

BASE_URL="http://localhost:3000"

echo "Note: This script requires admin authentication. Run it via the admin interface or modify to include auth."
echo "For now, adding entries directly to the database..."

# Use the app's database directly with a simple Node.js script
node -e '
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const entries = [
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
  // ... more entries would go here
];

async function run() {
  for (const e of entries) {
    const existing = await prisma.changelogEntry.findFirst({ where: { title: e.title } });
    if (!existing) {
      await prisma.changelogEntry.create({
        data: {
          ...e,
          publishedAt: e.isPublished ? new Date() : null,
          branch: "main",
        },
      });
      console.log("Created:", e.title);
    }
  }
  await prisma.$disconnect();
}

run().catch(console.error);
'
