import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
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

    // Get creator's name for tagging + confirm their sending address is
    // set up. Importing a list you can't email is a dead end — campaign
    // sends are already gated on creatorEmailHandle, so gate the import
    // up front too.
    const creator = await db.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
      select: { name: true, vanityUrl: true, creatorEmailHandle: true },
    });

    if (!creator?.creatorEmailHandle) {
      return NextResponse.json(
        {
          error:
            "Set up your sending email address before importing subscribers. Open the Email tab on your dashboard and create your address first.",
        },
        { status: 400 }
      );
    }

    const creatorTag = creator.vanityUrl || creator.name || session.user.id;

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Enforce file size limit (5 MB) to prevent DoS via large uploads
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File size must be 5 MB or less" }, { status: 400 });
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
    let skippedDuplicate = 0;
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

        // Primary write: the creator's own email list. This is the
        // table campaign sends, the Subscribers tab, and the IndieKit
        // dashboard count all read from — writing only to
        // newsletterSubscriber (the old behavior) left imported
        // contacts invisible to every creator-facing surface.
        // create + catch P2002 on @@unique([creatorId, email]) is
        // TOCTOU-safe, matching the manual single-add path.
        try {
          await db.emailListSubscriber.create({
            data: {
              creatorId: session.user.id,
              email: row.email,
              name: row.name || null,
              source: "csv_import",
              status: "subscribed",
            },
          });
          imported++;
        } catch (createErr) {
          const isUniqueViolation =
            createErr &&
            typeof createErr === "object" &&
            "code" in createErr &&
            (createErr as { code?: string }).code === "P2002";
          if (isUniqueViolation) {
            // Already on this creator's list — not new, not a failure.
            skippedDuplicate++;
          } else {
            throw createErr;
          }
        }

        // Secondary, best-effort: mirror into the admin-wide newsletter
        // so global newsletter sends + admin tooling see the contact
        // too. Mirrors the manual single-add path. A failure here does
        // not fail the row — the creator-list write above is what the
        // creator's campaigns actually depend on.
        try {
          const existing = await db.newsletterSubscriber.findUnique({
            where: { email: row.email },
          });
          if (existing) {
            const existingTags = existing.tags || [];
            if (!existingTags.includes(creatorTag)) {
              await db.newsletterSubscriber.update({
                where: { email: row.email },
                data: { tags: [...existingTags, creatorTag] },
              });
            }
          } else {
            await db.newsletterSubscriber.create({
              data: {
                email: row.email,
                name: row.name || null,
                source: "creator_import",
                tags: [creatorTag],
                isActive: true,
              },
            });
          }
        } catch (syncErr) {
          const isUniqueViolation =
            syncErr &&
            typeof syncErr === "object" &&
            "code" in syncErr &&
            (syncErr as { code?: string }).code === "P2002";
          if (!isUniqueViolation) {
            creatorEmailMarketingSubscribersImportLogger.error(
              { err: String(syncErr) },
              "Failed to sync imported subscriber to admin newsletter:"
            );
          }
        }
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
      skippedDuplicate,
      total: rows.length,
      errors,
    });
  } catch (error) {
    creatorEmailMarketingSubscribersImportLogger.error({ err: formatError(error) }, "Error importing subscribers:");
    return NextResponse.json(
      { error: "Failed to import subscribers" },
      { status: 500 }
    );
  }
}
