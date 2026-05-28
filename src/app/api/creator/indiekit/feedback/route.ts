import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const creatorIndiekitFeedbackLogger = logger.child({ module: "creator-indiekit-feedback" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const feedbackSchema = z.object({
  score: z.number().min(0).max(10),
  feedback: z.string().max(2000).optional(),
  projectId: z.string().optional(),
});

// POST - Submit NPS feedback
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { score, feedback, projectId } = feedbackSchema.parse(body);

    // Store as a fulfillment activity only when a valid projectId is available
    // (FulfillmentActivity.projectId is a non-nullable FK — "global" is not valid)
    if (projectId) {
      await db.fulfillmentActivity.create({
        data: {
          projectId,
          type: "NOTE_ADDED",
          title: `NPS feedback: ${score}/10`,
          metadata: {
            score,
            feedback: feedback || "",
            userId: session.user.id,
            userEmail: session.user.email,
            submittedAt: new Date().toISOString(),
          },
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid feedback data" }, { status: 400 });
    }
    creatorIndiekitFeedbackLogger.error({ err: formatError(error) }, "NPS feedback error:");
    return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 });
  }
}
