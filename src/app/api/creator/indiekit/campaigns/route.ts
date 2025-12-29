import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    console.error("Campaigns GET error:", error);
    return NextResponse.json({ error: "Failed to fetch campaigns" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { projectId, action, campaignId, name, subject, content, segmentId } = body;

    if (action === "create") {
      const campaign = await db.emailCampaign.create({
        data: {
          name: name || "New Campaign",
          subject: subject || "",
          htmlContent: content || "",
          textContent: "",
          status: "DRAFT",
          recipientCount: 0,
          createdBy: session.user.id,
          filters: projectId ? { projectId } : {},
        },
      });

      return NextResponse.json({ campaign });
    }

    if (action === "update" && campaignId) {
      const campaign = await db.emailCampaign.update({
        where: { id: campaignId },
        data: {
          name,
          subject,
          htmlContent: content,
        },
      });

      return NextResponse.json({ campaign });
    }

    if (action === "send" && campaignId) {
      // Get campaign
      const campaign = await db.emailCampaign.findUnique({
        where: { id: campaignId },
      });

      if (!campaign) {
        return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
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
    console.error("Campaigns POST error:", error);
    return NextResponse.json({ error: "Failed to process campaign request" }, { status: 500 });
  }
}
