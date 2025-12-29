import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET distribution rules for a project
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const ruleId = searchParams.get("ruleId");

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

    // If ruleId is provided, return just that rule (for refresh)
    if (ruleId) {
      const rule = await db.distributionRule.findFirst({
        where: { id: ruleId, projectId },
        include: {
          digitalFile: {
            select: { name: true },
          },
        },
      });

      if (!rule) {
        return NextResponse.json({ error: "Rule not found" }, { status: 404 });
      }

      // Get trigger product name
      let triggerProductName = "All Backers";
      if (rule.triggerType === "SPECIFIC_REWARD" && rule.triggerRewardId) {
        const reward = await db.reward.findUnique({
          where: { id: rule.triggerRewardId },
          select: { title: true },
        });
        triggerProductName = reward?.title || "Unknown Reward";
      } else if (rule.triggerType === "SPECIFIC_ADDON" && rule.triggerAddonId) {
        const addon = await db.reward.findUnique({
          where: { id: rule.triggerAddonId },
          select: { title: true },
        });
        triggerProductName = addon?.title || "Unknown Add-on";
      }

      return NextResponse.json({
        rule: {
          id: rule.id,
          name: rule.name,
          condition: rule.triggerType,
          triggerProduct: triggerProductName,
          distributeFile: rule.digitalFile?.name || "Unknown File",
          requiresPayment: rule.requiresPayment,
          status: rule.status.toLowerCase().replace("_", "_") as "not_started" | "started" | "completed",
          distributedCount: rule.distributedCount,
          totalEligible: rule.totalEligible,
          startedAt: rule.startedAt?.toISOString(),
        },
      });
    }

    // Get all distribution rules for the project
    const rules = await db.distributionRule.findMany({
      where: { projectId },
      include: {
        digitalFile: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Transform rules to expected format
    type RuleWithFile = typeof rules[number];
    const formattedRules = await Promise.all(
      rules.map(async (rule: RuleWithFile) => {
        let triggerProductName = "All Backers";
        if (rule.triggerType === "SPECIFIC_REWARD" && rule.triggerRewardId) {
          const reward = await db.reward.findUnique({
            where: { id: rule.triggerRewardId },
            select: { title: true },
          });
          triggerProductName = reward?.title || "Unknown Reward";
        } else if (rule.triggerType === "SPECIFIC_ADDON" && rule.triggerAddonId) {
          const addon = await db.reward.findUnique({
            where: { id: rule.triggerAddonId },
            select: { title: true },
          });
          triggerProductName = addon?.title || "Unknown Add-on";
        }

        return {
          id: rule.id,
          name: rule.name,
          condition: rule.triggerType,
          triggerProduct: triggerProductName,
          distributeFile: rule.digitalFile?.name || "Unknown File",
          requiresPayment: rule.requiresPayment,
          status: rule.status.toLowerCase().replace("_", "_") as "not_started" | "started" | "completed",
          distributedCount: rule.distributedCount,
          totalEligible: rule.totalEligible,
          startedAt: rule.startedAt?.toISOString(),
        };
      })
    );

    return NextResponse.json({ rules: formattedRules });
  } catch (error) {
    console.error("IndieKit digital GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch distribution rules" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { projectId, action, fileId, triggerType, triggerProduct, requirePayment, ruleName, ruleIds } = body;

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

    // Handle creating a distribution rule
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

      // Determine trigger type and IDs
      let dbTriggerType: "ALL_BACKERS" | "SPECIFIC_REWARD" | "SPECIFIC_ADDON" = "ALL_BACKERS";
      let triggerRewardId: string | null = null;
      let triggerAddonId: string | null = null;

      if (triggerType === "rewards" && triggerProduct) {
        dbTriggerType = "SPECIFIC_REWARD";
        triggerRewardId = triggerProduct.replace("reward:", "");
      } else if (triggerType === "addons" && triggerProduct) {
        dbTriggerType = "SPECIFIC_ADDON";
        triggerAddonId = triggerProduct.replace("addon:", "");
      }

      // Count eligible backers
      let totalEligible = 0;
      if (dbTriggerType === "ALL_BACKERS") {
        totalEligible = await db.pledge.count({
          where: {
            projectId,
            status: requirePayment ? "COMPLETED" : { in: ["COMPLETED", "PENDING"] },
            deletedAt: null,
          },
        });
      } else if (dbTriggerType === "SPECIFIC_REWARD" && triggerRewardId) {
        totalEligible = await db.pledge.count({
          where: {
            projectId,
            rewardId: triggerRewardId,
            status: requirePayment ? "COMPLETED" : { in: ["COMPLETED", "PENDING"] },
            deletedAt: null,
          },
        });
      } else if (dbTriggerType === "SPECIFIC_ADDON" && triggerAddonId) {
        totalEligible = await db.pledge.count({
          where: {
            projectId,
            addons: { some: { addonId: triggerAddonId } },
            status: requirePayment ? "COMPLETED" : { in: ["COMPLETED", "PENDING"] },
            deletedAt: null,
          },
        });
      }

      // Generate rule name if not provided
      let name = ruleName;
      if (!name) {
        if (dbTriggerType === "ALL_BACKERS") {
          name = `Distribute ${file.name} to all backers`;
        } else if (dbTriggerType === "SPECIFIC_REWARD" && triggerRewardId) {
          const reward = await db.reward.findUnique({
            where: { id: triggerRewardId },
            select: { title: true },
          });
          name = `Distribute ${file.name} to ${reward?.title || "reward"} backers`;
        } else if (dbTriggerType === "SPECIFIC_ADDON" && triggerAddonId) {
          const addon = await db.reward.findUnique({
            where: { id: triggerAddonId },
            select: { title: true },
          });
          name = `Distribute ${file.name} to ${addon?.title || "addon"} purchasers`;
        }
      }

      // Create the distribution rule
      const rule = await db.distributionRule.create({
        data: {
          projectId,
          digitalFileId: fileId,
          name: name || `Distribution rule for ${file.name}`,
          triggerType: dbTriggerType,
          triggerRewardId,
          triggerAddonId,
          requiresPayment: requirePayment || false,
          totalEligible,
        },
      });

      // Also update the DigitalFile for backwards compatibility
      let accessType: "ALL_BACKERS" | "SPECIFIC_REWARDS" | "SPECIFIC_ADDONS" = "ALL_BACKERS";
      if (dbTriggerType === "SPECIFIC_REWARD") {
        accessType = "SPECIFIC_REWARDS";
      } else if (dbTriggerType === "SPECIFIC_ADDON") {
        accessType = "SPECIFIC_ADDONS";
      }

      await db.digitalFile.update({
        where: { id: fileId },
        data: {
          accessType,
          rewardIds: triggerRewardId ? [triggerRewardId] : [],
          addonIds: triggerAddonId ? [triggerAddonId] : [],
          totalEligible,
        },
      });

      return NextResponse.json({
        success: true,
        rule: {
          id: rule.id,
          name: rule.name,
          condition: rule.triggerType,
          triggerProduct: triggerType === "all" ? "All Backers" : triggerProduct,
          distributeFile: file.name,
          requiresPayment: rule.requiresPayment,
          status: "not_started",
          distributedCount: 0,
          totalEligible,
        },
      });
    }

    // Handle starting all distributions
    if (action === "start_all_distributions" && ruleIds && Array.isArray(ruleIds)) {
      const updatedRules = await db.distributionRule.updateMany({
        where: {
          id: { in: ruleIds },
          projectId,
          status: "NOT_STARTED",
        },
        data: {
          status: "STARTED",
          startedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        updatedCount: updatedRules.count,
      });
    }

    // Handle blast notifications
    if (action === "blast_notifications") {
      // Count eligible backers with digital downloads
      const count = await db.pledge.count({
        where: {
          projectId,
          status: "COMPLETED",
          deletedAt: null,
        },
      });

      // TODO: Actually queue notification emails here

      return NextResponse.json({
        success: true,
        count,
      });
    }

    // Handle distribute file
    if (action === "distribute_file" && fileId) {
      const file = await db.digitalFile.findFirst({
        where: { id: fileId, projectId },
      });

      if (!file) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }

      // TODO: Create DigitalDistribution records for eligible backers

      return NextResponse.json({
        success: true,
        message: `Distribution started for ${file.name}`,
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

// DELETE a distribution rule
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const ruleId = searchParams.get("ruleId");

    if (!projectId || !ruleId) {
      return NextResponse.json({ error: "Project ID and Rule ID required" }, { status: 400 });
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

    // Delete the rule
    await db.distributionRule.delete({
      where: { id: ruleId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("IndieKit digital DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete distribution rule" },
      { status: 500 }
    );
  }
}
