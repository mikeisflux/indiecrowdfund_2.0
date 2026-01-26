import { NextResponse } from "next/server";
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
        console.error(`Error importing "${row.name}":`, err);
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
    console.error("Import failed:", error);
    return NextResponse.json(
      { error: "Import failed", details: String(error) },
      { status: 500 }
    );
  }
}
