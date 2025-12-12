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
    const pledge = await db.pledge.findFirst({
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

    if (!pledge) {
      return NextResponse.json({ hasPledge: false, pledge: null, isFunded });
    }

    return NextResponse.json({
      hasPledge: true,
      isFunded,
      pledge: {
        id: pledge.id,
        amount: pledge.amount,
        status: pledge.status,
        reward: pledge.reward ? {
          id: pledge.reward.id,
          title: pledge.reward.title,
          amount: pledge.reward.amount,
        } : null,
        createdAt: pledge.createdAt,
        // Can only cancel if project is NOT funded and pledge is pending
        canCancel: !isFunded && pledge.status === "PENDING",
        // Can always add more to pledge
        canIncrease: true,
      },
    });
  } catch (error) {
    console.error("Check pledge error:", error);
    return NextResponse.json(
      { error: "Failed to check pledge status" },
      { status: 500 }
    );
  }
}
