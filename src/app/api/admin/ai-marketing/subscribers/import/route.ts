import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminAiMarketingSubscribersImportLogger = logger.child({ module: "admin-ai-marketing-subscribers-import" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Force dynamic - this route uses auth/headers
export const dynamic = "force-dynamic";

// Helper to check admin role
async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.id) {
    return { error: "Unauthorized", status: 401 };
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
    return { error: "Forbidden - Admin access required", status: 403 };
  }

  return { user: session.user };
}

interface SubscriberData {
  email: string;
  name?: string;
  source?: string;
  tags?: string[];
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    // Get admin's name for tagging
    const admin = await db.user.findUnique({
      where: { id: authResult.user.id },
      select: { name: true },
    });

    const body = await req.json();
    const { subscribers, listTag, category } = body as {
      subscribers: SubscriberData[];
      listTag?: string;
      category?: string;
    };

    if (!subscribers || !Array.isArray(subscribers) || subscribers.length === 0) {
      return NextResponse.json(
        { error: "No subscribers provided" },
        { status: 400 }
      );
    }

    // Validate and deduplicate emails
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validSubscribers: SubscriberData[] = [];
    const errors: string[] = [];
    const seenEmails = new Set<string>();

    for (const subscriber of subscribers) {
      const email = subscriber.email?.toLowerCase()?.trim();

      if (!email) {
        errors.push("Missing email address");
        continue;
      }

      if (!emailRegex.test(email)) {
        errors.push(`Invalid email: ${email}`);
        continue;
      }

      if (seenEmails.has(email)) {
        continue; // Skip duplicates in the import file
      }

      seenEmails.add(email);
      validSubscribers.push({
        email,
        name: subscriber.name?.trim() || undefined,
        source: subscriber.source || "csv_import",
      });
    }

    if (validSubscribers.length === 0) {
      return NextResponse.json(
        { error: "No valid subscribers to import", errors },
        { status: 400 }
      );
    }

    // Get existing subscribers to skip duplicates
    const existingSubscribers = await db.newsletterSubscriber.findMany({
      where: {
        email: { in: validSubscribers.map((s) => s.email) },
      },
      select: { email: true },
    });

    const existingEmails = new Set(existingSubscribers.map((s: { email: string }) => s.email.toLowerCase()));
    const newSubscribers = validSubscribers.filter(
      (s) => !existingEmails.has(s.email)
    );
    const skippedCount = validSubscribers.length - newSubscribers.length;

    // Build tags array - include category, list tag and/or admin name
    const importTags: string[] = [];

    // Add category as a tag for filtering
    if (category) {
      const categoryLabels: Record<string, string> = {
        newsletter_subscribers: "Newsletter Subscribers",
        backers: "Backers",
        creators: "Creators",
        retailer_users: "Retailer Users",
      };
      importTags.push(categoryLabels[category] || category);
    }

    if (listTag && listTag.trim()) {
      importTags.push(listTag.trim());
    }
    // Add admin name as "Imported by: X" if no specific list tag
    if (admin?.name && !listTag) {
      importTags.push(`Imported by ${admin.name}`);
    }

    // Batch import new subscribers
    if (newSubscribers.length > 0) {
      await db.newsletterSubscriber.createMany({
        data: newSubscribers.map((s) => ({
          email: s.email,
          name: s.name || null,
          source: s.source || "csv_import",
          tags: importTags.length > 0 ? importTags : [],
          subscribedAt: new Date(),
          isActive: true,
        })),
        skipDuplicates: true,
      });
    }

    return NextResponse.json({
      success: true,
      imported: newSubscribers.length,
      skipped: skippedCount,
      total: subscribers.length,
      errors: errors.slice(0, 10), // Limit errors returned
    });
  } catch (error) {
    adminAiMarketingSubscribersImportLogger.error({ err: String(error) }, "Error importing subscribers:");
    return NextResponse.json(
      { error: "Failed to import subscribers" },
      { status: 500 }
    );
  }
}
