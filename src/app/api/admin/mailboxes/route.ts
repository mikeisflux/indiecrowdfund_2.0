import { NextRequest, NextResponse } from "next/server";
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

  const user = await db.user.findUnique({
    where: { id: session.user.id },
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
    console.error("Error fetching mailboxes:", error);
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

    // Check if email already exists
    const existing = await db.mailbox.findUnique({
      where: { email },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A mailbox with this email already exists" },
        { status: 400 }
      );
    }

    // If this is set as default, unset other defaults
    if (isDefault) {
      await db.mailbox.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const mailbox = await db.mailbox.create({
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

    return NextResponse.json({
      mailbox: {
        ...mailbox,
        password: mailbox.password ? "••••••••" : null,
      },
    });
  } catch (error) {
    console.error("Error creating mailbox:", error);
    return NextResponse.json(
      { error: "Failed to create mailbox" },
      { status: 500 }
    );
  }
}
