import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin status
    const currentUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (currentUser?.role !== "ADMIN" && currentUser?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { userId } = await params;

    // Get user's pledges with project and reward info
    const pledges = await db.pledge.findMany({
      where: { userId },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            slug: true,
            imageUrl: true,
            status: true,
          },
        },
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

    // Convert Decimal fields to numbers for JSON serialization
    const serializedPledges = pledges.map(pledge => ({
      ...pledge,
      amount: Number(pledge.amount),
      reward: pledge.reward ? {
        ...pledge.reward,
        amount: Number(pledge.reward.amount),
      } : null,
    }));

    return NextResponse.json({ pledges: serializedPledges });
  } catch (error) {
    console.error("Error fetching user pledges:", error);
    return NextResponse.json(
      { error: "Failed to fetch user pledges" },
      { status: 500 }
    );
  }
}
