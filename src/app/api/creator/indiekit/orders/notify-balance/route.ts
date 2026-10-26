import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendBalanceRequest } from "@/lib/indiekit/balance-request";

const creatorIndiekitOrdersNotifyBalanceLogger = logger.child({ module: "creator-indiekit-orders-notify-balance" });

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { pledgeId, projectId } = body;

    if (!pledgeId || !projectId) {
      return NextResponse.json({ error: "Missing pledgeId or projectId" }, { status: 400 });
    }

    // Verify the user owns or collaborates on this project
    const project = await db.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
        OR: [
          { creatorId: session.user.id },
          { collaborators: { some: { userId: session.user.id, status: "ACCEPTED" } } },
        ],
      },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found or no access" }, { status: 404 });
    }

    const result = await sendBalanceRequest(pledgeId, projectId);
    if (!result.ok) {
      const status = result.error === "Pledge not found" ? 404 : result.error.startsWith("No balance") ? 400 : 500;
      return NextResponse.json({ error: result.error }, { status });
    }
    if (result.deduplicated) {
      return NextResponse.json({
        success: true,
        balanceDue: result.balanceDue,
        emailSent: true,
        deduplicated: true,
        message: "Notification already sent less than a minute ago",
      });
    }
    return NextResponse.json({ success: true, balanceDue: result.balanceDue, emailSent: true });
  } catch (error) {
    creatorIndiekitOrdersNotifyBalanceLogger.error({ err: String(error instanceof Error ? error.stack : error) }, "Error sending balance notification:");
    const message = error instanceof Error ? error.message : "Failed to send balance notification";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
