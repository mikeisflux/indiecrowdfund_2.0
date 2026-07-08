import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { maybeSendRatingRequest } from "@/lib/email/rating-request";

const reviewSchema = z.object({
  pledgeId: z.string().min(1),
  markedReceived: z.boolean().optional(),
  overallRating: z.number().int().min(1).max(5).nullable().optional(),
  deliveryRating: z.number().int().min(1).max(5).nullable().optional(),
  qualityRating: z.number().int().min(1).max(5).nullable().optional(),
  communicationRating: z.number().int().min(1).max(5).nullable().optional(),
  reviewTitle: z.string().max(200).nullable().optional(),
  reviewBody: z.string().max(5000).nullable().optional(),
});

// GET: fetch reviews for current user (all, or filtered by pledgeId)
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const pledgeId = searchParams.get("pledgeId");

    if (pledgeId) {
      // Verify pledge belongs to current user
      const pledge = await db.pledge.findFirst({
        where: { id: pledgeId, userId: session.user.id, deletedAt: null },
      });
      if (!pledge) {
        return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
      }

      const review = await db.backerReview.findUnique({
        where: { pledgeId },
      });
      return NextResponse.json({ review });
    }

    // Return all reviews for this user
    const reviews = await db.backerReview.findMany({
      where: { userId: session.user.id },
      select: {
        id: true,
        pledgeId: true,
        projectId: true,
        markedReceived: true,
        markedReceivedAt: true,
        overallRating: true,
        deliveryRating: true,
        qualityRating: true,
        communicationRating: true,
        reviewTitle: true,
        reviewBody: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Return as map keyed by pledgeId for easy lookup
    const reviewsByPledgeId: Record<string, (typeof reviews)[number]> = {};
    for (const r of reviews) {
      reviewsByPledgeId[r.pledgeId] = r;
    }

    return NextResponse.json({ reviews: reviewsByPledgeId });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return NextResponse.json({ error: "Failed to fetch reviews" }, { status: 500 });
  }
}

// POST: create or update a review
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }

    const { pledgeId, markedReceived, overallRating, deliveryRating, qualityRating, communicationRating, reviewTitle, reviewBody } = parsed.data;

    // Verify pledge belongs to this user and is completed
    const pledge = await db.pledge.findFirst({
      where: {
        id: pledgeId,
        userId: session.user.id,
        status: "COMPLETED",
        deletedAt: null,
      },
      include: {
        project: { select: { id: true, creatorId: true } },
      },
    });

    if (!pledge) {
      return NextResponse.json(
        { error: "Pledge not found or not eligible for review" },
        { status: 404 }
      );
    }

    // Upsert by pledgeId (@unique). Replaces a findUnique+create+update
    // TOCTOU that would P2002 under concurrent reviews of the same pledge.
    const existing = await db.backerReview.findUnique({ where: { pledgeId } });
    const now = new Date();
    const becameReceived = markedReceived && !existing?.markedReceived;

    const upserted = await db.backerReview.upsert({
      where: { pledgeId },
      update: {
        ...(markedReceived !== undefined && { markedReceived }),
        ...(becameReceived && { markedReceivedAt: now }),
        ...(overallRating !== undefined && { overallRating }),
        ...(deliveryRating !== undefined && { deliveryRating }),
        ...(qualityRating !== undefined && { qualityRating }),
        ...(communicationRating !== undefined && { communicationRating }),
        ...(reviewTitle !== undefined && { reviewTitle }),
        ...(reviewBody !== undefined && { reviewBody }),
      },
      create: {
        pledgeId,
        userId: session.user.id,
        projectId: pledge.project.id,
        creatorId: pledge.project.creatorId,
        markedReceived: markedReceived ?? false,
        markedReceivedAt: markedReceived ? now : null,
        overallRating: overallRating ?? null,
        deliveryRating: deliveryRating ?? null,
        qualityRating: qualityRating ?? null,
        communicationRating: communicationRating ?? null,
        reviewTitle: reviewTitle ?? null,
        reviewBody: reviewBody ?? null,
      },
    });

    // Stamp the review-submitted metric the moment a star rating exists, so
    // the reminder system stops nudging this backer. overallRating is what
    // "left a review" means; markedReceived alone doesn't count.
    if (upserted.overallRating != null) {
      await db.pledge.updateMany({
        where: { id: pledgeId, reviewSubmittedAt: null },
        data: { reviewSubmittedAt: now },
      });
    }

    // If the backer just marked this order received but hasn't left a
    // star rating, fire the rating-request nudge — this covers orders
    // the creator never formally marked DELIVERED. Fire-and-forget;
    // maybeSendRatingRequest dedupes (and no-ops if they DID include a
    // rating in this same save, since overallRating would now be set).
    if (becameReceived && upserted.overallRating == null) {
      maybeSendRatingRequest(pledgeId).catch(() => {});
    }

    return NextResponse.json({ review: upserted });
  } catch (error) {
    console.error("Error saving review:", error);
    return NextResponse.json({ error: "Failed to save review" }, { status: 500 });
  }
}
