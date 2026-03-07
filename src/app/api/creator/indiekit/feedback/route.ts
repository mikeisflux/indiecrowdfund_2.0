import { NextRequest, NextResponse } from "next/server";
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

    // Store as a fulfillment activity for now; could be its own model later
    await db.fulfillmentActivity.create({
      data: {
        projectId: projectId || "global",
        type: "NPS_FEEDBACK",
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

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid feedback data" }, { status: 400 });
    }
    console.error("NPS feedback error:", error);
    return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 });
  }
}
