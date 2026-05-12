import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkEmailAccess } from "@/lib/auth/email-access";
import { logger } from "@/lib/logger";
import { stripBase64FromHtml } from "@/lib/email/strip-base64-html";

const campaignLogger = logger.child({ module: "campaigns" });

/**
 * Returns the campaign if the caller can act on it (edit, send, delete),
 * or null if they have no access. A campaign is accessible to:
 *   1. The user who originally created the row (createdBy match), AND
 *   2. The creator of the project the campaign was sent for, AND
 *   3. Any accepted collaborator on that project.
 *
 * Used by every per-campaign action below so collaborators can manage
 * campaigns the project owner sent for the shared project.
 */
async function loadCampaignForUser(campaignId: string, userId: string) {
  const campaign = await db.emailCampaign.findUnique({
    where: { id: campaignId },
  });
  if (!campaign) return null;

  if (campaign.createdBy === userId) return campaign;

  const f = (campaign.filters || {}) as { projectId?: string };
  if (!f.projectId) return null;

  const project = await db.project.findFirst({
    where: { id: f.projectId, deletedAt: null },
    select: { creatorId: true },
  });
  if (!project) return null;

  if (project.creatorId === userId) return campaign;

  const collaborator = await db.projectCollaborator.findFirst({
    where: { projectId: f.projectId, userId, status: "ACCEPTED" },
    select: { id: true },
  });
  return collaborator ? campaign : null;
}

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
    const campaignId = searchParams.get("campaignId");

    // Build the list of project IDs the caller can access (owned + any
    // they're an accepted collaborator on). Used to widen the
    // campaign-list visibility so a collaborator can see / edit /
    // resend campaigns the project owner sent for the shared project,
    // not just campaigns they personally created.
    const accessibleProjects = await db.project.findMany({
      where: {
        deletedAt: null,
        OR: [
          { creatorId: session.user.id },
          {
            collaborators: {
              some: { userId: session.user.id, status: "ACCEPTED" },
            },
          },
        ],
      },
      select: { id: true },
    });
    const accessibleProjectIds = accessibleProjects.map((p) => p.id);

    // Single-campaign fetch (used by /dashboard/indiekit/emails/[id]/edit).
    // Authorize on EITHER createdBy match OR filters.projectId being a
    // project the caller can edit / collaborate on, OR the caller is
    // a platform admin (so support / moderation can view any campaign
    // without being added as a collaborator on the project).
    if (campaignId) {
      const campaign = await db.emailCampaign.findUnique({
        where: { id: campaignId },
      });
      if (!campaign) {
        return NextResponse.json(
          { error: "Campaign not found or access denied" },
          { status: 404 }
        );
      }
      const isOriginalCreator = campaign.createdBy === session.user.id;
      const f = (campaign.filters || {}) as { projectId?: string };
      const isProjectCollaborator =
        !!f.projectId && accessibleProjectIds.includes(f.projectId);
      const isPlatformAdmin =
        session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
      if (!isOriginalCreator && !isProjectCollaborator && !isPlatformAdmin) {
        return NextResponse.json(
          { error: "Campaign not found or access denied" },
          { status: 404 }
        );
      }
      return NextResponse.json({ campaign, campaigns: [campaign] });
    }

    // List query: include campaigns the caller created PLUS campaigns
    // for projects they collaborate on. Prisma's JSON path filter
    // can't do `in`, so we OR one path-equals per accessible project.
    const visibilityOr = [
      { createdBy: session.user.id },
      ...accessibleProjectIds.map((pid) => ({
        filters: {
          path: ["projectId"],
          equals: pid,
        },
      })),
    ];

    const campaigns = await db.emailCampaign.findMany({
      where: {
        AND: [
          { OR: visibilityOr },
          ...(projectId
            ? [
                {
                  filters: {
                    path: ["projectId"],
                    equals: projectId,
                  },
                },
              ]
            : []),
        ],
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
    const rawHtmlContent = body.body || content || "";
    // Strip base64 images from the HTML before persisting — TipTap's
    // allowBase64:true in the email editor lets users drag-drop images
    // that get embedded as data: URIs. Extracting to disk files keeps
    // EmailCampaign.htmlContent rows from bloating by MBs per image.
    const { html: htmlContent } = await stripBase64FromHtml(rawHtmlContent);

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
      // Check accessibility (creator, project owner, or collaborator)
      // before updating so the existing creator-only scope doesn't
      // block legitimate edits by a project collaborator.
      const existing = await loadCampaignForUser(campaignId, session.user.id);
      if (!existing) {
        return NextResponse.json({ error: "Campaign not found or access denied" }, { status: 403 });
      }

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

      // Get campaign — scope to owner
      const campaign = await db.emailCampaign.findFirst({
        where: { id: campaignId, createdBy: session.user.id },
      });

      if (!campaign) {
        return NextResponse.json({ error: "Campaign not found or access denied" }, { status: 403 });
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

      // Mark as sending with a CAS guard — the status check above is
      // TOCTOU. Two concurrent sends (double-click, retry) would both
      // pass the check and both queue background send jobs.
      const sendCas = await db.emailCampaign.updateMany({
        where: {
          id: campaignId,
          createdBy: session.user.id,
          status: { notIn: ["SENDING", "SENT"] },
        },
        data: {
          status: "SENDING",
          sentAt: new Date(),
        },
      });

      if (sendCas.count === 0) {
        return NextResponse.json({ error: "Campaign has already been sent" }, { status: 400 });
      }

      return NextResponse.json({ success: true, message: "Campaign queued for sending" });
    }

    if (action === "delete" && campaignId) {
      // Allow project collaborators to delete campaigns on the shared
      // project, not just the original creator.
      const existing = await loadCampaignForUser(campaignId, session.user.id);
      if (!existing) {
        return NextResponse.json({ error: "Campaign not found or access denied" }, { status: 403 });
      }
      await db.emailCampaign.delete({ where: { id: campaignId } });
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

    // Authorize via the shared loadCampaignForUser helper so project
    // collaborators (not just the original campaign creator) can delete
    // campaigns sent for the shared project. Mirrors the POST action=
    // delete path which already does this.
    const existing = await loadCampaignForUser(campaignId, session.user.id);
    if (!existing) {
      return NextResponse.json({ error: "Campaign not found or access denied" }, { status: 404 });
    }

    // If the caller specified a projectId, double-check the campaign
    // actually belongs to that project (UI guard against deleting a
    // campaign from one project tab while the URL says another).
    if (projectId) {
      const f = (existing.filters || {}) as { projectId?: string };
      if (f.projectId && f.projectId !== projectId) {
        return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
      }
    }

    await db.emailCampaign.delete({ where: { id: campaignId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    campaignLogger.error({ err: error instanceof Error ? error.message : String(error) }, "Campaigns DELETE error");
    return NextResponse.json({ error: "Failed to delete campaign" }, { status: 500 });
  }
}
