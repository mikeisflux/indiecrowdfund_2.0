import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Helper to get creator tag
async function getCreatorTag(userId: string) {
  const creator = await db.user.findUnique({
    where: { id: userId },
    select: { name: true, vanityUrl: true },
  });
  return creator?.vanityUrl || creator?.name || userId;
}

// Helper to verify subscriber belongs to creator
async function verifySubscriberOwnership(subscriberId: string, userId: string) {
  const creatorTag = await getCreatorTag(userId);

  const subscriber = await db.newsletterSubscriber.findUnique({
    where: { id: subscriberId },
  });

  if (!subscriber) return null;

  // Check if this subscriber was imported by this creator
  if (subscriber.source?.startsWith(`creator_import:${creatorTag}`) ||
      subscriber.source?.startsWith(`creator_manual:${creatorTag}`)) {
    return subscriber;
  }

  return null;
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
    console.error("Error fetching subscriber:", error);
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

    const updated = await db.newsletterSubscriber.update({
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

    return NextResponse.json({ subscriber: updated });
  } catch (error) {
    console.error("Error updating subscriber:", error);
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
    const subscriber = await verifySubscriberOwnership(id, session.user.id);

    if (!subscriber) {
      return NextResponse.json({ error: "Subscriber not found" }, { status: 404 });
    }

    await db.newsletterSubscriber.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting subscriber:", error);
    return NextResponse.json(
      { error: "Failed to delete subscriber" },
      { status: 500 }
    );
  }
}
