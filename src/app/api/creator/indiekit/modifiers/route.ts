import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const creatorIndiekitModifiersLogger = logger.child({ module: "creator-indiekit-modifiers" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET - Get modifier addons and assignment status for a project
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 });
    }

    // Verify user has access to this project
    const project = await db.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
        OR: [
          { creatorId: session.user.id },
          { collaborators: { some: { userId: session.user.id, status: "ACCEPTED" } } },
        ],
      },
      include: {
        rewards: {
          select: {
            id: true,
            title: true,
            type: true,
            isModifier: true,
            modifiesRewardIds: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
    }

    // Get all modifier addons
    const modifierAddons = project.rewards.filter((r: { type: string; isModifier: boolean | null }) => r.type === "ADDON" && r.isModifier);

    // Get all tier rewards (base rewards that can be modified)
    const tierRewards = project.rewards.filter((r: { type: string }) => r.type === "TIER");

    // Get pledges that have modifier addons. Committed-PENDING filter
    // matches the rest of IndieKit so modifier assignments cover the
    // same backer set as the main backer list.
    const pledgesWithModifiers = await db.pledge.findMany({
      where: {
        projectId,
        deletedAt: null,
        addons: {
          some: {
            addon: {
              isModifier: true,
            },
          },
        },
        OR: [
          { status: "COMPLETED" },
          { status: "PENDING", confirmationEmailSent: true },
        ],
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        reward: {
          select: { id: true, title: true },
        },
        addons: {
          include: {
            addon: {
              select: { id: true, title: true, isModifier: true },
            },
          },
        },
        modifierAssignments: true,
      },
    });

    // Analyze each pledge for assignment status
    const pledgeAnalysis = pledgesWithModifiers.map(pledge => {
      const modifierAddonsPurchased = pledge.addons
        .filter((a: { addon: { isModifier: boolean } }) => a.addon.isModifier)
        .map((a: { addon: { id: string; title: string }; quantity: number }) => ({ id: a.addon.id, title: a.addon.title, quantity: a.quantity }));

      const baseReward = pledge.reward;
      const existingAssignments = pledge.modifierAssignments;

      // Determine if assignment is needed and possible
      let status: "assigned" | "auto_assignable" | "needs_manual" | "no_base_reward" = "needs_manual";

      if (!baseReward) {
        status = "no_base_reward";
      } else if (existingAssignments.length === modifierAddonsPurchased.reduce((sum: number, m: { quantity: number }) => sum + m.quantity, 0)) {
        status = "assigned";
      } else if (modifierAddonsPurchased.length === 1 && modifierAddonsPurchased[0].quantity === 1) {
        // Simple case: one modifier addon, one base reward
        status = "auto_assignable";
      }

      return {
        pledgeId: pledge.id,
        backerNumber: pledge.backerNumber,
        user: pledge.user,
        baseReward,
        modifierAddons: modifierAddonsPurchased,
        existingAssignments: existingAssignments.map((a: { id: string; rewardId: string; modifierAddonId: string; isAutoAssigned: boolean }) => ({
          id: a.id,
          rewardId: a.rewardId,
          modifierAddonId: a.modifierAddonId,
          isAutoAssigned: a.isAutoAssigned,
        })),
        status,
        needsModifierAssignment: pledge.needsModifierAssignment,
      };
    });

    // Get modifier SKU mappings
    const modifierSkuMappings = await db.modifierSkuMapping.findMany({
      where: { projectId },
    });

    return NextResponse.json({
      modifierAddons,
      tierRewards,
      pledgeAnalysis,
      modifierSkuMappings,
      stats: {
        totalPledgesWithModifiers: pledgesWithModifiers.length,
        assigned: pledgeAnalysis.filter(p => p.status === "assigned").length,
        autoAssignable: pledgeAnalysis.filter(p => p.status === "auto_assignable").length,
        needsManual: pledgeAnalysis.filter(p => p.status === "needs_manual").length,
      },
    });
  } catch (error) {
    creatorIndiekitModifiersLogger.error({ err: formatError(error) }, "Modifier GET error:");
    return NextResponse.json({ error: "Failed to fetch modifier data" }, { status: 500 });
  }
}

// POST - Assign modifiers (auto or manual)
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { projectId, action } = body;

    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 });
    }

    // Verify user has access to this project
    const project = await db.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
        OR: [
          { creatorId: session.user.id },
          { collaborators: { some: { userId: session.user.id, status: "ACCEPTED" } } },
        ],
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
    }

    // AUTO-ASSIGN all simple cases
    if (action === "auto_assign_all") {
      // Get all pledges with modifier addons that don't have assignments yet.
      // Same committed-PENDING filter as the read path.
      const pledges = await db.pledge.findMany({
        where: {
          projectId,
          deletedAt: null,
          addons: {
            some: {
              addon: { isModifier: true },
            },
          },
          OR: [
            { status: "COMPLETED" },
            { status: "PENDING", confirmationEmailSent: true },
            ],
        },
        include: {
          reward: true,
          addons: {
            include: {
              addon: true,
            },
          },
          modifierAssignments: true,
        },
      });

      let autoAssigned = 0;
      let flaggedForManual = 0;

      for (const pledge of pledges) {
        const modifierAddons = pledge.addons.filter((a: { addon: { isModifier: boolean } }) => a.addon.isModifier);
        const baseReward = pledge.reward;

        // Skip if no base reward
        if (!baseReward) {
          continue;
        }

        // Skip if already has assignments for all modifiers
        const totalModifierQuantity = modifierAddons.reduce((sum: number, a: { quantity: number }) => sum + a.quantity, 0);
        if (pledge.modifierAssignments.length >= totalModifierQuantity) {
          continue;
        }

        // Simple case: one modifier addon with quantity 1, one base reward
        if (modifierAddons.length === 1 && modifierAddons[0].quantity === 1) {
          // Check if this assignment already exists
          const existingAssignment = await db.pledgeModifierAssignment.findFirst({
            where: {
              pledgeId: pledge.id,
              modifierAddonId: modifierAddons[0].addonId,
            },
          });

          if (!existingAssignment) {
            await db.pledgeModifierAssignment.create({
              data: {
                pledgeId: pledge.id,
                rewardId: baseReward.id,
                modifierAddonId: modifierAddons[0].addonId,
                isAutoAssigned: true,
              },
            });

            // Clear the needsModifierAssignment flag
            await db.pledge.update({
              where: { id: pledge.id },
              data: { needsModifierAssignment: false },
            });

            autoAssigned++;
          }
        } else {
          // Complex case: flag for manual assignment
          if (!pledge.needsModifierAssignment) {
            await db.pledge.update({
              where: { id: pledge.id },
              data: { needsModifierAssignment: true },
            });
            flaggedForManual++;
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: `Auto-assigned ${autoAssigned} pledges, flagged ${flaggedForManual} for manual assignment`,
        autoAssigned,
        flaggedForManual,
      });
    }

    // MANUAL ASSIGN - assign a specific modifier to a specific reward for a pledge
    if (action === "manual_assign") {
      const { pledgeId, rewardId, modifierAddonId } = body;

      if (!pledgeId || !rewardId || !modifierAddonId) {
        return NextResponse.json(
          { error: "pledgeId, rewardId, and modifierAddonId are required" },
          { status: 400 }
        );
      }

      // Verify pledge exists and belongs to this project
      const pledge = await db.pledge.findFirst({
        where: {
          id: pledgeId,
          deletedAt: null,
          projectId,
        },
        include: {
          addons: true,
          modifierAssignments: true,
        },
      });

      if (!pledge) {
        return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
      }

      // Check if this modifier addon is actually purchased by this backer
      const hasModifier = pledge.addons.some((a: { addonId: string }) => a.addonId === modifierAddonId);
      if (!hasModifier) {
        return NextResponse.json(
          { error: "Backer does not have this modifier addon" },
          { status: 400 }
        );
      }

      // Verify the target reward belongs to this project
      const reward = await db.reward.findFirst({
        where: { id: rewardId, projectId },
        select: { id: true },
      });
      if (!reward) {
        return NextResponse.json(
          { error: "Reward not found in this project" },
          { status: 404 }
        );
      }

      // Check if assignment already exists for this modifier
      const existingAssignment = await db.pledgeModifierAssignment.findFirst({
        where: {
          pledgeId,
          modifierAddonId,
        },
      });

      if (existingAssignment) {
        // Update existing assignment
        const updated = await db.pledgeModifierAssignment.update({
          where: { id: existingAssignment.id },
          data: {
            rewardId,
            isAutoAssigned: false,
            assignedBy: session.user.id,
          },
        });

        return NextResponse.json({
          success: true,
          message: "Modifier assignment updated",
          assignment: updated,
        });
      } else {
        // Create new assignment
        const assignment = await db.pledgeModifierAssignment.create({
          data: {
            pledgeId,
            rewardId,
            modifierAddonId,
            isAutoAssigned: false,
            assignedBy: session.user.id,
          },
        });

        // Check if all modifiers are now assigned
        const modifierAddons = pledge.addons.filter(() => {
          // We need to check if this is a modifier addon
          // For now, just count all assignments
          return true;
        });
        const totalNeeded = modifierAddons.length; // Simplified - doesn't account for quantity
        const totalAssigned = pledge.modifierAssignments.length + 1;

        if (totalAssigned >= totalNeeded) {
          await db.pledge.update({
            where: { id: pledgeId },
            data: { needsModifierAssignment: false },
          });
        }

        return NextResponse.json({
          success: true,
          message: "Modifier assigned successfully",
          assignment,
        });
      }
    }

    // DELETE ASSIGNMENT
    if (action === "delete_assignment") {
      const { assignmentId } = body;

      if (!assignmentId) {
        return NextResponse.json({ error: "assignmentId required" }, { status: 400 });
      }

      // Scoped delete via deleteMany so cross-project abuse is blocked AND
      // a concurrent double-click (second delete on an already-gone row)
      // returns { count: 0 } instead of throwing P2025.
      const deleted = await db.pledgeModifierAssignment.deleteMany({
        where: {
          id: assignmentId,
          pledge: { projectId },
        },
      });

      if (deleted.count === 0) {
        return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        message: "Assignment deleted",
      });
    }

    // MARK ADDON AS MODIFIER
    if (action === "set_modifier") {
      const { addonId, isModifier, modifiesRewardIds } = body;

      if (!addonId) {
        return NextResponse.json({ error: "addonId required" }, { status: 400 });
      }

      // Verify addon exists and belongs to this project
      const addon = await db.reward.findFirst({
        where: {
          id: addonId,
          deletedAt: null,
          projectId,
          type: "ADDON",
        },
      });

      if (!addon) {
        return NextResponse.json({ error: "Addon not found" }, { status: 404 });
      }

      await db.reward.update({
        where: { id: addonId },
        data: {
          isModifier: isModifier ?? false,
          modifiesRewardIds: modifiesRewardIds ?? [],
        },
      });

      // Modifier changes alter how rewards are interpreted during
      // fulfillment (Cover A + "Upgrade to Foil" addon means the
      // Cover A copy ships as foil). Mid-campaign re-targeting of
      // modifies_reward_ids is rare and high-impact, so log it.
      const { auditLog } = await import("@/lib/audit");
      auditLog({
        action: "MODIFIER_CHANGE",
        actorId: session.user.id,
        actorEmail: session.user.email || undefined,
        targetId: addonId,
        targetType: "REWARD",
        details: {
          subaction: "set_modifier",
          projectId,
          isModifier: !!isModifier,
          modifiesRewardIds: Array.isArray(modifiesRewardIds) ? modifiesRewardIds.slice(0, 50) : [],
        },
      });

      return NextResponse.json({
        success: true,
        message: isModifier ? "Addon marked as modifier" : "Addon unmarked as modifier",
      });
    }

    // SAVE MODIFIER SKU MAPPING
    if (action === "save_modifier_sku") {
      const { baseRewardId, modifierAddonId, shopifySku, shopifyProductName } = body;

      if (!baseRewardId || !modifierAddonId || !shopifySku) {
        return NextResponse.json(
          { error: "baseRewardId, modifierAddonId, and shopifySku are required" },
          { status: 400 }
        );
      }

      // Atomic upsert against the @@unique([projectId, baseRewardId,
      // modifierAddonId]) constraint — a findFirst+create race would hit
      // P2002 on the second concurrent save.
      const mapping = await db.modifierSkuMapping.upsert({
        where: {
          projectId_baseRewardId_modifierAddonId: {
            projectId,
            baseRewardId,
            modifierAddonId,
          },
        },
        create: {
          projectId,
          baseRewardId,
          modifierAddonId,
          shopifySku,
          shopifyProductName,
        },
        update: {
          shopifySku,
          shopifyProductName,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Modifier SKU mapping saved",
        mapping,
      });
    }

    // DELETE MODIFIER SKU MAPPING
    if (action === "delete_modifier_sku") {
      const { mappingId } = body;

      if (!mappingId) {
        return NextResponse.json({ error: "mappingId required" }, { status: 400 });
      }

      // Scope the delete to the project so cross-project abuse is blocked,
      // and use deleteMany so a concurrent double-click (second delete on
      // an already-gone row) returns { count: 0 } instead of P2025.
      const deleted = await db.modifierSkuMapping.deleteMany({
        where: { id: mappingId, projectId },
      });

      if (deleted.count === 0) {
        return NextResponse.json({ error: "Modifier SKU mapping not found" }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        message: "Modifier SKU mapping deleted",
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    creatorIndiekitModifiersLogger.error({ err: formatError(error) }, "Modifier POST error:");
    return NextResponse.json({ error: "Failed to process modifier action" }, { status: 500 });
  }
}
