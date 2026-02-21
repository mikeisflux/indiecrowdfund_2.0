import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST - Zero out a backer's DivinityCoin wallet balance
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { pledgeId, projectId } = body;

    if (!pledgeId || !projectId) {
      return NextResponse.json({ error: "pledgeId and projectId are required" }, { status: 400 });
    }

    // Verify user has access to this project
    const project = await db.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { creatorId: session.user.id },
          {
            collaborators: {
              some: {
                userId: session.user.id,
                status: "ACCEPTED",
              },
            },
          },
        ],
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 403 });
    }

    // Get the pledge to find the user
    const pledge = await db.pledge.findFirst({
      where: {
        id: pledgeId,
        projectId,
      },
      select: {
        userId: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            divinityCoinBalance: true,
          },
        },
      },
    });

    if (!pledge) {
      return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
    }

    const currentBalance = Number(pledge.user.divinityCoinBalance);

    if (currentBalance === 0) {
      return NextResponse.json({
        success: true,
        message: "Wallet balance is already zero",
        previousBalance: 0,
        newBalance: 0,
      });
    }

    // Zero out the balance and create an audit transaction
    await db.$transaction([
      db.user.update({
        where: { id: pledge.userId },
        data: { divinityCoinBalance: 0 },
      }),
      db.divinityCoinTransaction.create({
        data: {
          userId: pledge.userId,
          pledgeId,
          amount: -currentBalance,
          type: "ADMIN_ZERO_BALANCE",
          description: `Wallet balance zeroed by creator (${session.user.email || session.user.id}) via IndieKit`,
          metadata: JSON.stringify({
            previousBalance: currentBalance,
            newBalance: 0,
            zeroedBy: session.user.id,
            zeroedByEmail: session.user.email,
            projectId,
            timestamp: new Date().toISOString(),
          }),
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: `Wallet balance zeroed for ${pledge.user.name || pledge.user.email}`,
      previousBalance: currentBalance,
      newBalance: 0,
    });
  } catch (error) {
    console.error("Zero wallet balance error:", error);
    return NextResponse.json(
      { error: "Failed to zero wallet balance" },
      { status: 500 }
    );
  }
}
