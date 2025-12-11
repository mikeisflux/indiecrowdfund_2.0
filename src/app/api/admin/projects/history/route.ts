import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET - Get review history
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify admin status
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true },
    });

    if (!user?.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      db.projectReview.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          project: {
            select: {
              id: true,
              title: true,
              slug: true,
              status: true,
              creator: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
          },
          reviewer: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      }),
      db.projectReview.count(),
    ]);

    return NextResponse.json({
      reviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching review history:", error);
    return NextResponse.json(
      { error: "Failed to fetch review history" },
      { status: 500 }
    );
  }
}
