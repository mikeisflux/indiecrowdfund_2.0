import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const creatorIndiekitDigitalLogger = logger.child({ module: "creator-indiekit-digital" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendDigitalDeliveryEmail } from "@/lib/email/email-templates-misc";
import { markDigitalOnlyPledgesShipped } from "@/lib/fulfillment/auto-distribute";

/**
 * Group pledge IDs by backer and send digital delivery emails.
 * Each backer gets one email listing all files they just received for the project.
 */
async function sendDeliveryEmailsForPledges(
  projectId: string,
  pledgeIds: string[]
): Promise<{ sent: number; failed: number }> {
  if (pledgeIds.length === 0) return { sent: 0, failed: 0 };

  try {
    // Load project title once
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { title: true },
    });
    if (!project) return { sent: 0, failed: 0 };

    // Load pledges with user emails
    const pledges = await db.pledge.findMany({
      where: { id: { in: pledgeIds } },
      select: {
        id: true,
        user: { select: { email: true, name: true } },
      },
    });

    // Load distributions for these pledges (separate query since there's no
    // explicit relation from Pledge → DigitalDistribution)
    const distributions = await db.digitalDistribution.findMany({
      where: {
        pledgeId: { in: pledgeIds },
        distributedAt: { not: null },
      },
      select: {
        pledgeId: true,
        digitalFile: { select: { name: true } },
      },
    });

    // Map pledgeId → set of file names
    const filesByPledgeId = new Map<string, Set<string>>();
    for (const d of distributions) {
      if (!d.digitalFile?.name) continue;
      const set = filesByPledgeId.get(d.pledgeId) || new Set<string>();
      set.add(d.digitalFile.name);
      filesByPledgeId.set(d.pledgeId, set);
    }

    // Group by email so each backer gets one email even across multiple pledges
    type Bucket = { name: string | null; files: Set<string> };
    const byEmail = new Map<string, Bucket>();
    for (const p of pledges) {
      if (!p.user?.email) continue;
      const email = p.user.email.toLowerCase();
      const existing = byEmail.get(email) || { name: p.user.name, files: new Set<string>() };
      const pledgeFiles = filesByPledgeId.get(p.id);
      if (pledgeFiles) {
        for (const name of pledgeFiles) existing.files.add(name);
      }
      byEmail.set(email, existing);
    }

    let sent = 0;
    let failed = 0;
    for (const [email, bucket] of byEmail) {
      const fileNames = Array.from(bucket.files);
      if (fileNames.length === 0) continue;
      const result = await sendDigitalDeliveryEmail(
        email,
        bucket.name,
        project.title,
        fileNames.length,
        fileNames
      );
      if (result.success) sent++;
      else failed++;
    }

    creatorIndiekitDigitalLogger.info(
      { projectId, sent, failed },
      "[Digital Delivery] Emails queued"
    );
    return { sent, failed };
  } catch (err) {
    creatorIndiekitDigitalLogger.error(
      { err: String(err), projectId },
      "[Digital Delivery] Failed to send emails"
    );
    return { sent: 0, failed: pledgeIds.length };
  }
}

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
    creatorIndiekitDigitalLogger.error({ err: formatError(error) }, "IndieKit digital GET error:");
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

    // While the campaign is still LIVE, digital files may only be released
    // to backers who have locked their order with the new Order Lock system
    // (orderLockStatus === "LOCKED"). Once the campaign is no longer live
    // (e.g. FUNDED), distribution reverts to all eligible backers. This gate
    // is spread into every eligible-pledge query in the distribution paths
    // below so both the "Distribute" button and rule-based distribution
    // honor it, along with the eligible-count shown when creating a rule.
    const liveLockGate =
      project.status === "LIVE" ? { orderLockStatus: "LOCKED" as const } : {};

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
            ...liveLockGate,
          },
        });
      } else if (dbTriggerType === "SPECIFIC_REWARD" && triggerRewardId) {
        totalEligible = await db.pledge.count({
          where: {
            projectId,
            rewardId: triggerRewardId,
            status: requirePayment ? "COMPLETED" : { in: ["COMPLETED", "PENDING"] },
            deletedAt: null,
            ...liveLockGate,
          },
        });
      } else if (dbTriggerType === "SPECIFIC_ADDON" && triggerAddonId) {
        totalEligible = await db.pledge.count({
          where: {
            projectId,
            addons: { some: { addonId: triggerAddonId } },
            status: requirePayment ? "COMPLETED" : { in: ["COMPLETED", "PENDING"] },
            deletedAt: null,
            ...liveLockGate,
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

    // Handle starting a single distribution rule
    if (action === "start_distribution" && body.ruleId) {
      const rule = await db.distributionRule.findFirst({
        where: { id: body.ruleId, projectId, status: "NOT_STARTED" },
        include: { digitalFile: true },
      });

      if (!rule) {
        return NextResponse.json({ error: "Rule not found or already started" }, { status: 404 });
      }

      // Find eligible pledges based on trigger type
      let eligiblePledges;
      if (rule.triggerType === "ALL_BACKERS") {
        eligiblePledges = await db.pledge.findMany({
          where: {
            projectId,
            status: rule.requiresPayment ? "COMPLETED" : { in: ["COMPLETED", "PENDING"] },
            deletedAt: null,
            ...liveLockGate,
          },
          select: { id: true },
        });
      } else if (rule.triggerType === "SPECIFIC_REWARD" && rule.triggerRewardId) {
        eligiblePledges = await db.pledge.findMany({
          where: {
            projectId,
            rewardId: rule.triggerRewardId,
            status: rule.requiresPayment ? "COMPLETED" : { in: ["COMPLETED", "PENDING"] },
            deletedAt: null,
            ...liveLockGate,
          },
          select: { id: true },
        });
      } else if (rule.triggerType === "SPECIFIC_ADDON" && rule.triggerAddonId) {
        eligiblePledges = await db.pledge.findMany({
          where: {
            projectId,
            addons: { some: { addonId: rule.triggerAddonId } },
            status: rule.requiresPayment ? "COMPLETED" : { in: ["COMPLETED", "PENDING"] },
            deletedAt: null,
            ...liveLockGate,
          },
          select: { id: true },
        });
      } else {
        eligiblePledges = [];
      }

      // Create DigitalDistribution records for each eligible pledge
      const now = new Date();
      let createdCount = 0;
      const distributedPledgeIds: string[] = [];
      for (const pledge of eligiblePledges) {
        try {
          await db.digitalDistribution.upsert({
            where: {
              digitalFileId_pledgeId: {
                digitalFileId: rule.digitalFileId,
                pledgeId: pledge.id,
              },
            },
            update: {
              distributedAt: now,
            },
            create: {
              digitalFileId: rule.digitalFileId,
              pledgeId: pledge.id,
              distributedAt: now,
            },
          });
          createdCount++;
          distributedPledgeIds.push(pledge.id);
        } catch (e) {
          creatorIndiekitDigitalLogger.error({ err: String(e) }, `Failed to create distribution for pledge ${pledge.id}:`);
        }
      }

      // Update rule status
      await db.distributionRule.update({
        where: { id: rule.id },
        data: {
          status: "COMPLETED",
          startedAt: now,
          completedAt: now,
          distributedCount: createdCount,
          totalEligible: eligiblePledges.length,
        },
      });

      // Update file distributed count
      await db.digitalFile.update({
        where: { id: rule.digitalFileId },
        data: {
          distributedCount: { increment: createdCount },
          totalEligible: eligiblePledges.length,
        },
      });

      // Send delivery notification emails to backers
      const emailResult = await sendDeliveryEmailsForPledges(projectId, distributedPledgeIds);

      // Digital-only backers who got their files have nothing left to ship.
      await markDigitalOnlyPledgesShipped(distributedPledgeIds);

      return NextResponse.json({
        success: true,
        distributedCount: createdCount,
        totalEligible: eligiblePledges.length,
        emailsSent: emailResult.sent,
        emailsFailed: emailResult.failed,
      });
    }

    // Handle starting all distributions
    if (action === "start_all_distributions" && ruleIds && Array.isArray(ruleIds)) {
      let totalDistributed = 0;
      let totalEligible = 0;
      const allDistributedPledgeIds = new Set<string>();
      const now = new Date();

      for (const ruleId of ruleIds) {
        const rule = await db.distributionRule.findFirst({
          where: { id: ruleId, projectId, status: "NOT_STARTED" },
          include: { digitalFile: true },
        });

        if (!rule) continue;

        // Find eligible pledges based on trigger type
        let eligiblePledges;
        if (rule.triggerType === "ALL_BACKERS") {
          eligiblePledges = await db.pledge.findMany({
            where: {
              projectId,
              status: rule.requiresPayment ? "COMPLETED" : { in: ["COMPLETED", "PENDING"] },
              deletedAt: null,
              ...liveLockGate,
            },
            select: { id: true },
          });
        } else if (rule.triggerType === "SPECIFIC_REWARD" && rule.triggerRewardId) {
          eligiblePledges = await db.pledge.findMany({
            where: {
              projectId,
              rewardId: rule.triggerRewardId,
              status: rule.requiresPayment ? "COMPLETED" : { in: ["COMPLETED", "PENDING"] },
              deletedAt: null,
              ...liveLockGate,
            },
            select: { id: true },
          });
        } else if (rule.triggerType === "SPECIFIC_ADDON" && rule.triggerAddonId) {
          eligiblePledges = await db.pledge.findMany({
            where: {
              projectId,
              addons: { some: { addonId: rule.triggerAddonId } },
              status: rule.requiresPayment ? "COMPLETED" : { in: ["COMPLETED", "PENDING"] },
              deletedAt: null,
              ...liveLockGate,
            },
            select: { id: true },
          });
        } else {
          eligiblePledges = [];
        }

        // Create DigitalDistribution records
        let createdCount = 0;
        for (const pledge of eligiblePledges) {
          try {
            await db.digitalDistribution.upsert({
              where: {
                digitalFileId_pledgeId: {
                  digitalFileId: rule.digitalFileId,
                  pledgeId: pledge.id,
                },
              },
              update: {
                distributedAt: now,
              },
              create: {
                digitalFileId: rule.digitalFileId,
                pledgeId: pledge.id,
                distributedAt: now,
              },
            });
            createdCount++;
            allDistributedPledgeIds.add(pledge.id);
          } catch (e) {
            creatorIndiekitDigitalLogger.error({ err: String(e) }, `Failed to create distribution for pledge ${pledge.id}:`);
          }
        }

        // Update rule status
        await db.distributionRule.update({
          where: { id: rule.id },
          data: {
            status: "COMPLETED",
            startedAt: now,
            completedAt: now,
            distributedCount: createdCount,
            totalEligible: eligiblePledges.length,
          },
        });

        // Update file distributed count
        await db.digitalFile.update({
          where: { id: rule.digitalFileId },
          data: {
            distributedCount: { increment: createdCount },
            totalEligible: eligiblePledges.length,
          },
        });

        totalDistributed += createdCount;
        totalEligible += eligiblePledges.length;
      }

      // Send delivery notification emails to all backers that received files
      const emailResult = await sendDeliveryEmailsForPledges(
        projectId,
        Array.from(allDistributedPledgeIds)
      );

      // Digital-only backers who got their files have nothing left to ship.
      await markDigitalOnlyPledgesShipped(Array.from(allDistributedPledgeIds));

      return NextResponse.json({
        success: true,
        updatedCount: ruleIds.length,
        totalDistributed,
        totalEligible,
        emailsSent: emailResult.sent,
        emailsFailed: emailResult.failed,
      });
    }

    // Handle blast notifications — retroactively email all backers who already
    // received digital files, letting them know their downloads are ready.
    if (action === "blast_notifications" || action === "resend_all_delivery_emails") {
      // Get all digital files for this project
      const files = await db.digitalFile.findMany({
        where: { projectId },
        select: { id: true },
      });
      const fileIds = files.map((f: { id: string }) => f.id);

      // Find every distribution that has been marked as delivered
      const distributions = await db.digitalDistribution.findMany({
        where: {
          digitalFileId: { in: fileIds },
          distributedAt: { not: null },
        },
        select: { pledgeId: true },
      });

      // Get unique pledge IDs
      const pledgeIds = Array.from(new Set(distributions.map((d: { pledgeId: string }) => d.pledgeId)));

      // Filter to only active (non-deleted, completed) pledges
      const activePledges = await db.pledge.findMany({
        where: {
          id: { in: pledgeIds },
          projectId,
          status: "COMPLETED",
          deletedAt: null,
        },
        select: { id: true },
      });
      const activePledgeIds = activePledges.map((p) => p.id);

      const emailResult = await sendDeliveryEmailsForPledges(projectId, activePledgeIds);

      // Catch up any digital-only backers who were delivered files before this
      // behavior existed — they have nothing physical to ship, so mark shipped.
      const markedShipped = await markDigitalOnlyPledgesShipped(activePledgeIds);

      return NextResponse.json({
        success: true,
        count: activePledgeIds.length,
        markedShipped,
        emailsSent: emailResult.sent,
        emailsFailed: emailResult.failed,
      });
    }

    // Handle distribute file (legacy - direct file distribution without rule)
    if (action === "distribute_file" && fileId) {
      const file = await db.digitalFile.findFirst({
        where: { id: fileId, projectId },
      });

      if (!file) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }

      // Find all eligible pledges based on file access type
      let eligiblePledges;
      if (file.accessType === "ALL_BACKERS") {
        eligiblePledges = await db.pledge.findMany({
          where: { projectId, status: "COMPLETED", deletedAt: null, ...liveLockGate },
          select: { id: true },
        });
      } else if (file.accessType === "SPECIFIC_REWARDS" && file.rewardIds.length > 0) {
        eligiblePledges = await db.pledge.findMany({
          where: {
            projectId,
            rewardId: { in: file.rewardIds },
            status: "COMPLETED",
            deletedAt: null,
            ...liveLockGate,
          },
          select: { id: true },
        });
      } else if (file.accessType === "SPECIFIC_ADDONS" && file.addonIds.length > 0) {
        eligiblePledges = await db.pledge.findMany({
          where: {
            projectId,
            addons: { some: { addonId: { in: file.addonIds } } },
            status: "COMPLETED",
            deletedAt: null,
            ...liveLockGate,
          },
          select: { id: true },
        });
      } else {
        eligiblePledges = await db.pledge.findMany({
          where: { projectId, status: "COMPLETED", deletedAt: null, ...liveLockGate },
          select: { id: true },
        });
      }

      // Create DigitalDistribution records
      const now = new Date();
      let createdCount = 0;
      const distributedPledgeIds: string[] = [];
      for (const pledge of eligiblePledges) {
        try {
          await db.digitalDistribution.upsert({
            where: {
              digitalFileId_pledgeId: {
                digitalFileId: file.id,
                pledgeId: pledge.id,
              },
            },
            update: {
              distributedAt: now,
            },
            create: {
              digitalFileId: file.id,
              pledgeId: pledge.id,
              distributedAt: now,
            },
          });
          createdCount++;
          distributedPledgeIds.push(pledge.id);
        } catch (e) {
          creatorIndiekitDigitalLogger.error({ err: String(e) }, `Failed to create distribution for pledge ${pledge.id}:`);
        }
      }

      // Update file distributed count
      await db.digitalFile.update({
        where: { id: file.id },
        data: {
          distributedCount: { increment: createdCount },
          totalEligible: eligiblePledges.length,
        },
      });

      // Digital-only backers who got their files have nothing left to ship.
      await markDigitalOnlyPledgesShipped(distributedPledgeIds);

      return NextResponse.json({
        success: true,
        message: `Distribution completed for ${file.name}`,
        distributedCount: createdCount,
        totalEligible: eligiblePledges.length,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    creatorIndiekitDigitalLogger.error({ err: formatError(error) }, "IndieKit digital API error:");
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

    // Scoped delete via deleteMany — resolves concurrent double-clicks
    // as { count: 0 } instead of P2025. Scoped to projectId so we also
    // block cross-project abuse if ruleId is ever guessed.
    await db.distributionRule.deleteMany({
      where: { id: ruleId, projectId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    creatorIndiekitDigitalLogger.error({ err: formatError(error) }, "IndieKit digital DELETE error:");
    return NextResponse.json(
      { error: "Failed to delete distribution rule" },
      { status: 500 }
    );
  }
}
