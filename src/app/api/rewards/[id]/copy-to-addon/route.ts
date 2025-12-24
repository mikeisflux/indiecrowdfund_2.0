import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the reward to copy
    const reward = await db.reward.findUnique({
      where: { id: params.id },
      include: {
        items: true,
        project: {
          select: { creatorId: true, status: true },
        },
      },
    });

    if (!reward) {
      return NextResponse.json({ error: "Reward not found" }, { status: 404 });
    }

    if (reward.project.creatorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!["DRAFT", "SUBMITTED"].includes(reward.project.status)) {
      return NextResponse.json(
        { error: "Cannot modify launched project" },
        { status: 400 }
      );
    }

    if (reward.type !== "TIER") {
      return NextResponse.json(
        { error: "Can only copy tier rewards to add-ons" },
        { status: 400 }
      );
    }

    // Create the add-on copy
    const addon = await db.reward.create({
      data: {
        projectId: reward.projectId,
        type: "ADDON",
        title: `${reward.title} (Add-on)`,
        description: reward.description,
        amount: reward.amount,
        imageUrl: reward.imageUrl,
        estimatedDelivery: reward.estimatedDelivery,
        shippingType: reward.shippingType,
        shippingCountries: reward.shippingCountries,
        shippingCost: reward.shippingCost,
        quantityAvailable: reward.quantityAvailable,
        visibility: reward.visibility,
        copiedFromId: reward.id,
        items: {
          create: reward.items.map((item: { title: string; description: string | null; imageUrl: string | null }) => ({
            title: item.title,
            description: item.description,
            imageUrl: item.imageUrl,
          })),
        },
      },
      include: { items: true },
    });

    // Convert Decimal fields to numbers for JSON serialization
    return NextResponse.json({
      addon: {
        ...addon,
        amount: Number(addon.amount),
      }
    }, { status: 201 });
  } catch (error) {
    console.error("Copy to addon error:", error);
    return NextResponse.json(
      { error: "Failed to copy reward to add-on" },
      { status: 500 }
    );
  }
}
