import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ vanityname: string; slug: string }> }
) {
  try {
    const { vanityname, slug } = await params;

    // First, find the creator by vanity URL
    const creator = await db.user.findUnique({
      where: { vanityUrl: vanityname },
      select: { id: true },
    });

    if (!creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    const project = await db.project.findFirst({
      where: {
        slug: slug,
        creatorId: creator.id,
      },
      select: {
        currentAmount: true,
        backerCount: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({
      currentAmount: Number(project.currentAmount),
      backerCount: project.backerCount,
    });
  } catch (error) {
    console.error("Get project stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
