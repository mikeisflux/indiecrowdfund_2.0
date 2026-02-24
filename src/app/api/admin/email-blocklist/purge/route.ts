import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

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

// DELETE - Remove ALL blocklist entries and restore bounced subscribers
export async function DELETE() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all blocked emails before deleting so we can restore subscribers
    const allEntries = await db.emailBlocklist.findMany({
      where: { type: "EMAIL" },
      select: { value: true },
    });
    const blockedEmails = allEntries.map((e) => e.value);

    // Delete all blocklist entries
    const result = await db.emailBlocklist.deleteMany({});

    // Restore bounced subscribers
    let restoredCount = 0;
    if (blockedEmails.length > 0) {
      const restored = await db.emailListSubscriber.updateMany({
        where: {
          email: { in: blockedEmails },
          status: "bounced",
        },
        data: {
          status: "subscribed",
        },
      });
      restoredCount = restored.count;
    }

    console.log(`[Blocklist Purge] Admin ${admin.id} removed ALL ${result.count} blocklist entries, restored ${restoredCount} subscribers`);

    return NextResponse.json({
      purged: result.count,
      restoredSubscribers: restoredCount,
      message: `Removed all ${result.count} blocklist entries and restored ${restoredCount} subscriber records`,
    });
  } catch (error) {
    console.error("Error removing all blocklist entries:", error);
    return NextResponse.json(
      { error: "Failed to remove blocklist entries" },
      { status: 500 }
    );
  }
}

// POST - Purge webhook-added blocklist entries by domain
// Body: { domain: "hotmail.com" } or { domains: ["hotmail.com", "outlook.com", "live.com"] }
// Only removes entries added by webhooks (source starts with "webhook-" or "sendgrid-" or "mailgun-")
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { domain, domains } = body;

    const domainList: string[] = domains || (domain ? [domain] : []);

    if (domainList.length === 0) {
      return NextResponse.json(
        { error: "Provide 'domain' or 'domains' to purge" },
        { status: 400 }
      );
    }

    // Normalize domains
    const normalizedDomains: string[] = domainList.map((d: string) => d.toLowerCase().trim());

    // Find all webhook-added EMAIL entries matching these domains
    const entriesToPurge = await db.emailBlocklist.findMany({
      where: {
        type: "EMAIL",
        source: { in: ["webhook-bounce", "webhook-spam", "sendgrid-bounce", "mailgun-bounce"] },
        OR: normalizedDomains.map((d) => ({
          value: { endsWith: `@${d}` },
        })),
      },
      select: { id: true, value: true, source: true, reason: true },
    });

    if (entriesToPurge.length === 0) {
      return NextResponse.json({
        purged: 0,
        message: `No webhook-added blocklist entries found for domains: ${normalizedDomains.join(", ")}`,
      });
    }

    const entryIds = entriesToPurge.map((e) => e.id);

    // Delete all matching entries
    const result = await db.emailBlocklist.deleteMany({
      where: { id: { in: entryIds } },
    });

    // Also restore any subscriber records that were marked as bounced for these emails
    const purgedEmails = entriesToPurge.map((e) => e.value);
    const restoredSubscribers = await db.emailListSubscriber.updateMany({
      where: {
        email: { in: purgedEmails },
        status: "bounced",
      },
      data: {
        status: "subscribed",
      },
    });

    console.log(`[Blocklist Purge] Admin ${admin.id} purged ${result.count} entries for domains: ${normalizedDomains.join(", ")}`);

    return NextResponse.json({
      purged: result.count,
      restoredSubscribers: restoredSubscribers.count,
      domains: normalizedDomains,
      message: `Purged ${result.count} webhook-added blocklist entries and restored ${restoredSubscribers.count} subscriber records`,
    });
  } catch (error) {
    console.error("Error purging blocklist:", error);
    return NextResponse.json(
      { error: "Failed to purge blocklist entries" },
      { status: 500 }
    );
  }
}
