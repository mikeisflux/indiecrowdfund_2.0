import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

// Bulk action schema
const bulkActionSchema = z.object({
  action: z.enum([
    "send_survey_reminder",
    "charge_cards",
    "lock_orders",
    "lock_addresses",
    "push_to_fulfillment",
    "mark_shipped",
  ]),
  pledgeIds: z.array(z.string()).min(1),
  projectId: z.string(),
});

// POST - Perform bulk actions on backers
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action, pledgeIds, projectId } = bulkActionSchema.parse(body);

    // Verify user has access to this project
    const project = await db.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { creatorId: session.user.id },
          {
            collaborators: {
              some: {
                userId: session.user.id,
                status: "ACCEPTED",
              },
            },
          },
        ],
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 403 });
    }

    // Get pledges
    const pledges = await db.pledge.findMany({
      where: {
        id: { in: pledgeIds },
        projectId,
      },
      include: {
        user: { select: { email: true, name: true } },
      },
    });

    if (pledges.length === 0) {
      return NextResponse.json({ error: "No valid pledges found" }, { status: 400 });
    }

    const results: { success: number; failed: number; errors?: string[] } = {
      success: 0,
      failed: 0,
      errors: [],
    };

    switch (action) {
      case "send_survey_reminder": {
        // Get survey for project
        const survey = await db.survey.findUnique({
          where: { projectId },
        });

        if (!survey) {
          return NextResponse.json({ error: "No survey found for this project" }, { status: 400 });
        }

        // Get pledges that haven't completed survey
        const surveyResponses = await db.surveyResponse.findMany({
          where: {
            surveyId: survey.id,
            pledgeId: { in: pledgeIds },
            isComplete: false,
          },
        });

        const pendingPledgeIds = new Set(surveyResponses.map(sr => sr.pledgeId));

        // Log activity
        await db.fulfillmentActivity.create({
          data: {
            projectId,
            type: "SURVEY_REMINDER",
            title: `Survey reminder sent to ${pendingPledgeIds.size} backers`,
            affectedCount: pendingPledgeIds.size,
            metadata: { pledgeIds: Array.from(pendingPledgeIds) },
          },
        });

        results.success = pendingPledgeIds.size;
        results.failed = pledgeIds.length - pendingPledgeIds.size;
        break;
      }

      case "lock_orders": {
        // Update survey to locked status
        await db.survey.update({
          where: { projectId },
          data: { status: "LOCKED", lockedAt: new Date() },
        });

        // Log activity
        await db.fulfillmentActivity.create({
          data: {
            projectId,
            type: "ORDERS_LOCKED",
            title: `Orders locked for ${pledgeIds.length} backers`,
            affectedCount: pledgeIds.length,
          },
        });

        results.success = pledgeIds.length;
        break;
      }

      case "lock_addresses": {
        // Lock addresses in survey responses
        await db.surveyResponse.updateMany({
          where: {
            pledgeId: { in: pledgeIds },
            survey: { projectId },
          },
          data: { addressLocked: true },
        });

        // Log activity
        await db.fulfillmentActivity.create({
          data: {
            projectId,
            type: "ADDRESSES_LOCKED",
            title: `Addresses locked for ${pledgeIds.length} backers`,
            affectedCount: pledgeIds.length,
          },
        });

        results.success = pledgeIds.length;
        break;
      }

      case "push_to_fulfillment": {
        // Update fulfillment status
        await db.pledge.updateMany({
          where: {
            id: { in: pledgeIds },
            projectId,
          },
          data: { fulfillmentStatus: "IN_PROGRESS" },
        });

        // Log activity
        await db.fulfillmentActivity.create({
          data: {
            projectId,
            type: "ORDERS_PUSHED",
            title: `${pledgeIds.length} orders pushed to fulfillment`,
            affectedCount: pledgeIds.length,
          },
        });

        results.success = pledgeIds.length;
        break;
      }

      case "mark_shipped": {
        await db.pledge.updateMany({
          where: {
            id: { in: pledgeIds },
            projectId,
          },
          data: { fulfillmentStatus: "SHIPPED" },
        });

        // Log activity
        await db.fulfillmentActivity.create({
          data: {
            projectId,
            type: "ORDER_SHIPPED",
            title: `${pledgeIds.length} orders marked as shipped`,
            affectedCount: pledgeIds.length,
          },
        });

        results.success = pledgeIds.length;
        break;
      }

      case "charge_cards": {
        // This would integrate with Stripe
        // For now, just log the activity
        await db.fulfillmentActivity.create({
          data: {
            projectId,
            type: "CARDS_CHARGED",
            title: `Card charge initiated for ${pledgeIds.length} backers`,
            affectedCount: pledgeIds.length,
          },
        });

        results.success = pledgeIds.length;
        break;
      }
    }

    return NextResponse.json({
      success: true,
      action,
      results,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    console.error("IndieKit backers bulk action error:", error);
    return NextResponse.json(
      { error: "Failed to perform bulk action" },
      { status: 500 }
    );
  }
}
