import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const adminMailboxesLogger = logger.child({ module: "admin-mailboxes" });
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Type definitions for Prisma models
type EmailFolder = "INBOX" | "SENT" | "DRAFTS" | "TRASH" | "SPAM" | "ARCHIVE";

interface MailboxWithCount {
  id: string;
  name: string;
  email: string;
  description: string | null;
  color: string | null;
  imapHost: string | null;
  imapPort: number | null;
  smtpHost: string | null;
  smtpPort: number | null;
  username: string | null;
  password: string | null;
  useSSL: boolean;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count: { emails: number };
}

// Require admin access
async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const user = await db.user.findFirst({
    where: { id: session.user.id, deletedAt: null },
    select: { role: true },
  });

  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    return null;
  }

  return session.user;
}

// GET - List all mailboxes (excluding creator mailboxes)
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Only filter by the explicit isCreatorMailbox flag
    // Don't filter by email pattern - admins can create mailboxes with any email
    const mailboxes = await db.mailbox.findMany({
      where: {
        isCreatorMailbox: false, // Only exclude mailboxes explicitly marked as creator mailboxes
      },
      orderBy: [
        { isDefault: "desc" },
        { name: "asc" },
      ],
      include: {
        _count: {
          select: {
            emails: true,
          },
        },
      },
    });

    // Get unread counts for each mailbox
    const mailboxesWithCounts = await Promise.all(
      mailboxes.map(async (mailbox: MailboxWithCount) => {
        const unreadCount = await db.adminEmail.count({
          where: {
            mailboxId: mailbox.id,
            isRead: false,
            folder: "INBOX" as EmailFolder,
          },
        });

        const folderCounts = await db.adminEmail.groupBy({
          by: ["folder"],
          where: { mailboxId: mailbox.id },
          _count: true,
        });

        const folders = folderCounts.reduce((acc: Record<string, number>, curr: { folder: string; _count: number }) => {
          acc[curr.folder] = curr._count;
          return acc;
        }, {} as Record<string, number>);

        return {
          ...mailbox,
          unreadCount,
          totalEmails: mailbox._count.emails,
          folders,
          // Mask password if exists
          password: mailbox.password ? "••••••••" : null,
        };
      })
    );

    return NextResponse.json({ mailboxes: mailboxesWithCounts });
  } catch (error) {
    adminMailboxesLogger.error({ err: formatError(error) }, "Error fetching mailboxes:");
    return NextResponse.json(
      { error: "Failed to fetch mailboxes" },
      { status: 500 }
    );
  }
}

// POST - Create a new mailbox
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      name,
      email,
      description,
      color,
      imapHost,
      imapPort,
      smtpHost,
      smtpPort,
      username,
      password,
      useSSL,
      isDefault,
      isCreatorMailbox,
    } = body;

    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      );
    }

    // Run default-clearing and create in a single transaction so two
    // concurrent "set as default" creates can't leave multiple rows
    // with isDefault: true. Catches P2002 on the email @unique
    // constraint from the TOCTOU findUnique race.
    let mailbox;
    try {
      mailbox = await db.$transaction(async (tx) => {
        if (isDefault) {
          await tx.mailbox.updateMany({
            where: { isDefault: true },
            data: { isDefault: false },
          });
        }
        return tx.mailbox.create({
          data: {
            name,
            email,
            description: description || null,
            color: color || "#3B82F6",
            imapHost: imapHost || null,
            imapPort: imapPort || null,
            smtpHost: smtpHost || null,
            smtpPort: smtpPort || null,
            username: username || null,
            password: password || null,
            useSSL: useSSL !== undefined ? useSSL : true,
            isDefault: isDefault || false,
            isCreatorMailbox: isCreatorMailbox || false,
          },
        });
      });
    } catch (createErr) {
      const isUniqueViolation =
        createErr &&
        typeof createErr === "object" &&
        "code" in createErr &&
        (createErr as { code?: string }).code === "P2002";
      if (isUniqueViolation) {
        return NextResponse.json(
          { error: "A mailbox with this email already exists" },
          { status: 409 }
        );
      }
      throw createErr;
    }

    return NextResponse.json({
      mailbox: {
        ...mailbox,
        password: mailbox.password ? "••••••••" : null,
      },
    });
  } catch (error) {
    adminMailboxesLogger.error({ err: formatError(error) }, "Error creating mailbox:");
    return NextResponse.json(
      { error: "Failed to create mailbox" },
      { status: 500 }
    );
  }
}
