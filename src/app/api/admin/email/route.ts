import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const adminEmailLogger = logger.child({ module: "admin-email" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendEmail, escapeHtmlForEmail } from "@/lib/email";
import { stripBase64FromHtml } from "@/lib/email/strip-base64-html";

// Force dynamic - this route uses auth/headers
export const dynamic = "force-dynamic";

// Helper to check admin role
async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.id) {
    return { error: "Unauthorized", status: 401 };
  }

  const user = await db.user.findFirst({
    where: { id: session.user.id, deletedAt: null },
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

    // Validate pagination parameters
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20") || 20));

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
    adminEmailLogger.error({ err: formatError(error) }, "Error fetching emails:");
    return NextResponse.json(
      { error: "Failed to fetch email data" },
      { status: 500 }
    );
  }
}

// POST - Create campaign, template, or send single email
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await req.json();
    const { type } = body;

    // Send single email
    if (type === "single" || (!type && body.to)) {
      const { to, subject, body: emailBody } = body;

      if (!to || !subject || !emailBody) {
        return NextResponse.json(
          { error: "To, subject, and body are required" },
          { status: 400 }
        );
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(to)) {
        return NextResponse.json(
          { error: "Invalid email address" },
          { status: 400 }
        );
      }

      // Convert plain text body to simple HTML
      const htmlBody = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            ${escapeHtmlForEmail(emailBody).replace(/\n/g, '<br>')}
          </body>
        </html>
      `;

      const result = await sendEmail({
        to,
        subject,
        html: htmlBody,
        text: emailBody,
      });

      if (result.success) {
        return NextResponse.json({ success: true });
      } else {
        return NextResponse.json(
          { error: result.error || "Failed to send email" },
          { status: 500 }
        );
      }
    }

    if (type === "template") {
      const { name, subject, htmlContent: rawHtml, textContent, variables } = body;

      if (!name || !subject || !rawHtml) {
        return NextResponse.json(
          { error: "Name, subject, and HTML content are required" },
          { status: 400 }
        );
      }

      // Strip base64 images before persisting (prevents DB bloat)
      const { html: htmlContent } = await stripBase64FromHtml(rawHtml);

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
    const { name, subject, htmlContent: rawCampaignHtml, targetAudience, filters, scheduledFor } = body;

    if (!name || !subject || !rawCampaignHtml) {
      return NextResponse.json(
        { error: "Name, subject, and HTML content are required" },
        { status: 400 }
      );
    }

    // Strip base64 images before persisting (prevents DB bloat)
    const { html: htmlContent } = await stripBase64FromHtml(rawCampaignHtml);

    // Calculate recipient count based on target audience
    let recipientCount = 0;
    if (targetAudience === "all") {
      recipientCount = await db.user.count({ where: { deletedAt: null } });
    } else if (targetAudience === "backers") {
      recipientCount = await db.user.count({
        where: { pledges: { some: { deletedAt: null, status: "COMPLETED" } } }
      });
    } else if (targetAudience === "creators") {
      recipientCount = await db.user.count({
        where: { createdProjects: { some: {} }, deletedAt: null }
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
    adminEmailLogger.error({ err: formatError(error) }, "Error creating email:");
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
      // CAS: only transition to SENDING if the campaign is currently DRAFT or SCHEDULED.
      // This prevents double-sends from concurrent requests.
      const result = await db.emailCampaign.updateMany({
        where: { id, status: { in: ["DRAFT", "SCHEDULED"] } },
        data: {
          status: "SENDING",
          sentAt: new Date()
        }
      });

      if (result.count === 0) {
        return NextResponse.json(
          { error: "Campaign has already been sent or is no longer in a sendable state — please refresh." },
          { status: 409 }
        );
      }

      const campaign = await db.emailCampaign.findUnique({ where: { id } });
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
    if (scheduledFor !== undefined && scheduledFor !== null) updateData.scheduledFor = new Date(scheduledFor);
    else if (scheduledFor === null) updateData.scheduledFor = null;
    if (status !== undefined) updateData.status = status;

    const campaign = await db.emailCampaign.update({
      where: { id },
      data: updateData
    });

    return NextResponse.json({ success: true, campaign });
  } catch (error) {
    adminEmailLogger.error({ err: formatError(error) }, "Error updating email:");
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

    // deleteMany for idempotency on concurrent double-clicks.
    if (type === "template") {
      await db.emailTemplate.deleteMany({ where: { id } });
    } else {
      await db.emailCampaign.deleteMany({ where: { id } });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    adminEmailLogger.error({ err: formatError(error) }, "Error deleting email:");
    return NextResponse.json(
      { error: "Failed to delete email" },
      { status: 500 }
    );
  }
}
