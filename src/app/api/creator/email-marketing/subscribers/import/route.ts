import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const creatorEmailMarketingSubscribersImportLogger = logger.child({ module: "creator-email-marketing-subscribers-import" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

interface CSVRow {
  name?: string;
  email?: string;
}

function parseCSV(content: string): CSVRow[] {
  const lines = content.trim().split("\n");
  if (lines.length < 2) return [];

  // Parse header
  const header = lines[0].toLowerCase().split(",").map((h) => h.trim().replace(/"/g, ""));
  const emailIndex = header.findIndex((h) => h === "email" || h === "e-mail" || h === "email address");
  const nameIndex = header.findIndex((h) => h === "name" || h === "full name" || h === "first name");

  if (emailIndex === -1) return [];

  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Simple CSV parsing (handles basic quoted fields)
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

    const email = values[emailIndex]?.replace(/"/g, "").trim().toLowerCase();
    const name = nameIndex >= 0 ? values[nameIndex]?.replace(/"/g, "").trim() : undefined;

    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      rows.push({ email, name });
    }
  }

  return rows;
}

// POST - Import subscribers from CSV
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get creator's name for tagging
    const creator = await db.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, vanityUrl: true },
    });

    const creatorTag = creator?.vanityUrl || creator?.name || session.user.id;

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const content = await file.text();
    const rows = parseCSV(content);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No valid email addresses found in CSV" },
        { status: 400 }
      );
    }

    // Pre-fetch blocklist to avoid N+1 queries during import
    const blockedEmails = new Set(
      (await db.emailBlocklist.findMany({
        where: { type: "EMAIL", isActive: true },
        select: { value: true },
      })).map((b: { value: string }) => b.value)
    );

    let imported = 0;
    let skippedBlocked = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        if (!row.email) {
          failed++;
          continue;
        }

        // Skip blocked emails (bounced, spam reported, etc.)
        if (blockedEmails.has(row.email)) {
          skippedBlocked++;
          continue;
        }

        // Check if subscriber already exists
        const existing = await db.newsletterSubscriber.findUnique({
          where: { email: row.email },
        });

        if (existing) {
          // Email exists - add this creator's tag if not already present
          const existingTags = existing.tags || [];
          if (!existingTags.includes(creatorTag)) {
            await db.newsletterSubscriber.update({
              where: { email: row.email },
              data: {
                tags: [...existingTags, creatorTag],
              },
            });
          }
          // Skip counting as new import but tag was added
          continue;
        }

        // Create new subscriber with creator tag
        await db.newsletterSubscriber.create({
          data: {
            email: row.email,
            name: row.name || null,
            source: "creator_import",
            tags: [creatorTag], // Tag with the creator account who uploaded
            isActive: true,
          },
        });

        imported++;
      } catch (err) {
        failed++;
        if (errors.length < 5) {
          errors.push(`Failed to import ${row.email}: ${String(err)}`);
        }
      }
    }

    return NextResponse.json({
      imported,
      failed,
      skippedBlocked,
      total: rows.length,
      errors,
    });
  } catch (error) {
    creatorEmailMarketingSubscribersImportLogger.error({ err: String(error) }, "Error importing subscribers:");
    return NextResponse.json(
      { error: "Failed to import subscribers" },
      { status: 500 }
    );
  }
}
