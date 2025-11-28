import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Force dynamic - this route uses auth/headers
export const dynamic = "force-dynamic";

// Helper to check admin role
async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.id) {
    return { error: "Unauthorized", status: 401 };
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true }
  });

  if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
    return { error: "Forbidden - Admin access required", status: 403 };
  }

  return { user: session.user };
}

// GET - Get email campaigns and templates
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "campaigns";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status") || "all";
    const skip = (page - 1) * limit;

    if (type === "templates") {
      const [templates, total] = await Promise.all([
        db.emailTemplate.findMany({
          orderBy: { updatedAt: "desc" },
          skip,
          take: limit
        }),
        db.emailTemplate.count()
      ]);

      return NextResponse.json({
        templates,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    }

    // Get campaigns
    const where: Record<string, unknown> = {};
    if (status !== "all") {
      where.status = status;
    }

    const [campaigns, total, statusCounts] = await Promise.all([
      db.emailCampaign.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit
      }),
      db.emailCampaign.count({ where }),
      Promise.all([
        db.emailCampaign.count({ where: { status: "DRAFT" } }),
        db.emailCampaign.count({ where: { status: "SCHEDULED" } }),
        db.emailCampaign.count({ where: { status: "SENDING" } }),
        db.emailCampaign.count({ where: { status: "SENT" } }),
        db.emailCampaign.count({ where: { status: "CANCELLED" } })
      ])
    ]);

    // Get email logs summary
    const emailLogStats = await db.emailLog.groupBy({
      by: ["type"],
      _count: true
    });

    return NextResponse.json({
      campaigns,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      stats: {
        draft: statusCounts[0],
        scheduled: statusCounts[1],
        sending: statusCounts[2],
        sent: statusCounts[3],
        cancelled: statusCounts[4]
      },
      emailLogsByType: emailLogStats.map((e: { type: string; _count: number }) => ({
        type: e.type,
        count: e._count
      }))
    });
  } catch (error) {
    console.error("Error fetching emails:", error);
    return NextResponse.json(
      { error: "Failed to fetch email data" },
      { status: 500 }
    );
  }
}

// POST - Create campaign or template
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await req.json();
    const { type } = body;

    if (type === "template") {
      const { name, subject, htmlContent, textContent, variables } = body;

      if (!name || !subject || !htmlContent) {
        return NextResponse.json(
          { error: "Name, subject, and HTML content are required" },
          { status: 400 }
        );
      }

      const template = await db.emailTemplate.create({
        data: {
          name,
          subject,
          htmlContent,
          textContent,
          variables: variables || []
        }
      });

      return NextResponse.json({ success: true, template });
    }

    // Create campaign
    const { name, subject, htmlContent, targetAudience, filters, scheduledFor } = body;

    if (!name || !subject || !htmlContent) {
      return NextResponse.json(
        { error: "Name, subject, and HTML content are required" },
        { status: 400 }
      );
    }

    // Calculate recipient count based on target audience
    let recipientCount = 0;
    if (targetAudience === "all") {
      recipientCount = await db.user.count();
    } else if (targetAudience === "backers") {
      recipientCount = await db.user.count({
        where: { pledges: { some: {} } }
      });
    } else if (targetAudience === "creators") {
      recipientCount = await db.user.count({
        where: { createdProjects: { some: {} } }
      });
    }

    const campaign = await db.emailCampaign.create({
      data: {
        name,
        subject,
        htmlContent,
        targetAudience: targetAudience || "all",
        filters,
        status: scheduledFor ? "SCHEDULED" : "DRAFT",
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        recipientCount,
        createdBy: authResult.user.id
      }
    });

    return NextResponse.json({ success: true, campaign });
  } catch (error) {
    console.error("Error creating email:", error);
    return NextResponse.json(
      { error: "Failed to create email" },
      { status: 500 }
    );
  }
}

// PATCH - Update campaign or template
export async function PATCH(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await req.json();
    const { type, id, action } = body;

    if (!id) {
      return NextResponse.json(
        { error: "ID is required" },
        { status: 400 }
      );
    }

    if (type === "template") {
      const { name, subject, htmlContent, textContent, variables, isActive } = body;
      const updateData: Record<string, unknown> = {};

      if (name !== undefined) updateData.name = name;
      if (subject !== undefined) updateData.subject = subject;
      if (htmlContent !== undefined) updateData.htmlContent = htmlContent;
      if (textContent !== undefined) updateData.textContent = textContent;
      if (variables !== undefined) updateData.variables = variables;
      if (isActive !== undefined) updateData.isActive = isActive;

      const template = await db.emailTemplate.update({
        where: { id },
        data: updateData
      });

      return NextResponse.json({ success: true, template });
    }

    // Update campaign
    if (action === "SEND") {
      // In production, this would trigger the email sending job
      const campaign = await db.emailCampaign.update({
        where: { id },
        data: {
          status: "SENDING",
          sentAt: new Date()
        }
      });

      return NextResponse.json({ success: true, campaign, message: "Campaign sending started" });
    }

    if (action === "CANCEL") {
      const campaign = await db.emailCampaign.update({
        where: { id },
        data: { status: "CANCELLED" }
      });

      return NextResponse.json({ success: true, campaign });
    }

    // Regular update
    const { name, subject, htmlContent, targetAudience, filters, scheduledFor, status } = body;
    const updateData: Record<string, unknown> = {};

    if (name !== undefined) updateData.name = name;
    if (subject !== undefined) updateData.subject = subject;
    if (htmlContent !== undefined) updateData.htmlContent = htmlContent;
    if (targetAudience !== undefined) updateData.targetAudience = targetAudience;
    if (filters !== undefined) updateData.filters = filters;
    if (scheduledFor !== undefined) updateData.scheduledFor = new Date(scheduledFor);
    if (status !== undefined) updateData.status = status;

    const campaign = await db.emailCampaign.update({
      where: { id },
      data: updateData
    });

    return NextResponse.json({ success: true, campaign });
  } catch (error) {
    console.error("Error updating email:", error);
    return NextResponse.json(
      { error: "Failed to update email" },
      { status: 500 }
    );
  }
}

// DELETE - Delete campaign or template
export async function DELETE(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "campaign";
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "ID is required" },
        { status: 400 }
      );
    }

    if (type === "template") {
      await db.emailTemplate.delete({ where: { id } });
    } else {
      await db.emailCampaign.delete({ where: { id } });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting email:", error);
    return NextResponse.json(
      { error: "Failed to delete email" },
      { status: 500 }
    );
  }
}
