import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkEmailAccess } from "@/lib/auth/email-access";
import { logger } from "@/lib/logger";

const campaignLogger = logger.child({ module: "campaigns" });

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Server-side email access control
    const emailAccess = await checkEmailAccess(session.user.id);
    if (!emailAccess.allowed) {
      return NextResponse.json({ error: emailAccess.reason }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    const campaigns = await db.emailCampaign.findMany({
      where: {
        createdBy: session.user.id,
        ...(projectId && {
          filters: {
            path: ["projectId"],
            equals: projectId,
          },
        }),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ campaigns });
  } catch (error) {
    campaignLogger.error({ err: error instanceof Error ? error.message : String(error) }, "Campaigns GET error");
    return NextResponse.json({ error: "Failed to fetch campaigns" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Server-side email access control for all campaign operations
    const emailAccess = await checkEmailAccess(session.user.id);
    if (!emailAccess.allowed) {
      return NextResponse.json({ error: emailAccess.reason }, { status: 403 });
    }

    const body = await req.json();
    const { projectId, action, campaignId, name, title, subject, content, stageId } = body;
    // Support both 'body' and 'content' for template content
    const htmlContent = body.body || content || "";

    if (action === "create" || action === "create_draft") {
      const campaignName = name || title || "New Campaign";

      const campaign = await db.emailCampaign.create({
        data: {
          name: campaignName,
          subject: subject || "",
          htmlContent: htmlContent,
          status: "DRAFT",
          recipientCount: 0,
          createdBy: session.user.id,
          filters: projectId ? { projectId, stageId } : { stageId },
        },
      });

      return NextResponse.json({ campaign, campaignId: campaign.id });
    }

    if (action === "duplicate" && campaignId) {
      // Get the original campaign
      const original = await db.emailCampaign.findUnique({
        where: { id: campaignId },
      });

      if (!original) {
        return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
      }

      // Create a copy
      const campaign = await db.emailCampaign.create({
        data: {
          name: `${original.name} (Copy)`,
          subject: original.subject,
          htmlContent: original.htmlContent,
          status: "DRAFT",
          recipientCount: 0,
          createdBy: session.user.id,
          filters: original.filters || {},
        },
      });

      return NextResponse.json({ campaign, campaignId: campaign.id });
    }

    if (action === "update" && campaignId) {
      const campaign = await db.emailCampaign.update({
        where: { id: campaignId },
        data: {
          name: name || title,
          subject,
          htmlContent: htmlContent || undefined,
        },
      });

      return NextResponse.json({ campaign });
    }

    if (action === "send" && campaignId) {
      // Email access already validated at top of handler

      // Get campaign
      const campaign = await db.emailCampaign.findUnique({
        where: { id: campaignId },
      });

      if (!campaign) {
        return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
      }

      // Validate email template before sending
      if (!campaign.subject || campaign.subject.trim().length === 0) {
        return NextResponse.json({ error: "Email subject is required" }, { status: 400 });
      }
      if (campaign.subject.length > 200) {
        return NextResponse.json({ error: "Email subject must be under 200 characters" }, { status: 400 });
      }
      if (!campaign.htmlContent || campaign.htmlContent.trim().length === 0) {
        return NextResponse.json({ error: "Email body is required" }, { status: 400 });
      }
      if (campaign.status === "SENDING" || campaign.status === "SENT") {
        return NextResponse.json({ error: "Campaign has already been sent" }, { status: 400 });
      }

      // Mark as sending (actual sending would be done via a background job)
      await db.emailCampaign.update({
        where: { id: campaignId },
        data: {
          status: "SENDING",
          sentAt: new Date(),
        },
      });

      return NextResponse.json({ success: true, message: "Campaign queued for sending" });
    }

    if (action === "delete" && campaignId) {
      await db.emailCampaign.delete({
        where: { id: campaignId },
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    campaignLogger.error({ err: error instanceof Error ? error.message : String(error) }, "Campaigns POST error");
    return NextResponse.json({ error: "Failed to process campaign request" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get("campaignId");
    const projectId = searchParams.get("projectId");

    if (!campaignId) {
      return NextResponse.json({ error: "Campaign ID required" }, { status: 400 });
    }

    // Verify ownership
    const campaign = await db.emailCampaign.findFirst({
      where: {
        id: campaignId,
        createdBy: session.user.id,
        ...(projectId && {
          filters: {
            path: ["projectId"],
            equals: projectId,
          },
        }),
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    await db.emailCampaign.delete({
      where: { id: campaignId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    campaignLogger.error({ err: error instanceof Error ? error.message : String(error) }, "Campaigns DELETE error");
    return NextResponse.json({ error: "Failed to delete campaign" }, { status: 500 });
  }
}
