import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { processPendingPledgesForProject } from "@/lib/payments/stripe";

export const dynamic = "force-dynamic";

// POST - Manually trigger charging pending pledges for a funded project
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin status
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { projectId } = await params;

    // Get the project
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        title: true,
        status: true,
        currentAmount: true,
        goalAmount: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Check if project has reached its funding goal
    const isFunded = project.currentAmount >= project.goalAmount;

    if (!isFunded) {
      return NextResponse.json({
        error: "Project has not reached its funding goal yet",
        currentAmount: project.currentAmount,
        goalAmount: project.goalAmount,
        percentFunded: Math.round((project.currentAmount / project.goalAmount) * 100),
      }, { status: 400 });
    }

    // Count pending pledges before processing
    const pendingCount = await db.pledge.count({
      where: {
        projectId,
        status: "PENDING",
        chargedImmediately: false,
        stripePaymentMethodId: { not: null },
      },
    });

    if (pendingCount === 0) {
      return NextResponse.json({
        success: true,
        message: "No pending pledges to process",
        processed: 0,
        successful: 0,
        failed: 0,
      });
    }

    // Process pending pledges (charge saved cards)
    const results = await processPendingPledgesForProject(projectId);

    return NextResponse.json({
      success: true,
      message: `Processed ${results.total} pending pledges`,
      projectTitle: project.title,
      ...results,
    });
  } catch (error) {
    console.error("Process pledges error:", error);
    return NextResponse.json(
      { error: "Failed to process pledges" },
      { status: 500 }
    );
  }
}

// GET - Check status of pending pledges for a project
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin status
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { projectId } = await params;

    // Get the project
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        title: true,
        status: true,
        currentAmount: true,
        goalAmount: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Get pledge statistics
    const [pendingWithCard, pendingWithoutCard, completed, failed] = await Promise.all([
      db.pledge.count({
        where: {
          projectId,
          status: "PENDING",
          stripePaymentMethodId: { not: null },
        },
      }),
      db.pledge.count({
        where: {
          projectId,
          status: "PENDING",
          stripePaymentMethodId: null,
        },
      }),
      db.pledge.count({
        where: {
          projectId,
          status: "COMPLETED",
        },
      }),
      db.pledge.count({
        where: {
          projectId,
          status: "FAILED",
        },
      }),
    ]);

    const isFunded = project.currentAmount >= project.goalAmount;

    return NextResponse.json({
      projectTitle: project.title,
      projectStatus: project.status,
      currentAmount: project.currentAmount,
      goalAmount: project.goalAmount,
      isFunded,
      percentFunded: Math.round((project.currentAmount / project.goalAmount) * 100),
      pledges: {
        pendingWithCard,
        pendingWithoutCard,
        completed,
        failed,
        total: pendingWithCard + pendingWithoutCard + completed + failed,
      },
      canProcessPledges: isFunded && pendingWithCard > 0,
    });
  } catch (error) {
    console.error("Get pledge status error:", error);
    return NextResponse.json(
      { error: "Failed to get pledge status" },
      { status: 500 }
    );
  }
}
