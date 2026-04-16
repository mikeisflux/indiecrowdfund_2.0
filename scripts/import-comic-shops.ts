/**
 * Script to import comic shops from CSV into the database
 * Run with: npx tsx scripts/import-comic-shops.ts
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Prisma 7 requires a driver adapter. Match src/lib/db/index.ts.
const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  }),
});

interface ShopRow {
  name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  region: string;
  phone: string;
  email: string;
  website: string;
  status: string;
}

function generateSlug(name: string, city: string, state: string): string {
  const base = `${name}-${city}-${state}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  return base;
}

function parseCSV(content: string): ShopRow[] {
  const lines = content.trim().split("\n");
  const headers = lines[0].split(",");

  const rows: ShopRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    if (values.length === headers.length) {
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header.trim()] = values[index] || "";
      });
      rows.push(row as unknown as ShopRow);
    }
  }

  return rows;
}

async function importShops() {
  console.log("Starting comic shop import...\n");

  const csvPath = path.join(__dirname, "../future-upgrades/completed.csv");

  if (!fs.existsSync(csvPath)) {
    console.error("CSV file not found at:", csvPath);
    process.exit(1);
  }

  const content = fs.readFileSync(csvPath, "utf-8");
  const rows = parseCSV(content);

  console.log(`Found ${rows.length} shops to import\n`);

  let imported = 0;
  let skipped = 0;
  let errors = 0;
  const slugMap = new Map<string, number>();

  for (const row of rows) {
    try {
      // Generate unique slug
      let baseSlug = generateSlug(row.name, row.city, row.state);
      let slug = baseSlug;
      const count = slugMap.get(baseSlug) || 0;
      if (count > 0) {
        slug = `${baseSlug}-${count}`;
      }
      slugMap.set(baseSlug, count + 1);

      // Check if shop already exists
      const existing = await prisma.comicShop.findUnique({
        where: { slug },
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Format website URL
      let website = row.website?.trim();
      if (website && !website.startsWith("http")) {
        website = `https://${website}`;
      }

      // Create shop
      await prisma.comicShop.create({
        data: {
          name: row.name,
          slug,
          address: row.address || null,
          city: row.city,
          state: row.state || null,
          zipCode: row.zip_code || null,
          country: row.country || "USA",
          region: row.region || null,
          phone: row.phone || null,
          email: row.email || null,
          website: website || null,
        },
      });

      imported++;

      if (imported % 100 === 0) {
        console.log(`Imported ${imported} shops...`);
      }
    } catch (err) {
      errors++;
      console.error(`Error importing "${row.name}":`, err);
    }
  }

  console.log("\n========== Import Complete ==========");
  console.log(`Imported: ${imported}`);
  console.log(`Skipped (already exists): ${skipped}`);
  console.log(`Errors: ${errors}`);
  console.log(`Total processed: ${rows.length}`);
}

importShops()
  .catch((err) => {
    console.error("Import failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
