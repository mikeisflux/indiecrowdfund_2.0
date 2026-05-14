import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const creatorEmailMarketingSubscribersLogger = logger.child({ module: "creator-email-marketing-subscribers" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Helper to verify a newsletterSubscriber row belongs to this creator.
//
// newsletterSubscriber has no creatorId column, so ownership can't be
// read off the row directly. It used to be inferred from the free-text
// creator tag in `tags[]` — but that tag falls back to a non-unique
// display name, so two creators sharing a name could pass each other's
// check. Instead, derive ownership from the creator-scoped
// emailListSubscriber table: a creator owns a newsletter row only if the
// same email is on their own email list (emailListSubscriber has a real
// creatorId FK). Every current creator write path that touches
// newsletterSubscriber also writes the email to emailListSubscriber, so
// this is equivalent — and immune to name collisions.
async function verifySubscriberOwnership(subscriberId: string, userId: string) {
  const subscriber = await db.newsletterSubscriber.findUnique({
    where: { id: subscriberId },
  });

  if (!subscriber) return null;

  const ownsEmail = await db.emailListSubscriber.findFirst({
    where: { creatorId: userId, email: subscriber.email },
    select: { id: true },
  });

  return ownsEmail ? subscriber : null;
}

// GET - Get single subscriber
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const subscriber = await verifySubscriberOwnership(id, session.user.id);

    if (!subscriber) {
      return NextResponse.json({ error: "Subscriber not found" }, { status: 404 });
    }

    return NextResponse.json({ subscriber });
  } catch (error) {
    creatorEmailMarketingSubscribersLogger.error({ err: String(error) }, "Error fetching subscriber:");
    return NextResponse.json(
      { error: "Failed to fetch subscriber" },
      { status: 500 }
    );
  }
}

// PATCH - Update subscriber
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const subscriber = await verifySubscriberOwnership(id, session.user.id);

    if (!subscriber) {
      return NextResponse.json({ error: "Subscriber not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, email, isActive } = body;

    // Validate email if provided
    if (email && email !== subscriber.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
      }

      // Check if email already exists
      const existing = await db.newsletterSubscriber.findUnique({
        where: { email: email.toLowerCase() },
      });
      if (existing && existing.id !== id) {
        return NextResponse.json({ error: "Email already exists" }, { status: 400 });
      }
    }

    // P2002 catch on email @unique — the findUnique check above is TOCTOU.
    let updated;
    try {
      updated = await db.newsletterSubscriber.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(email && { email: email.toLowerCase() }),
          ...(isActive !== undefined && {
            isActive,
            unsubscribedAt: isActive ? null : new Date(),
          }),
        },
      });
    } catch (updateErr) {
      const isUniqueViolation =
        updateErr &&
        typeof updateErr === "object" &&
        "code" in updateErr &&
        (updateErr as { code?: string }).code === "P2002";
      if (isUniqueViolation) {
        return NextResponse.json({ error: "Email already exists" }, { status: 409 });
      }
      throw updateErr;
    }

    return NextResponse.json({ subscriber: updated });
  } catch (error) {
    creatorEmailMarketingSubscribersLogger.error({ err: String(error) }, "Error updating subscriber:");
    return NextResponse.json(
      { error: "Failed to update subscriber" },
      { status: 500 }
    );
  }
}

// DELETE - Remove subscriber
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Try EmailListSubscriber first — that's the primary table for the
    // creator-wide email list shown on the indiekit subscribers tab and
    // counted on campaign sends. Only delete if the row belongs to
    // this creator.
    const elsDeleted = await db.emailListSubscriber.deleteMany({
      where: { id, creatorId: session.user.id },
    });
    if (elsDeleted.count > 0) {
      return NextResponse.json({ success: true });
    }

    // Fall back to legacy NewsletterSubscriber records imported by this
    // creator. Older imports + manual adds went there instead of
    // EmailListSubscriber; keep the path working so creators can still
    // clean those out.
    const subscriber = await verifySubscriberOwnership(id, session.user.id);
    if (!subscriber) {
      return NextResponse.json({ error: "Subscriber not found" }, { status: 404 });
    }

    // deleteMany for idempotency on concurrent double-clicks.
    await db.newsletterSubscriber.deleteMany({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    creatorEmailMarketingSubscribersLogger.error({ err: String(error) }, "Error deleting subscriber:");
    return NextResponse.json(
      { error: "Failed to delete subscriber" },
      { status: 500 }
    );
  }
}
