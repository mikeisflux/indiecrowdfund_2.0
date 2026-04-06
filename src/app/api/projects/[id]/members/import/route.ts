import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const projectsMembersImportLogger = logger.child({ module: "projects-members-import" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Helper function to verify user has access to project (creator or collaborator)
async function verifyProjectAccess(projectId: string, userId: string) {
  // Check if user is the creator
  let project = await db.project.findFirst({
    where: {
      id: projectId,
      deletedAt: null,
      creatorId: userId,
    },
    select: { id: true, title: true },
  });

  // If not creator, check if user is a collaborator with permission
  if (!project) {
    const collaborator = await db.projectCollaborator.findFirst({
      where: {
        projectId,
        userId,
        status: "ACCEPTED",
        canManageCommunity: true,
      },
      include: {
        project: {
          select: { id: true, title: true },
        },
      },
    });

    if (collaborator) {
      project = collaborator.project;
    }
  }

  return project;
}

interface ColumnMapping {
  emailColumn?: string;
  nameColumn?: string;
  firstNameColumn?: string;
  lastNameColumn?: string;
}

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current.trim().replace(/^"|"$/g, ""));
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim().replace(/^"|"$/g, ""));

  return values;
}

function parseCSV(content: string, columnMapping: ColumnMapping): { email: string; name?: string }[] {
  const lines = content.trim().split("\n");
  if (lines.length < 2) return [];

  // Parse header
  const headers = parseCSVLine(lines[0]);
  const headerLower = headers.map(h => h.toLowerCase());

  // Find column indices using provided mapping or auto-detect
  let emailIndex = -1;
  let nameIndex = -1;
  let firstNameIndex = -1;
  let lastNameIndex = -1;

  if (columnMapping.emailColumn) {
    emailIndex = headers.findIndex(h => h === columnMapping.emailColumn);
  }
  if (emailIndex === -1) {
    // Auto-detect email column
    emailIndex = headerLower.findIndex(h => h.includes("email") || h === "e-mail");
  }

  if (columnMapping.nameColumn) {
    nameIndex = headers.findIndex(h => h === columnMapping.nameColumn);
  }
  if (columnMapping.firstNameColumn) {
    firstNameIndex = headers.findIndex(h => h === columnMapping.firstNameColumn);
  }
  if (columnMapping.lastNameColumn) {
    lastNameIndex = headers.findIndex(h => h === columnMapping.lastNameColumn);
  }

  // Auto-detect name columns if not provided
  if (nameIndex === -1 && firstNameIndex === -1 && lastNameIndex === -1) {
    nameIndex = headerLower.findIndex(h => h === "name" || h.includes("full name") || h === "fullname");
    if (nameIndex === -1) {
      firstNameIndex = headerLower.findIndex(h => h === "first name" || h === "firstname" || h === "first");
      lastNameIndex = headerLower.findIndex(h => h === "last name" || h === "lastname" || h === "last" || h === "surname");
    }
  }

  if (emailIndex === -1) return [];

  const rows: { email: string; name?: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    const email = values[emailIndex]?.trim().toLowerCase();

    // Determine name from full name column or combine first/last
    let name: string | undefined;
    if (nameIndex >= 0 && values[nameIndex]) {
      name = values[nameIndex]?.trim();
    } else if (firstNameIndex >= 0 || lastNameIndex >= 0) {
      const firstName = firstNameIndex >= 0 ? values[firstNameIndex]?.trim() : "";
      const lastName = lastNameIndex >= 0 ? values[lastNameIndex]?.trim() : "";
      name = [firstName, lastName].filter(Boolean).join(" ") || undefined;
    }

    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      rows.push({ email, name });
    }
  }

  return rows;
}

// Helper function to sync imported email to admin newsletter
async function syncToAdminNewsletter(
  email: string,
  name: string | undefined,
  uploaderTag: string,
  projectTitle: string
) {
  try {
    // Check if already exists in newsletter
    const existing = await db.newsletterSubscriber.findUnique({
      where: { email },
    });

    const newTags = [`creator:${uploaderTag}`, `project:${projectTitle}`];

    if (existing) {
      // Add new tags without duplicating
      const existingTags = existing.tags || [];
      const combinedTags = Array.from(new Set([...existingTags, ...newTags]));

      await db.newsletterSubscriber.update({
        where: { email },
        data: {
          tags: combinedTags,
          // Reactivate if previously unsubscribed
          isActive: true,
        },
      });
    } else {
      // Create new subscriber
      await db.newsletterSubscriber.create({
        data: {
          email,
          name,
          source: "creator_import",
          tags: newTags,
          isActive: true,
        },
      });
    }
  } catch (error) {
    // Log but don't fail the import if newsletter sync fails
    projectsMembersImportLogger.error({ err: String(error) }, "Failed to sync to admin newsletter:");
  }
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

    // Verify user has access to this project (creator or collaborator)
    const project = await verifyProjectAccess(projectId, session.user.id);

    if (!project) {
      return NextResponse.json({ error: "Project not found or you don't have access" }, { status: 404 });
    }

    // Get user info for tagging in admin newsletter
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true },
    });
    const uploaderTag = user?.name || user?.email || session.user.id;

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const sourceProjectId = formData.get("sourceProjectId") as string | null;

    // Get column mapping from form data
    const columnMapping: ColumnMapping = {
      emailColumn: formData.get("emailColumn") as string | undefined,
      nameColumn: formData.get("nameColumn") as string | undefined,
      firstNameColumn: formData.get("firstNameColumn") as string | undefined,
      lastNameColumn: formData.get("lastNameColumn") as string | undefined,
    };

    // If importing from another project
    if (sourceProjectId) {
      // Verify user has access to the source project
      const sourceProject = await verifyProjectAccess(sourceProjectId, session.user.id);

      if (!sourceProject) {
        return NextResponse.json({ error: "Source project not found or you don't have access" }, { status: 404 });
      }

      // Get members from source project's creator email list
      const sourceMembers = await db.emailListSubscriber.findMany({
        where: {
          creatorId: session.user.id,
          sourceProjectId: sourceProjectId,
          status: "subscribed",
        },
        select: { email: true, name: true },
      });

      let imported = 0;
      let skipped = 0;

      for (const member of sourceMembers) {
        if (!member.email) continue;

        // Check if already exists in creator's email list
        const existing = await db.emailListSubscriber.findUnique({
          where: {
            creatorId_email: {
              creatorId: session.user.id,
              email: member.email,
            },
          },
        });

        if (existing) {
          skipped++;
          continue;
        }

        // Add to creator's email list
        await db.emailListSubscriber.create({
          data: {
            creatorId: session.user.id,
            email: member.email,
            name: member.name,
            source: "project_import",
            sourceProjectId: projectId,
            status: "subscribed",
          },
        });

        // Also sync to admin newsletter with uploader tag
        await syncToAdminNewsletter(member.email, member.name || undefined, uploaderTag, project.title);

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

    // Enforce file size limit (5 MB) to prevent DoS via enormous CSV uploads
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File size must be 5 MB or less" }, { status: 400 });
    }

    const content = await file.text();
    const rows = parseCSV(content, columnMapping);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No valid email addresses found in CSV" },
        { status: 400 }
      );
    }

    // Cap imports at 10,000 rows per request to prevent request timeouts
    const MAX_ROWS = 10000;
    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `CSV contains too many rows. Maximum is ${MAX_ROWS} per import.` },
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

        // Check if already exists in creator's email list
        const existing = await db.emailListSubscriber.findUnique({
          where: {
            creatorId_email: {
              creatorId: session.user.id,
              email: row.email,
            },
          },
        });

        if (existing) {
          skipped++;
          continue;
        }

        // Add to creator's email list
        await db.emailListSubscriber.create({
          data: {
            creatorId: session.user.id,
            email: row.email,
            name: row.name,
            source: "csv_import",
            sourceProjectId: projectId,
            status: "subscribed",
          },
        });

        // Also sync to admin newsletter with uploader tag
        await syncToAdminNewsletter(row.email, row.name, uploaderTag, project.title);

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
    projectsMembersImportLogger.error({ err: String(error) }, "Error importing project members:");
    return NextResponse.json(
      { error: "Failed to import members" },
      { status: 500 }
    );
  }
}
