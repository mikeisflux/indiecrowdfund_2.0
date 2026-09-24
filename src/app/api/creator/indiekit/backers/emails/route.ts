import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { getProjectAccess } from "@/lib/auth/collaborator";

const backerEmailsLogger = logger.child({ module: "creator-indiekit-backer-emails" });

/**
 * Email history for one backer (pledge) — subjects, types, sent/opened
 * times from EmailLog. Backs the backer dialog's Emails tab, which used
 * to be a static "history will appear here" placeholder.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const pledgeId = searchParams.get("pledgeId");
    if (!projectId || !pledgeId) {
      return NextResponse.json({ error: "projectId and pledgeId required" }, { status: 400 });
    }

    const access = await getProjectAccess(projectId, session.user.id, "canManageCommunity");
    if (!access) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
    }

    const pledge = await db.pledge.findFirst({
      where: { id: pledgeId, projectId, deletedAt: null },
      select: { id: true, user: { select: { email: true } } },
    });
    if (!pledge) {
      return NextResponse.json({ error: "Backer not found" }, { status: 404 });
    }

    // By pledge id, plus campaign emails sent to the backer's address
    // for this project (those log with projectId but no pledgeId).
    const emails = await db.emailLog.findMany({
      where: {
        OR: [
          { pledgeId },
          ...(pledge.user.email
            ? [{ projectId, recipientEmail: pledge.user.email }]
            : []),
        ],
      },
      orderBy: { sentAt: "desc" },
      take: 50,
      select: { id: true, type: true, subject: true, sentAt: true, openedAt: true },
    });

    return NextResponse.json({ emails });
  } catch (error) {
    backerEmailsLogger.error({ err: formatError(error) }, "Backer email history failed");
    return NextResponse.json({ error: "Failed to load email history" }, { status: 500 });
  }
}
