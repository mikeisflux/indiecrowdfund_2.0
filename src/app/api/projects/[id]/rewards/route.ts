import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { randomBytes } from "crypto";

const projectsRewardsLogger = logger.child({ module: "projects-rewards" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

// GET - Fetch all rewards for a project
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    // Fetch rewards for this project
    const rewards = await db.reward.findMany({
      where: { projectId },
      include: {
        items: true,
      },
      orderBy: { amount: "asc" },
    });

    // Convert Decimal fields to numbers for JSON serialization
    const serializedRewards = rewards.map(reward => ({
      ...reward,
      amount: Number(reward.amount),
    }));

    return NextResponse.json({
      rewards: serializedRewards,
    });
  } catch (error) {
    projectsRewardsLogger.error({ err: formatError(error) }, "Fetch rewards error:");
    return NextResponse.json(
      { error: "Failed to fetch rewards" },
      { status: 500 }
    );
  }
}

const rewardSchema = z.object({
  id: z.string().optional(),
  type: z.enum(["TIER", "ADDON"]).default("TIER"),
  title: z.string().min(1),
  description: z.string().optional().default(""),
  amount: z.number().positive().max(999999.99),
  imageUrl: z.string().optional().nullable(),
  estimatedDelivery: z.string().optional().nullable(),
  shippingType: z.enum(["NO_SHIPPING", "WORLDWIDE", "SELECTED_COUNTRIES"]).default("NO_SHIPPING"),
  shippingCountries: z.array(z.string()).optional().default([]),
  // Accept both object and number for shippingCost (some clients send just a number)
  shippingCost: z.union([
    z.record(z.string(), z.number()),
    z.number().transform((n) => ({ default: n })),
  ]).optional().default({}),
  quantityAvailable: z.number().int().min(1).optional().nullable(),
  visibility: z.enum(["PUBLIC", "SECRET"]).optional().default("PUBLIC"),
  secretToken: z.string().optional().nullable(),
  isEnded: z.boolean().optional().default(false),
  items: z.array(z.object({
    id: z.string().optional(),
    projectItemId: z.string().optional().nullable(), // Reference to ProjectItem
    title: z.string().default("Item"),
    description: z.string().optional().nullable(),
    imageUrl: z.string().optional().nullable(),
  })).optional().default([]),
});

// Batch schema - accepts array of rewards
const batchRewardsSchema = z.object({
  rewards: z.array(rewardSchema),
});

// Helper type for reward data
type RewardData = z.infer<typeof rewardSchema>;

// Helper function to save a single reward (create or update)
async function saveReward(projectId: string, reward: RewardData) {
  // Generate secret token for SECRET visibility if not provided
  let secretToken = reward.secretToken || null;
  if (reward.visibility === "SECRET" && !secretToken) {
    secretToken = randomBytes(16).toString("hex");
  }
  // Clear secret token if visibility is not SECRET
  if (reward.visibility !== "SECRET") {
    secretToken = null;
  }

  // If reward has an ID, this is an update
  if (reward.id) {
    // Verify reward belongs to this project
    const existingReward = await db.reward.findFirst({
      where: { id: reward.id, projectId },
      include: { items: true },
    });

    if (!existingReward) {
      throw new Error("Reward not found");
    }

    // Update reward and manage items
    const updated = await db.$transaction(async (tx) => {
      // Delete existing items
      await tx.rewardItem.deleteMany({
        where: { rewardId: reward.id },
      });

      // Update reward and create new items
      return tx.reward.update({
        where: { id: reward.id },
        data: {
          type: reward.type,
          title: reward.title,
          description: reward.description || "",
          amount: reward.amount,
          imageUrl: reward.imageUrl || null,
          estimatedDelivery: reward.estimatedDelivery ? new Date(reward.estimatedDelivery) : null,
          shippingType: reward.shippingType,
          shippingCountries: reward.shippingCountries,
          shippingCost: reward.shippingCost,
          quantityAvailable: reward.quantityAvailable,
          visibility: reward.visibility,
          secretToken,
          isEnded: reward.isEnded,
          items: {
            create: reward.items.map(item => ({
              projectItemId: item.projectItemId || null,
              title: item.title,
              description: item.description || null,
              imageUrl: item.imageUrl || null,
            })),
          },
        },
        include: {
          items: true,
        },
      });
    });

    return {
      ...updated,
      amount: Number(updated.amount),
    };
  }

  // Otherwise, create new reward
  const created = await db.reward.create({
    data: {
      projectId,
      type: reward.type,
      title: reward.title,
      description: reward.description || "",
      amount: reward.amount,
      imageUrl: reward.imageUrl || null,
      estimatedDelivery: reward.estimatedDelivery ? new Date(reward.estimatedDelivery) : null,
      shippingType: reward.shippingType,
      shippingCountries: reward.shippingCountries,
      shippingCost: reward.shippingCost,
      quantityAvailable: reward.quantityAvailable,
      visibility: reward.visibility,
      secretToken,
      isEnded: reward.isEnded,
      items: {
        create: reward.items.map(item => ({
          projectItemId: item.projectItemId || null,
          title: item.title,
          description: item.description || null,
          imageUrl: item.imageUrl || null,
        })),
      },
    },
    include: {
      items: true,
    },
  });

  return {
    ...created,
    amount: Number(created.amount),
  };
}

// Create or update a reward (upsert - handles both POST for new and updates for existing)
// Also supports batch operations when body contains { rewards: [...] }
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

    // Verify project ownership or collaborator with edit permission
    const project = await db.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { creatorId: true, status: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Check if user is creator or an accepted collaborator with edit permission
    const isCreator = project.creatorId === session.user.id;
    let canEdit = isCreator;

    if (!isCreator) {
      const collaborator = await db.projectCollaborator.findFirst({
        where: {
          projectId,
          userId: session.user.id,
          status: "ACCEPTED",
          canEditProject: true,
        },
      });
      canEdit = !!collaborator;
    }

    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();

    // Debug: log shipping data received
    projectsRewardsLogger.info({ data: {
      shippingType: body.shippingType,
      shippingCost: body.shippingCost,
      shippingCountries: body.shippingCountries,
    } }, "[Rewards API] Received shipping data:");

    // Check if this is a batch request
    if (body.rewards && Array.isArray(body.rewards)) {
      const batch = batchRewardsSchema.parse(body);
      const results: Array<{ success: boolean; reward?: unknown; error?: string }> = [];

      // Process each reward in the batch
      for (const rewardData of batch.rewards) {
        try {
          const savedReward = await saveReward(projectId, rewardData);
          results.push({ success: true, reward: savedReward });
        } catch (err) {
          // "Reward not found" is a legitimate 404 (stale ID from
          // frontend cache, reward deleted concurrently, etc.) — the
          // batch response already returns success:false with the
          // message per row, so this is informational, not actionable.
          // Log at warn so it doesn't trip the error pager.
          const message = err instanceof Error ? err.message : String(err);
          const isStaleRewardId = err instanceof Error && err.message === "Reward not found";
          if (isStaleRewardId) {
            projectsRewardsLogger.warn({ err: formatError(err), rewardId: rewardData?.id, projectId }, "Skipping save of stale reward id (likely deleted in a parallel session)");
          } else {
            projectsRewardsLogger.error({ err: formatError(err), rewardId: rewardData?.id, projectId }, "Error saving reward");
          }
          results.push({
            success: false,
            error: message,
          });
        }
      }

      projectsRewardsLogger.info(`Batch rewards saved: ${results.filter(r => r.success).length}/${batch.rewards.length} for project ${projectId}`);
      return NextResponse.json({
        success: true,
        results,
        savedCount: results.filter(r => r.success).length,
        totalCount: batch.rewards.length,
      });
    }

    // Single reward handling - use the shared helper
    const reward = rewardSchema.parse(body);
    // Debug: log parsed shipping data
    projectsRewardsLogger.info({ data: {
      shippingType: reward.shippingType,
      shippingCost: reward.shippingCost,
      shippingCountries: reward.shippingCountries,
    } }, "[Rewards API] Parsed shipping data:");
    const savedReward = await saveReward(projectId, reward);
    projectsRewardsLogger.info(`Reward ${reward.id ? 'updated' : 'created'}: ${savedReward.id} for project ${projectId}`);
    return NextResponse.json({
      success: true,
      reward: savedReward,
    });
  } catch (error) {
    projectsRewardsLogger.error({ err: formatError(error) }, "Create reward error:");
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
      projectsRewardsLogger.error({ err: String(errorMessage) }, "Zod validation error:");
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    // Log the actual error message for debugging
    const errorMsg = error instanceof Error ? error.message : String(error);
    projectsRewardsLogger.error({ err: String(errorMsg) }, "Database/other error:");
    return NextResponse.json(
      { error: `Failed to create reward: ${errorMsg}` },
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

    // Verify project ownership or collaborator with edit permission
    const project = await db.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { creatorId: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Check if user is creator or an accepted collaborator with edit permission
    const isCreator = project.creatorId === session.user.id;
    let canEdit = isCreator;

    if (!isCreator) {
      const collaborator = await db.projectCollaborator.findFirst({
        where: {
          projectId,
          userId: session.user.id,
          status: "ACCEPTED",
          canEditProject: true,
        },
      });
      canEdit = !!collaborator;
    }

    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();

    // Debug: log shipping data received for PATCH
    projectsRewardsLogger.info({ data: {
      rewardId: body.id,
      shippingType: body.shippingType,
      shippingCost: body.shippingCost,
      shippingCountries: body.shippingCountries,
    } }, "[Rewards API PATCH] Received shipping data:");

    const reward = rewardSchema.parse(body);

    // Debug: log parsed shipping data
    projectsRewardsLogger.info({ data: {
      rewardId: reward.id,
      shippingType: reward.shippingType,
      shippingCost: reward.shippingCost,
      shippingCountries: reward.shippingCountries,
    } }, "[Rewards API PATCH] Parsed shipping data:");

    if (!reward.id) {
      return NextResponse.json({ error: "Reward ID required for update" }, { status: 400 });
    }

    // Get existing reward to check for existing secretToken
    const existingReward = await db.reward.findUnique({
      where: { id: reward.id },
      select: { secretToken: true },
    });

    // Handle secret token for SECRET visibility
    let secretToken = reward.secretToken || existingReward?.secretToken || null;
    if (reward.visibility === "SECRET" && !secretToken) {
      secretToken = randomBytes(16).toString("hex");
    }
    // Clear secret token if visibility is not SECRET
    if (reward.visibility !== "SECRET") {
      secretToken = null;
    }

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
          imageUrl: reward.imageUrl || null,
          estimatedDelivery: reward.estimatedDelivery ? new Date(reward.estimatedDelivery) : null,
          shippingType: reward.shippingType,
          shippingCountries: reward.shippingCountries,
          shippingCost: reward.shippingCost,
          quantityAvailable: reward.quantityAvailable,
          visibility: reward.visibility,
          secretToken,
          isEnded: reward.isEnded,
          items: {
            create: reward.items.map(item => ({
              projectItemId: item.projectItemId || null, // Link to ProjectItem
              title: item.title,
              description: item.description || null,
              imageUrl: item.imageUrl || null,
            })),
          },
        },
        include: {
          items: true,
        },
      });
    });

    // Debug: log saved shipping data
    projectsRewardsLogger.info({ data: {
      rewardId: updated.id,
      shippingType: updated.shippingType,
      shippingCost: updated.shippingCost,
      shippingCountries: updated.shippingCountries,
    } }, "[Rewards API PATCH] Saved shipping data:");

    return NextResponse.json({
      success: true,
      reward: {
        ...updated,
        amount: Number(updated.amount),
      },
    });
  } catch (error) {
    projectsRewardsLogger.error({ err: formatError(error) }, "Update reward error:");
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
      projectsRewardsLogger.error({ err: String(errorMessage) }, "Zod validation error:");
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    // Log the actual error message for debugging
    const errorMsg = error instanceof Error ? error.message : String(error);
    projectsRewardsLogger.error({ err: String(errorMsg) }, "Database/other error:");
    return NextResponse.json(
      { error: `Failed to update reward: ${errorMsg}` },
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

    // Verify project ownership or collaborator with edit permission
    const project = await db.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { creatorId: true, status: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Check if user is creator or an accepted collaborator with edit permission
    const isCreator = project.creatorId === session.user.id;
    let canEdit = isCreator;

    if (!isCreator) {
      const collaborator = await db.projectCollaborator.findFirst({
        where: {
          projectId,
          userId: session.user.id,
          status: "ACCEPTED",
          canEditProject: true,
        },
      });
      canEdit = !!collaborator;
    }

    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if project is live - cannot delete rewards from live projects
    if (project.status === "LIVE") {
      return NextResponse.json(
        { error: "Cannot delete rewards from a live project. You can only end rewards to prevent new backers." },
        { status: 400 }
      );
    }

    // Check if reward has backers — also verify the reward belongs to this project (IDOR prevention)
    const reward = await db.reward.findFirst({
      where: { id: rewardId, projectId },
      select: { quantityClaimed: true },
    });

    if (!reward) {
      return NextResponse.json({ error: "Reward not found" }, { status: 404 });
    }

    if (reward.quantityClaimed > 0) {
      return NextResponse.json(
        { error: "Cannot delete reward with backers" },
        { status: 400 }
      );
    }

    // Delete pledge addons, reward items, then reward. The final delete
    // uses a CAS on quantityClaimed: 0 so that a backer pledging between
    // the check above and this delete cannot leave their pledge pointing
    // at a deleted reward. If the CAS fails, the whole transaction rolls
    // back and we return an error to the creator.
    try {
      await db.$transaction(async (tx) => {
        await tx.pledgeAddon.deleteMany({ where: { addonId: rewardId } });
        await tx.rewardItem.deleteMany({ where: { rewardId } });
        const del = await tx.reward.deleteMany({
          where: { id: rewardId, projectId, quantityClaimed: 0 },
        });
        if (del.count === 0) {
          throw new Error("REWARD_HAS_BACKERS");
        }
      });
    } catch (err) {
      if (err instanceof Error && err.message === "REWARD_HAS_BACKERS") {
        return NextResponse.json(
          { error: "Cannot delete reward with backers" },
          { status: 400 }
        );
      }
      throw err;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    projectsRewardsLogger.error({ err: formatError(error) }, "Delete reward error:");
    return NextResponse.json(
      { error: "Failed to delete reward" },
      { status: 500 }
    );
  }
}
