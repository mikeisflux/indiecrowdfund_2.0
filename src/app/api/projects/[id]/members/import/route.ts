import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function parseCSV(content: string): { email: string; name?: string }[] {
  const lines = content.trim().split("\n");
  if (lines.length < 2) return [];

  // Parse header
  const header = lines[0].toLowerCase().split(",").map((h) => h.trim().replace(/"/g, ""));
  const emailIndex = header.findIndex((h) => h === "email" || h === "e-mail" || h === "email address");
  const nameIndex = header.findIndex((h) => h === "name" || h === "full name" || h === "first name");

  if (emailIndex === -1) return [];

  const rows: { email: string; name?: string }[] = [];

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

// POST - Import members from CSV for a specific project
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = await params;

    // Verify user owns this project
    const project = await db.project.findFirst({
      where: {
        id: projectId,
        creatorId: session.user.id,
      },
      select: { id: true, title: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const sourceProjectId = formData.get("sourceProjectId") as string | null;

    // If importing from another project
    if (sourceProjectId) {
      // Verify user owns the source project
      const sourceProject = await db.project.findFirst({
        where: {
          id: sourceProjectId,
          creatorId: session.user.id,
        },
        select: { id: true },
      });

      if (!sourceProject) {
        return NextResponse.json({ error: "Source project not found" }, { status: 404 });
      }

      // Get members from source project
      const sourceMembers = await db.projectFollower.findMany({
        where: { projectId: sourceProjectId },
        select: { email: true },
      });

      let imported = 0;
      let skipped = 0;

      for (const member of sourceMembers) {
        if (!member.email) continue;

        // Check if already exists in target project
        const existing = await db.projectFollower.findUnique({
          where: {
            projectId_email: {
              projectId,
              email: member.email,
            },
          },
        });

        if (existing) {
          skipped++;
          continue;
        }

        // Create in target project
        await db.projectFollower.create({
          data: {
            projectId,
            email: member.email,
            isPrelaunch: false,
          },
        });

        imported++;
      }

      return NextResponse.json({
        imported,
        failed: 0,
        total: sourceMembers.length,
        skipped,
      });
    }

    // Import from CSV file
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

    let imported = 0;
    let failed = 0;
    let skipped = 0;

    for (const row of rows) {
      try {
        if (!row.email) {
          failed++;
          continue;
        }

        // Check if already exists
        const existing = await db.projectFollower.findUnique({
          where: {
            projectId_email: {
              projectId,
              email: row.email,
            },
          },
        });

        if (existing) {
          skipped++;
          continue;
        }

        // Create new member
        await db.projectFollower.create({
          data: {
            projectId,
            email: row.email,
            isPrelaunch: false,
          },
        });

        imported++;
      } catch {
        failed++;
      }
    }

    return NextResponse.json({
      imported,
      failed,
      total: rows.length,
      skipped,
    });
  } catch (error) {
    console.error("Error importing project members:", error);
    return NextResponse.json(
      { error: "Failed to import members" },
      { status: 500 }
    );
  }
}
