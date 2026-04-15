import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminAiMarketingCampaignsManageLogger = logger.child({ module: "admin-ai-marketing-campaigns-manage" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Helper to check admin role
async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.id) {
    return { error: "Unauthorized", status: 401 };
  }

  const user = await db.user.findFirst({
    where: { id: session.user.id, deletedAt: null },
    select: { role: true },
  });

  if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
    return { error: "Forbidden - Admin access required", status: 403 };
  }

  return { user: session.user };
}

// GET - Get single campaign details
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { id } = await params;

    const campaign = await db.emailCampaign.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        subject: true,
        htmlContent: true,
        targetAudience: true,
        filters: true,
        status: true,
        scheduledFor: true,
        sentAt: true,
        recipientCount: true,
        sentCount: true,
        openCount: true,
        clickCount: true,
        bounceCount: true,
        unsubscribeCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    return NextResponse.json({ campaign });
  } catch (error) {
    adminAiMarketingCampaignsManageLogger.error({ err: String(error) }, "Error fetching campaign:");
    return NextResponse.json(
      { error: "Failed to fetch campaign" },
      { status: 500 }
    );
  }
}

// PATCH - Update campaign
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, subject, htmlContent, scheduledFor, status, filters } = body;

    // Check campaign exists
    const existing = await db.emailCampaign.findUnique({
      where: { id },
      select: { status: true, targetAudience: true, filters: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Only allow editing draft or scheduled campaigns
    if (existing.status === "SENT" || existing.status === "SENDING") {
      return NextResponse.json(
        { error: "Cannot edit a campaign that has been sent or is sending" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (subject !== undefined) updateData.subject = subject;
    if (htmlContent !== undefined) updateData.htmlContent = htmlContent;
    if (scheduledFor !== undefined) updateData.scheduledFor = scheduledFor ? new Date(scheduledFor) : null;
    if (status !== undefined && (status === "DRAFT" || status === "SCHEDULED")) {
      updateData.status = status;
    }
    if (filters !== undefined) updateData.filters = filters;

    // Recalculate recipient count if filters changed (segments)
    if (filters !== undefined) {
      const segments = filters?.segments as string[] | undefined;
      const audience = existing.targetAudience || "subscriber";

      if (audience === "subscriber" && segments && segments.length > 0) {
        // Build filters for each segment
        const segmentFilters: Array<{ tags: { has: string } } | { source: { in: string[] } }> = [];

        for (const segmentId of segments) {
          if (segmentId.startsWith("source-")) {
            const sourceName = segmentId.replace("source-", "");
            segmentFilters.push({ source: { in: [sourceName] } });
          } else if (segmentId.startsWith("tag-")) {
            const tagName = segmentId.replace(/^tag-/, "");
            segmentFilters.push({ tags: { has: tagName } });
          } else {
            segmentFilters.push({ tags: { has: segmentId } });
          }
        }

        if (segmentFilters.length > 0) {
          const recipientCount = await db.newsletterSubscriber.count({
            where: {
              isActive: true,
              OR: segmentFilters,
            },
          });
          updateData.recipientCount = recipientCount;
        }
      } else if (!segments || segments.length === 0) {
        // No segments selected - calculate full audience count
        if (audience === "subscriber") {
          const [nlSubCount, verifiedCount] = await Promise.all([
            db.newsletterSubscriber.count({
              where: {
                isActive: true,
                NOT: { source: { contains: "retailer", mode: "insensitive" } },
              },
            }),
            db.user.count({ where: { emailVerified: { not: null } } }),
          ]);
          updateData.recipientCount = nlSubCount + verifiedCount;
        }
      }
    }

    // CAS on status NOT in [SENT, SENDING] — without this, a status
    // transition to SENDING that happens between the findUnique above
    // and this update would allow an edit to land mid-send and
    // corrupt the campaign contents for pending deliveries.
    const updateCas = await db.emailCampaign.updateMany({
      where: { id, status: { notIn: ["SENT", "SENDING"] } },
      data: updateData,
    });
    if (updateCas.count === 0) {
      return NextResponse.json(
        { error: "Campaign status changed — cannot edit while sending or after sent" },
        { status: 409 }
      );
    }
    const campaign = await db.emailCampaign.findUnique({ where: { id } });

    return NextResponse.json({ success: true, campaign });
  } catch (error) {
    adminAiMarketingCampaignsManageLogger.error({ err: String(error) }, "Error updating campaign:");
    return NextResponse.json(
      { error: "Failed to update campaign" },
      { status: 500 }
    );
  }
}

// DELETE - Delete campaign
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { id } = await params;

    // Check campaign exists
    const existing = await db.emailCampaign.findUnique({
      where: { id },
      select: { status: true, name: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Don't allow deleting campaigns that are currently sending
    if (existing.status === "SENDING") {
      return NextResponse.json(
        { error: "Cannot delete a campaign that is currently sending" },
        { status: 400 }
      );
    }

    await db.emailCampaign.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: `Campaign "${existing.name}" deleted` });
  } catch (error) {
    adminAiMarketingCampaignsManageLogger.error({ err: String(error) }, "Error deleting campaign:");
    return NextResponse.json(
      { error: "Failed to delete campaign" },
      { status: 500 }
    );
  }
}
