import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { projectId, action, fileId, triggerType, triggerProduct, requirePayment } = body;

    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 });
    }

    // Verify user has access to this project
    const project = await db.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { creatorId: session.user.id },
          { collaborators: { some: { userId: session.user.id } } },
        ],
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
    }

    if (action === "create_distribution_rule") {
      if (!fileId) {
        return NextResponse.json({ error: "File ID required" }, { status: 400 });
      }

      // Get the file
      const file = await db.digitalFile.findFirst({
        where: { id: fileId, projectId },
      });

      if (!file) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }

      // Update distribution settings based on triggerType
      let accessType: "ALL_BACKERS" | "SPECIFIC_REWARDS" | "ADDON_PURCHASERS" = "ALL_BACKERS";
      let rewardIds = file.rewardIds || [];
      let addonIds = file.addonIds || [];

      if (triggerType === "all") {
        accessType = "ALL_BACKERS";
        // Clear specific IDs when setting to all
        rewardIds = [];
        addonIds = [];
      } else if (triggerType === "rewards" && triggerProduct) {
        accessType = "SPECIFIC_REWARDS";
        // Extract ID from "reward:xxx" format
        const rewardId = triggerProduct.replace("reward:", "");
        if (!rewardIds.includes(rewardId)) {
          rewardIds = [...rewardIds, rewardId];
        }
      } else if (triggerType === "addons" && triggerProduct) {
        accessType = "ADDON_PURCHASERS";
        // Extract ID from "addon:xxx" format
        const addonId = triggerProduct.replace("addon:", "");
        if (!addonIds.includes(addonId)) {
          addonIds = [...addonIds, addonId];
        }
      }

      // Update the file
      const updatedFile = await db.digitalFile.update({
        where: { id: fileId },
        data: {
          accessType,
          rewardIds,
          addonIds,
        },
      });

      // Count eligible backers based on access type
      let totalEligible = 0;
      if (accessType === "ALL_BACKERS") {
        totalEligible = await db.pledge.count({
          where: {
            projectId,
            status: requirePayment ? "COMPLETED" : { in: ["COMPLETED", "PENDING"] },
          },
        });
      } else if (accessType === "SPECIFIC_REWARDS" && rewardIds.length > 0) {
        totalEligible = await db.pledge.count({
          where: {
            projectId,
            rewardId: { in: rewardIds },
            status: requirePayment ? "COMPLETED" : { in: ["COMPLETED", "PENDING"] },
          },
        });
      } else if (accessType === "ADDON_PURCHASERS" && addonIds.length > 0) {
        totalEligible = await db.pledge.count({
          where: {
            projectId,
            addons: { some: { addonId: { in: addonIds } } },
            status: requirePayment ? "COMPLETED" : { in: ["COMPLETED", "PENDING"] },
          },
        });
      }

      // Update eligible count
      await db.digitalFile.update({
        where: { id: fileId },
        data: { totalEligible },
      });

      return NextResponse.json({
        success: true,
        file: updatedFile,
        totalEligible,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("IndieKit digital API error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
