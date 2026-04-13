import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminUsersPledgesLogger = logger.child({ module: "admin-users-pledges" });
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
    const currentUser = await db.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
      select: { role: true },
    });

    if (currentUser?.role !== "ADMIN" && currentUser?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { userId } = await params;

    // Get user's pledges with project and reward info
    const pledges = await db.pledge.findMany({
      where: { userId, deletedAt: null },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            slug: true,
            imageUrl: true,
            status: true,
            creator: {
              select: { vanityUrl: true },
            },
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
    // and flatten creator vanity URL onto the project for easy access
    const serializedPledges = pledges.map((pledge) => ({
      ...pledge,
      amount: Number(pledge.amount),
      project: {
        id: pledge.project.id,
        title: pledge.project.title,
        slug: pledge.project.slug,
        imageUrl: pledge.project.imageUrl,
        status: pledge.project.status,
        creatorVanityUrl: pledge.project.creator?.vanityUrl || null,
      },
      reward: pledge.reward ? {
        ...pledge.reward,
        amount: Number(pledge.reward.amount),
      } : null,
    }));

    return NextResponse.json({ pledges: serializedPledges });
  } catch (error) {
    adminUsersPledgesLogger.error({ err: String(error) }, "Error fetching user pledges:");
    return NextResponse.json(
      { error: "Failed to fetch user pledges" },
      { status: 500 }
    );
  }
}
