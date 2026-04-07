import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminMailboxesLogger = logger.child({ module: "admin-mailboxes" });
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

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

// GET - Get a specific mailbox
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const mailbox = await db.mailbox.findUnique({
      where: { id },
      include: {
        _count: {
          select: { emails: true },
        },
      },
    });

    if (!mailbox) {
      return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
    }

    return NextResponse.json({
      mailbox: {
        ...mailbox,
        password: mailbox.password ? "••••••••" : null,
        totalEmails: mailbox._count.emails,
      },
    });
  } catch (error) {
    adminMailboxesLogger.error({ err: String(error) }, "Error fetching mailbox:");
    return NextResponse.json(
      { error: "Failed to fetch mailbox" },
      { status: 500 }
    );
  }
}

// PUT - Update a mailbox
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
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
      isActive,
      isCreatorMailbox,
    } = body;

    const existing = await db.mailbox.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
    }

    // Check if email conflicts with another mailbox
    if (email && email !== existing.email) {
      const conflict = await db.mailbox.findUnique({
        where: { email },
      });
      if (conflict) {
        return NextResponse.json(
          { error: "A mailbox with this email already exists" },
          { status: 400 }
        );
      }
    }

    // If this is set as default, unset other defaults
    if (isDefault && !existing.isDefault) {
      await db.mailbox.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const mailbox = await db.mailbox.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(description !== undefined && { description }),
        ...(color !== undefined && { color }),
        ...(imapHost !== undefined && { imapHost }),
        ...(imapPort !== undefined && { imapPort }),
        ...(smtpHost !== undefined && { smtpHost }),
        ...(smtpPort !== undefined && { smtpPort }),
        ...(username !== undefined && { username }),
        // Only update password if provided and not masked
        ...(password !== undefined && password !== "••••••••" && { password }),
        ...(useSSL !== undefined && { useSSL }),
        ...(isDefault !== undefined && { isDefault }),
        ...(isActive !== undefined && { isActive }),
        ...(isCreatorMailbox !== undefined && { isCreatorMailbox }),
      },
    });

    return NextResponse.json({
      mailbox: {
        ...mailbox,
        password: mailbox.password ? "••••••••" : null,
      },
    });
  } catch (error) {
    adminMailboxesLogger.error({ err: String(error) }, "Error updating mailbox:");
    return NextResponse.json(
      { error: "Failed to update mailbox" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a mailbox
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const existing = await db.mailbox.findUnique({
      where: { id },
      include: {
        _count: { select: { emails: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
    }

    // Warn if mailbox has emails (they will be cascade deleted)
    if (existing._count.emails > 0) {
      const url = new URL(request.url);
      const force = url.searchParams.get("force") === "true";
      if (!force) {
        return NextResponse.json(
          {
            error: `This mailbox contains ${existing._count.emails} emails. Add ?force=true to delete anyway.`,
            emailCount: existing._count.emails,
          },
          { status: 400 }
        );
      }
    }

    await db.mailbox.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    adminMailboxesLogger.error({ err: String(error) }, "Error deleting mailbox:");
    return NextResponse.json(
      { error: "Failed to delete mailbox" },
      { status: 500 }
    );
  }
}
