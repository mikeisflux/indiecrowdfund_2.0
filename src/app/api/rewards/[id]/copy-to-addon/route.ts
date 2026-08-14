import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const rewardsCopyToAddonLogger = logger.child({ module: "rewards-copy-to-addon" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canUserEditProject } from "@/lib/project-auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the reward to copy
    const reward = await db.reward.findUnique({
      where: { id },
      include: {
        items: true,
        project: {
          select: { id: true, creatorId: true, status: true },
        },
      },
    });

    if (!reward) {
      return NextResponse.json({ error: "Reward not found" }, { status: 404 });
    }

    const canEdit = await canUserEditProject(reward.project.id, session.user.id, reward.project.creatorId);
    if (!canEdit) {
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
        // Carry the category NAME across, not the tier's bucket. Grouping keys
        // on (type, category) and the campaign page splits by type before
        // grouping, so this copy lands in the ADD-ON tab's "Covers" — it cannot
        // show up among the reward pills. That falls out of the type column;
        // nothing here has to rewrite the string to keep the two apart.
        category: reward.category,
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
    rewardsCopyToAddonLogger.error({ err: formatError(error) }, "Copy to addon error:");
    return NextResponse.json(
      { error: "Failed to copy reward to add-on" },
      { status: 500 }
    );
  }
}
