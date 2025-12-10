import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const rewardSchema = z.object({
  id: z.string().optional(),
  type: z.enum(["TIER", "ADDON"]),
  title: z.string().min(1),
  description: z.string().optional().default(""),
  amount: z.number().min(0),
  imageUrl: z.string().optional().nullable(),
  estimatedDelivery: z.string().optional().nullable(),
  shippingType: z.enum(["NO_SHIPPING", "WORLDWIDE", "SELECTED_COUNTRIES"]),
  shippingCountries: z.array(z.string()).optional().default([]),
  shippingCost: z.record(z.number()).optional().default({}),
  quantityAvailable: z.number().optional().nullable(),
  visibility: z.enum(["PUBLIC", "SECRET"]).optional().default("PUBLIC"),
  isEnded: z.boolean().optional().default(false),
  items: z.array(z.object({
    id: z.string().optional(),
    projectItemId: z.string().optional(), // Reference to ProjectItem
    title: z.string(),
    description: z.string().optional().nullable(),
    imageUrl: z.string().optional().nullable(),
  })).optional().default([]),
});

// Create a new reward
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = await params;

    // Verify project ownership
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { creatorId: true, status: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.creatorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const reward = rewardSchema.parse(body);

    // Strip base64 images
    const stripBase64 = (url?: string | null) =>
      url?.startsWith('data:') ? null : url;

    // Create reward with items (linking to ProjectItem via projectItemId)
    const created = await db.reward.create({
      data: {
        projectId,
        type: reward.type,
        title: reward.title,
        description: reward.description || "",
        amount: reward.amount,
        imageUrl: stripBase64(reward.imageUrl),
        estimatedDelivery: reward.estimatedDelivery ? new Date(reward.estimatedDelivery) : null,
        shippingType: reward.shippingType,
        shippingCountries: reward.shippingCountries,
        shippingCost: reward.shippingCost,
        quantityAvailable: reward.quantityAvailable,
        visibility: reward.visibility,
        isEnded: reward.isEnded,
        items: {
          create: reward.items.map(item => ({
            projectItemId: item.projectItemId || null, // Link to ProjectItem
            title: item.title,
            description: item.description || null,
            imageUrl: stripBase64(item.imageUrl),
          })),
        },
      },
      include: {
        items: true,
      },
    });

    return NextResponse.json({
      success: true,
      reward: created,
    });
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

// Update an existing reward
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = await params;

    // Verify project ownership
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { creatorId: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.creatorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const reward = rewardSchema.parse(body);

    if (!reward.id) {
      return NextResponse.json({ error: "Reward ID required for update" }, { status: 400 });
    }

    // Strip base64 images
    const stripBase64 = (url?: string | null) =>
      url?.startsWith('data:') ? null : url;

    // Update reward and replace items
    const updated = await db.$transaction(async (tx) => {
      // Delete existing items
      await tx.rewardItem.deleteMany({
        where: { rewardId: reward.id },
      });

      // Update reward and create new items (linking to ProjectItem via projectItemId)
      return tx.reward.update({
        where: { id: reward.id },
        data: {
          type: reward.type,
          title: reward.title,
          description: reward.description || "",
          amount: reward.amount,
          imageUrl: stripBase64(reward.imageUrl),
          estimatedDelivery: reward.estimatedDelivery ? new Date(reward.estimatedDelivery) : null,
          shippingType: reward.shippingType,
          shippingCountries: reward.shippingCountries,
          shippingCost: reward.shippingCost,
          quantityAvailable: reward.quantityAvailable,
          visibility: reward.visibility,
          isEnded: reward.isEnded,
          items: {
            create: reward.items.map(item => ({
              projectItemId: item.projectItemId || null, // Link to ProjectItem
              title: item.title,
              description: item.description || null,
              imageUrl: stripBase64(item.imageUrl),
            })),
          },
        },
        include: {
          items: true,
        },
      });
    });

    return NextResponse.json({
      success: true,
      reward: updated,
    });
  } catch (error) {
    console.error("Update reward error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to update reward" },
      { status: 500 }
    );
  }
}

// Delete a reward
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = await params;
    const { searchParams } = new URL(req.url);
    const rewardId = searchParams.get("rewardId");

    if (!rewardId) {
      return NextResponse.json({ error: "Reward ID required" }, { status: 400 });
    }

    // Verify project ownership
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { creatorId: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.creatorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if reward has backers
    const reward = await db.reward.findUnique({
      where: { id: rewardId },
      select: { quantityClaimed: true },
    });

    if (reward && reward.quantityClaimed > 0) {
      return NextResponse.json(
        { error: "Cannot delete reward with backers" },
        { status: 400 }
      );
    }

    // Delete reward items first, then reward
    await db.$transaction([
      db.rewardItem.deleteMany({ where: { rewardId } }),
      db.reward.delete({ where: { id: rewardId } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete reward error:", error);
    return NextResponse.json(
      { error: "Failed to delete reward" },
      { status: 500 }
    );
  }
}
