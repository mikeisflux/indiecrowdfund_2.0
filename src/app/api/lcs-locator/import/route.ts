import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const lcsLocatorImportLogger = logger.child({ module: "lcs-locator-import" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as fs from "fs";
import * as path from "path";

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

export async function POST() {
  try {
    // Require SUPER_ADMIN authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((session.user as { role?: string }).role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const csvPath = path.join(process.cwd(), "future-upgrades/completed.csv");

    if (!fs.existsSync(csvPath)) {
      return NextResponse.json(
        { error: "CSV file not found", path: csvPath },
        { status: 404 }
      );
    }

    const content = fs.readFileSync(csvPath, "utf-8");
    const rows = parseCSV(content);

    let imported = 0;
    let skipped = 0;
    let errors = 0;
    const slugMap = new Map<string, number>();

    for (const row of rows) {
      try {
        // Skip rows missing required name field
        if (!row.name?.trim()) {
          skipped++;
          continue;
        }

        // Generate unique slug
        const baseSlug = generateSlug(row.name, row.city, row.state);
        let slug = baseSlug;
        const count = slugMap.get(baseSlug) || 0;
        if (count > 0) {
          slug = `${baseSlug}-${count}`;
        }
        slugMap.set(baseSlug, count + 1);

        // Check if shop already exists
        const existing = await db.comicShop.findUnique({
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
        await db.comicShop.create({
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
      } catch (err) {
        errors++;
        lcsLocatorImportLogger.error({ err: String(err) }, `Error importing "${row.name}":`);
      }
    }

    return NextResponse.json({
      success: true,
      totalRows: rows.length,
      imported,
      skipped,
      errors,
    });
  } catch (error) {
    lcsLocatorImportLogger.error({ err: String(error) }, "Import failed:");
    return NextResponse.json(
      { error: "Import failed", details: String(error) },
      { status: 500 }
    );
  }
}
