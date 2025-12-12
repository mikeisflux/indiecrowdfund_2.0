import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Check if user has an existing pledge for a project
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ hasPledge: false, pledge: null });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 });
    }

    // Get project to check if funded
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { currentAmount: true, goalAmount: true, status: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const isFunded = project.currentAmount >= project.goalAmount || project.status === "FUNDED";

    // Find any active pledge for this user/project
    // Includes COMPLETED pledges and PENDING pledges with saved payment method
    const activePledge = await db.pledge.findFirst({
      where: {
        userId: session.user.id,
        projectId,
        OR: [
          { status: "COMPLETED" },
          {
            status: "PENDING",
            stripePaymentMethodId: { not: null },
          },
        ],
      },
      include: {
        reward: {
          select: {
            id: true,
            title: true,
            amount: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (activePledge) {
      return NextResponse.json({
        hasPledge: true,
        isFunded,
        pledge: {
          id: activePledge.id,
          amount: activePledge.amount,
          status: activePledge.status,
          reward: activePledge.reward ? {
            id: activePledge.reward.id,
            title: activePledge.reward.title,
            amount: activePledge.reward.amount,
          } : null,
          createdAt: activePledge.createdAt,
          // Can only cancel if project is NOT funded and pledge is pending
          canCancel: !isFunded && activePledge.status === "PENDING",
          // Can always add more to pledge
          canIncrease: true,
        },
      });
    }

    // Also check for pledges in progress (checkout started but not completed)
    // This helps show "Manage Pledge" for recent checkouts that may still complete
    const pendingCheckout = await db.pledge.findFirst({
      where: {
        userId: session.user.id,
        projectId,
        status: "PENDING",
        stripePaymentMethodId: null,
        // Has an intent (checkout was started)
        OR: [
          { stripeSetupIntentId: { not: null } },
          { stripePaymentIntentId: { not: null } },
        ],
        // Created within last 30 minutes
        createdAt: {
          gte: new Date(Date.now() - 30 * 60 * 1000),
        },
      },
      include: {
        reward: {
          select: {
            id: true,
            title: true,
            amount: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (pendingCheckout) {
      return NextResponse.json({
        hasPledge: true,
        checkoutInProgress: true,
        isFunded,
        pledge: {
          id: pendingCheckout.id,
          amount: pendingCheckout.amount,
          status: "CHECKOUT_IN_PROGRESS",
          reward: pendingCheckout.reward ? {
            id: pendingCheckout.reward.id,
            title: pendingCheckout.reward.title,
            amount: pendingCheckout.reward.amount,
          } : null,
          createdAt: pendingCheckout.createdAt,
          canCancel: true, // Can cancel checkout in progress
          canIncrease: false, // Must complete checkout first
        },
      });
    }

    return NextResponse.json({ hasPledge: false, pledge: null, isFunded });
  } catch (error) {
    console.error("Check pledge error:", error);
    return NextResponse.json(
      { error: "Failed to check pledge status" },
      { status: 500 }
    );
  }
}
