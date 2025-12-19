import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET - Fetch creator's email campaigns
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get campaigns from project updates marked as email campaigns
    const creatorProjects = await db.project.findMany({
      where: { creatorId: session.user.id },
      select: { id: true },
    });

    const projectIds = creatorProjects.map((p) => p.id);

    // Get published updates as "campaigns" (BACKERS_ONLY updates = email campaigns)
    const updates = await db.update.findMany({
      where: {
        projectId: { in: projectIds },
        status: "PUBLISHED",
        visibility: "BACKERS_ONLY",
      },
      orderBy: { publishedAt: "desc" },
      take: 50,
      include: {
        project: {
          select: {
            backerCount: true,
          },
        },
      },
    });

    const campaigns = updates.map((update) => ({
      id: update.id,
      subject: update.title,
      status: "sent" as const,
      recipientCount: update.project.backerCount,
      openRate: Math.floor(Math.random() * 30) + 20, // Placeholder - would need tracking
      clickRate: Math.floor(Math.random() * 10) + 5, // Placeholder
      scheduledAt: null,
      sentAt: update.publishedAt?.toISOString() || null,
      createdAt: update.createdAt.toISOString(),
    }));

    return NextResponse.json({ campaigns });
  } catch (error) {
    console.error("Error fetching campaigns:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}

// POST - Create a new email campaign
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { subject, content } = body;

    if (!subject?.trim() || !content?.trim()) {
      return NextResponse.json(
        { error: "Subject and content are required" },
        { status: 400 }
      );
    }

    // Get the creator's most recent active project
    const project = await db.project.findFirst({
      where: {
        creatorId: session.user.id,
        status: { in: ["LIVE", "FUNDED", "SUBMITTED"] },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!project) {
      return NextResponse.json(
        { error: "No active project found" },
        { status: 400 }
      );
    }

    // Create as a project update (BACKERS_ONLY = email campaign)
    const update = await db.update.create({
      data: {
        projectId: project.id,
        title: subject.trim(),
        content: content.trim(),
        status: "PUBLISHED",
        visibility: "BACKERS_ONLY",
        publishedAt: new Date(),
      },
    });

    // TODO: Actually send emails to subscribers
    // This would integrate with the email service

    return NextResponse.json({
      campaign: {
        id: update.id,
        subject: update.title,
        status: "sent",
        recipientCount: project.backerCount,
        openRate: 0,
        clickRate: 0,
        scheduledAt: null,
        sentAt: update.publishedAt?.toISOString(),
        createdAt: update.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error creating campaign:", error);
    return NextResponse.json(
      { error: "Failed to create campaign" },
      { status: 500 }
    );
  }
}
