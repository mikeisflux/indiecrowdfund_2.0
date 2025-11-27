import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createRewardSchema = z.object({
  projectId: z.string(),
  type: z.enum(["TIER", "ADDON"]).default("TIER"),
  title: z.string().min(1),
  description: z.string().min(1),
  amount: z.number().positive(),
  imageUrl: z.string().optional(),
  estimatedDelivery: z.string().optional(),
  shippingType: z.enum(["WORLDWIDE", "SELECTED_COUNTRIES", "NO_SHIPPING"]),
  shippingCountries: z.array(z.string()).default([]),
  shippingCost: z.number().default(0),
  quantityAvailable: z.number().optional(),
  visibility: z.enum(["PUBLIC", "SECRET"]).default("PUBLIC"),
  items: z.array(z.object({
    title: z.string(),
    description: z.string().optional(),
    imageUrl: z.string().optional(),
  })).default([]),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = createRewardSchema.parse(body);

    // Verify project ownership
    const project = await db.project.findUnique({
      where: { id: data.projectId },
      select: { creatorId: true, status: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.creatorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!["DRAFT", "SUBMITTED"].includes(project.status)) {
      return NextResponse.json(
        { error: "Cannot modify launched project rewards" },
        { status: 400 }
      );
    }

    const { items, ...rewardData } = data;

    const reward = await db.reward.create({
      data: {
        ...rewardData,
        estimatedDelivery: rewardData.estimatedDelivery
          ? new Date(rewardData.estimatedDelivery)
          : null,
        items: {
          create: items,
        },
      },
      include: { items: true },
    });

    return NextResponse.json({ reward }, { status: 201 });
  } catch (error) {
    console.error("Create reward error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to create reward" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID required" },
        { status: 400 }
      );
    }

    const rewards = await db.reward.findMany({
      where: { projectId },
      include: { items: true },
      orderBy: [{ type: "asc" }, { amount: "asc" }],
    });

    return NextResponse.json({ rewards });
  } catch (error) {
    console.error("Get rewards error:", error);
    return NextResponse.json(
      { error: "Failed to fetch rewards" },
      { status: 500 }
    );
  }
}
