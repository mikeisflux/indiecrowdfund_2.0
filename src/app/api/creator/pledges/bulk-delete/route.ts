import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function DELETE(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { pledgeIds } = body;

    if (!pledgeIds || !Array.isArray(pledgeIds) || pledgeIds.length === 0) {
      return NextResponse.json(
        { error: "No pledge IDs provided" },
        { status: 400 }
      );
    }

    // Verify all pledges belong to projects owned by this user and are PENDING
    const pledges = await db.pledge.findMany({
      where: {
        id: { in: pledgeIds },
        status: "PENDING", // Only allow deleting PENDING pledges
      },
      include: {
        project: {
          select: {
            id: true,
            creatorId: true,
          },
        },
      },
    });

    // Filter to only pledges where user is the project creator
    const validPledgeIds = pledges
      .filter((pledge) => pledge.project.creatorId === session.user.id)
      .map((pledge) => pledge.id);

    if (validPledgeIds.length === 0) {
      return NextResponse.json(
        { error: "No valid pledges to delete" },
        { status: 400 }
      );
    }

    // Delete the pledges (and associated records via cascade)
    const deleteResult = await db.pledge.deleteMany({
      where: {
        id: { in: validPledgeIds },
        status: "PENDING", // Double-check status for safety
      },
    });

    return NextResponse.json({
      success: true,
      deletedCount: deleteResult.count,
      message: `${deleteResult.count} pending pledge(s) deleted successfully`,
    });
  } catch (error) {
    console.error("Bulk delete pledges error:", error);
    return NextResponse.json(
      { error: "Failed to delete pledges" },
      { status: 500 }
    );
  }
}
