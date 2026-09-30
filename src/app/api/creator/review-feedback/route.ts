import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { pendingReviewFeedback } from "@/lib/reviews/pending-feedback";

export const dynamic = "force-dynamic";

// GET ?projectId=&includeAcknowledged=1 — review feedback the creator needs
// to see (rejections / change requests on projects still in draft).
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sp = new URL(req.url).searchParams;
  const feedback = await pendingReviewFeedback(session.user.id, {
    projectId: sp.get("projectId") || undefined,
    includeAcknowledged: sp.get("includeAcknowledged") === "1",
  });
  return NextResponse.json({ feedback });
}

// POST { reviewId } — the creator has read this feedback. Clears it from
// the login gate; the builder banner keeps showing it until resubmission.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const reviewId = typeof body.reviewId === "string" ? body.reviewId : "";
  if (!reviewId) {
    return NextResponse.json({ error: "reviewId is required" }, { status: 400 });
  }

  const review = await db.projectReview.findFirst({
    where: { id: reviewId },
    select: { id: true, projectId: true },
  });
  const owner = review
    ? await db.project.findFirst({
        where: { id: review.projectId, creatorId: session.user.id, deletedAt: null },
        select: { id: true },
      })
    : null;
  if (!review || !owner) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.projectReview.updateMany({
    where: { id: reviewId, acknowledgedAt: null },
    data: { acknowledgedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
