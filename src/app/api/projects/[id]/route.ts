import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { sendCollaboratorInviteEmail, sendProjectSubmittedEmail } from "@/lib/email";

// Helper function to check if a user has had a successful (funded + fulfilled) campaign
async function hasSuccessfulCampaign(userId: string): Promise<boolean> {
  // Find projects that are FUNDED or have reached their goal
  const fundedProjects = await db.project.findMany({
    where: {
      creatorId: userId,
      OR: [
        { status: "FUNDED" },
        // Also check projects that reached their goal but may still be LIVE
        {
          status: { in: ["LIVE", "FUNDED"] },
        },
      ],
    },
    select: {
      id: true,
      currentAmount: true,
      goalAmount: true,
    },
  });

  // Filter to only projects that actually reached their goal
  const projectsThatReachedGoal = fundedProjects.filter(
    (p) => p.currentAmount >= p.goalAmount
  );

  if (projectsThatReachedGoal.length === 0) {
    return false;
  }

  // Check if any of these projects have >= 85% fulfillment
  for (const project of projectsThatReachedGoal) {
    const pledges = await db.pledge.findMany({
      where: {
        projectId: project.id,
        status: "COMPLETED",
      },
      select: {
        fulfillmentStatus: true,
      },
    });

    if (pledges.length === 0) {
      continue; // No completed pledges to fulfill
    }

    const deliveredCount = pledges.filter(
      (p) => p.fulfillmentStatus === "DELIVERED"
    ).length;
    const fulfillmentPercentage = (deliveredCount / pledges.length) * 100;

    if (fulfillmentPercentage >= 85) {
      return true; // Found a successful campaign
    }
  }

  return false;
}

// Helper function to check if user can activate prelaunch without approval
async function canActivatePrelaunchImmediately(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user) {
    return false;
  }

  // Admins and Super Admins can always activate prelaunch
  if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
    return true;
  }

  // Cool Kids can activate prelaunch without approval
  if (user.role === "COOL_KIDS") {
    return true;
  }

  // Standard users need a successful campaign
  return await hasSuccessfulCampaign(userId);
}

// Schema for reward items
const rewardItemSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
});

// Schema for rewards
const rewardSchema = z.object({
  id: z.string().optional(),
  type: z.enum(["TIER", "ADDON"]),
  title: z.string(),
  description: z.string().optional().nullable(),
  amount: z.number(),
  imageUrl: z.string().optional().nullable(),
  estimatedDelivery: z.string().optional().nullable(),
  shippingType: z.enum(["WORLDWIDE", "SELECTED_COUNTRIES", "NO_SHIPPING"]),
  shippingCountries: z.array(z.string()).optional(),
  shippingCost: z.union([z.number(), z.record(z.string(), z.number())]).optional(),
  quantityAvailable: z.number().optional().nullable(),
  items: z.array(rewardItemSchema).optional(),
  isEnded: z.boolean().optional(),
});

// Schema for collaborators
const collaboratorSchema = z.object({
  email: z.string().email(),
  title: z.string().optional(),
  canEditProject: z.boolean().optional(),
  canManageCommunity: z.boolean().optional(),
  canCoordinateFulfillment: z.boolean().optional(),
  canConfigurePledgeManager: z.boolean().optional(),
});

// Full update schema including all project data
const updateProjectSchema = z.object({
  // Basics
  title: z.string().optional(),
  subtitle: z.string().optional(),
  slug: z.string().min(3).max(100).regex(/^[a-z0-9-]+$/).optional(),
  category: z.string().optional(),
  subcategory: z.string().optional().nullable(),
  secondaryCategory: z.string().optional().nullable(),
  secondarySubcategory: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  videoUrl: z.string().optional().nullable(),
  goalAmount: z.number().optional(),
  durationType: z.enum(["FIXED_DAYS", "END_DATE"]).optional(),
  durationDays: z.number().optional().nullable(),
  endDate: z.string().optional().nullable(),
  launchDate: z.string().optional().nullable(),

  // Story
  description: z.string().optional(),
  risks: z.string().optional(),
  usesAI: z.boolean().optional(),
  faqs: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })).optional(),

  // Payment
  contactEmail: z.union([z.string().email(), z.literal("")]).optional(),
  projectType: z.enum(["INDIVIDUAL", "BUSINESS", "NONPROFIT"]).optional(),
  hasAdultContent: z.boolean().optional(),
  hasRiskyContent: z.boolean().optional(),
  promoContentSfw: z.boolean().optional(),
  allowRetailerPledges: z.boolean().optional(),
  retailerDiscount: z.number().optional(),
  retailerMinQuantity: z.number().optional(),

  // Promotion
  prelaunchActive: z.boolean().optional(),
  prelaunchDescription: z.string().optional().nullable(),
  customReferralTags: z.array(z.string()).optional(),
  googleAnalyticsId: z.string().optional().nullable(),
  metaPixelId: z.string().optional().nullable(),

  // Rewards (array to replace all rewards)
  rewards: z.array(rewardSchema).optional(),

  // Collaborators
  collaborators: z.array(collaboratorSchema).optional(),

  // Status
  status: z.enum(["DRAFT", "SUBMITTED"]).optional(),
});

// Helper function to handle collaborators and create notifications
async function handleCollaborators(
  projectId: string,
  collaborators: z.infer<typeof collaboratorSchema>[],
  creatorId: string,
  creatorName: string
) {
  // Get project title for notification
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { title: true, slug: true },
  });

  if (!project) {
    console.error("Project not found when processing collaborators");
    return;
  }

  // Get existing collaborators
  const existingCollaborators = await db.projectCollaborator.findMany({
    where: { projectId },
    select: { email: true, userId: true },
  });

  const existingEmails = new Set(existingCollaborators.map((c: { email: string | null }) => c.email?.toLowerCase()));

  for (const collab of collaborators) {
    const emailLower = collab.email.toLowerCase();

    // Skip if already a collaborator
    if (existingEmails.has(emailLower)) {
      continue;
    }

    try {
      // Find user by email
      const user = await db.user.findUnique({
        where: { email: emailLower },
        select: { id: true },
      });

      if (user) {
        // Create collaborator entry with PENDING status - user must accept
        const collaboratorRecord = await db.projectCollaborator.create({
          data: {
            projectId,
            userId: user.id,
            email: collab.email,
            title: collab.title || null,
            canEditProject: collab.canEditProject || false,
            canManageCommunity: collab.canManageCommunity || false,
            canCoordinateFulfillment: collab.canCoordinateFulfillment || false,
            canConfigurePledgeManager: collab.canConfigurePledgeManager || false,
            status: "PENDING",
          },
        });

        // Create notification for the user
        await db.notification.create({
          data: {
            userId: user.id,
            type: "COLLABORATOR_INVITE",
            title: "You've been invited to collaborate",
            message: `${creatorName} has invited you to collaborate on "${project.title}"`,
            actionUrl: `/collaborate/${collaboratorRecord.id}`,
            projectId,
            senderId: creatorId,
          },
        });

        // Send email notification with accept/decline link
        await sendCollaboratorInviteEmail(
          collab.email,
          creatorName,
          project.title,
          collaboratorRecord.id
        );
      } else {

        // User doesn't exist yet - create a pending collaborator entry without userId
        // They'll be linked when they sign up with this email
        const collaboratorRecord = await db.projectCollaborator.create({
          data: {
            projectId,
            email: collab.email,
            title: collab.title || null,
            canEditProject: collab.canEditProject || false,
            canManageCommunity: collab.canManageCommunity || false,
            canCoordinateFulfillment: collab.canCoordinateFulfillment || false,
            canConfigurePledgeManager: collab.canConfigurePledgeManager || false,
            status: "PENDING",
          },
        });

        // Send invite email - they'll need to sign up first
        await sendCollaboratorInviteEmail(
          collab.email,
          creatorName,
          project.title,
          collaboratorRecord.id
        );
      }
    } catch (error) {
      console.error(`Error processing collaborator ${emailLower}:`, error);
      // Continue processing other collaborators even if one fails
    }
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const project = await db.project.findUnique({
      where: { id: params.id },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            image: true,
            bio: true,
            location: true,
          },
        },
        rewards: {
          include: {
            items: true,
          },
          orderBy: { amount: "asc" },
        },
        updates: {
          where: { status: "PUBLISHED" },
          orderBy: { publishedAt: "desc" },
          take: 5,
        },
        _count: {
          select: {
            pledges: true,
            followers: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error("Get project error:", error);
    return NextResponse.json(
      { error: "Failed to fetch project" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const project = await db.project.findUnique({
      where: { id: params.id },
      select: { creatorId: true, status: true, prelaunchStatus: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Check if user is creator or an accepted collaborator with edit permission
    const isCreator = project.creatorId === session.user.id;
    let canEdit = isCreator;

    if (!isCreator) {
      // Check if user is a collaborator with edit permission
      const collaborator = await db.projectCollaborator.findFirst({
        where: {
          projectId: params.id,
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

    // Determine what can be edited based on project status
    const isLaunched = ["LIVE", "FUNDED", "PAUSED"].includes(project.status);

    const body = await req.json();

    const data = updateProjectSchema.parse(body);

    // Extract rewards and collaborators for separate handling
    const { rewards, collaborators, ...projectData } = data;

    // Prepare project update data
    const updateData: Record<string, unknown> = {};

    // For launched projects, only allow editing story section
    // For draft/submitted/approved projects, allow all edits
    if (isLaunched) {
      // Story fields only for launched campaigns
      if (projectData.description !== undefined) updateData.description = projectData.description;
      if (projectData.risks !== undefined) updateData.risks = projectData.risks;
      if (projectData.usesAI !== undefined) updateData.usesAI = projectData.usesAI;
      if (projectData.faqs !== undefined) updateData.faqs = projectData.faqs;
    } else {
      // Add basic fields (only for non-launched projects)
      if (projectData.title !== undefined) updateData.title = projectData.title;
      if (projectData.subtitle !== undefined) updateData.subtitle = projectData.subtitle;

      // Handle slug update - check if new slug is already taken
      if (projectData.slug !== undefined) {
        const existingProject = await db.project.findFirst({
          where: {
            slug: projectData.slug,
            id: { not: params.id } // Exclude current project
          },
          select: { id: true },
        });

        if (existingProject) {
          return NextResponse.json(
            { error: "This URL is already taken. Please choose a different one." },
            { status: 400 }
          );
        }
        updateData.slug = projectData.slug;
      }

      if (projectData.category !== undefined) updateData.category = projectData.category;
      if (projectData.subcategory !== undefined) updateData.subcategory = projectData.subcategory;
      if (projectData.secondaryCategory !== undefined) updateData.secondaryCategory = projectData.secondaryCategory;
      if (projectData.secondarySubcategory !== undefined) updateData.secondarySubcategory = projectData.secondarySubcategory;
      if (projectData.location !== undefined) updateData.location = projectData.location;
      if (projectData.imageUrl !== undefined) updateData.imageUrl = projectData.imageUrl;
      if (projectData.videoUrl !== undefined) updateData.videoUrl = projectData.videoUrl;
      if (projectData.goalAmount !== undefined) updateData.goalAmount = projectData.goalAmount;
      if (projectData.durationType !== undefined) updateData.durationType = projectData.durationType;
      if (projectData.durationDays !== undefined) updateData.durationDays = projectData.durationDays;
      if (projectData.endDate !== undefined) updateData.endDate = projectData.endDate ? new Date(projectData.endDate) : null;
      if (projectData.launchDate !== undefined) updateData.launchDate = projectData.launchDate ? new Date(projectData.launchDate) : null;

      // Story fields
      if (projectData.description !== undefined) updateData.description = projectData.description;
      if (projectData.risks !== undefined) updateData.risks = projectData.risks;
      if (projectData.usesAI !== undefined) updateData.usesAI = projectData.usesAI;
      if (projectData.faqs !== undefined) updateData.faqs = projectData.faqs;

      // Payment fields
      if (projectData.contactEmail !== undefined) {
        updateData.contactEmail = projectData.contactEmail; // Keep as-is (empty string is valid)
      }
      if (projectData.projectType !== undefined) updateData.projectType = projectData.projectType;
      if (projectData.hasAdultContent !== undefined) updateData.hasAdultContent = projectData.hasAdultContent;
      if (projectData.hasRiskyContent !== undefined) updateData.hasRiskyContent = projectData.hasRiskyContent;
      if (projectData.promoContentSfw !== undefined) updateData.promoContentSfw = projectData.promoContentSfw;
      if (projectData.allowRetailerPledges !== undefined) updateData.allowRetailerPledges = projectData.allowRetailerPledges;
      if (projectData.retailerDiscount !== undefined) updateData.retailerDiscount = projectData.retailerDiscount;
      if (projectData.retailerMinQuantity !== undefined) updateData.retailerMinQuantity = projectData.retailerMinQuantity;

      // Promotion fields
      // Check prelaunch activation - standard users without successful campaigns need approval
      if (projectData.prelaunchActive === true) {
        // Check if user can activate prelaunch immediately
        const canActivate = await canActivatePrelaunchImmediately(session.user.id);

        if (!canActivate) {
          // User needs approval - check if prelaunch is already approved
          if (project.prelaunchStatus !== "APPROVED") {
            // Submit the prelaunch for review instead of activating
            // Save all the other project data but submit prelaunch for review
            updateData.prelaunchStatus = "SUBMITTED";

            // Get the full project data to include in review
            const fullProject = await db.project.findUnique({
              where: { id: params.id },
              select: { title: true, creatorId: true, creator: { select: { name: true, email: true } } },
            });

            // Update the project FIRST to save prelaunchStatus and any other data
            await db.project.update({
              where: { id: params.id },
              data: updateData,
            });

            // Create a project review record for prelaunch review
            await db.projectReview.create({
              data: {
                projectId: params.id,
                action: "SUBMITTED",
                previousStatus: project.status,
                newStatus: project.status, // Keep project status unchanged
                notes: "Pre-launch page submitted for review. Standard user without previous successful campaign.",
                flagsRaised: ["prelaunch_review"],
              },
            });

            // Send email notification to creator
            if (fullProject?.creator?.email) {
              try {
                await sendProjectSubmittedEmail(
                  fullProject.creator.email,
                  fullProject.creator.name || "Creator",
                  fullProject.title
                );
              } catch (emailError) {
                console.error("Failed to send project submitted email:", emailError);
              }
            }

            // Return with a message about needing approval
            return NextResponse.json({
              success: true,
              requiresApproval: true,
              message: "Your pre-launch page has been submitted for review. Once approved, you can activate it.",
              project: { id: params.id, prelaunchStatus: "SUBMITTED" },
            });
          }
          // Prelaunch is approved, allow activation
          updateData.prelaunchActive = true;
        } else {
          // User can activate prelaunch immediately
          updateData.prelaunchActive = true;
        }
      } else if (projectData.prelaunchActive === false) {
        updateData.prelaunchActive = false;
      }

      if (projectData.prelaunchDescription !== undefined) updateData.prelaunchDescription = projectData.prelaunchDescription;
      if (projectData.customReferralTags !== undefined) updateData.customReferralTags = projectData.customReferralTags;
      if (projectData.googleAnalyticsId !== undefined) updateData.googleAnalyticsId = projectData.googleAnalyticsId;
      if (projectData.metaPixelId !== undefined) updateData.metaPixelId = projectData.metaPixelId;

      // Status
      if (projectData.status !== undefined) updateData.status = projectData.status;
    }

    // Update project using transaction if we have rewards to handle
    if (rewards && rewards.length > 0) {
      // Use transaction to update project and rewards together
      const updated = await db.$transaction(async (tx) => {
        // Update project (only allowed fields based on isLaunched)
        const updatedProject = await tx.project.update({
          where: { id: params.id },
          data: updateData,
        });

        // Get existing rewards with backer counts
        const existingRewards = await tx.reward.findMany({
          where: { projectId: params.id },
          include: { _count: { select: { pledges: true } } },
        });

        // For launched projects, handle rewards differently
        if (isLaunched) {
          // For launched projects:
          // - Can only update rewards that have NO backers
          // - Can update isEnded flag for rewards WITH backers
          // - Cannot delete rewards with backers
          // - Cannot create new rewards
          for (const reward of rewards) {
            if (!reward.id) {
              // Skip new rewards for launched projects - they can't add new ones
              continue;
            }

            const existingReward = existingRewards.find(r => r.id === reward.id);
            if (!existingReward) continue;

            const hasBacker = existingReward._count.pledges > 0;

            if (hasBacker) {
              // Only allow updating isEnded for rewards with backers
              if (reward.isEnded !== undefined && reward.isEnded !== existingReward.isEnded) {
                await tx.reward.update({
                  where: { id: reward.id },
                  data: {
                    isEnded: reward.isEnded,
                    endedAt: reward.isEnded ? new Date() : null,
                  },
                });
              }
            } else {
              // No backers - can fully edit this reward
              const rewardData = {
                type: reward.type,
                title: reward.title,
                description: reward.description,
                amount: reward.amount,
                imageUrl: reward.imageUrl || null,
                estimatedDelivery: reward.estimatedDelivery ? new Date(reward.estimatedDelivery) : null,
                shippingType: reward.shippingType,
                shippingCountries: reward.shippingCountries || [],
                shippingCost: reward.shippingCost || 0,
                quantityAvailable: reward.quantityAvailable ?? null,
                isEnded: reward.isEnded || false,
              };

              await tx.reward.update({
                where: { id: reward.id },
                data: rewardData,
              });

              // Update items - delete all and recreate
              await tx.rewardItem.deleteMany({ where: { rewardId: reward.id } });
              if (reward.items && reward.items.length > 0) {
                await tx.rewardItem.createMany({
                  data: reward.items.map(item => ({
                    rewardId: reward.id!,
                    title: item.title,
                    description: item.description || null,
                    imageUrl: item.imageUrl || null,
                  })),
                });
              }
            }
          }
        } else {
          // Non-launched project - full reward editing allowed
          const newRewardIds = rewards.filter(r => r.id).map(r => r.id);
          const rewardsToDelete = existingRewards.filter(
            r => !newRewardIds.includes(r.id) && r._count.pledges === 0
          );

          // Delete rewards that are no longer in the list (only if no pledges)
          for (const reward of rewardsToDelete) {
            await tx.rewardItem.deleteMany({ where: { rewardId: reward.id } });
            await tx.reward.delete({ where: { id: reward.id } });
          }

          // Upsert rewards
          for (const reward of rewards) {
            const rewardData = {
              projectId: params.id,
              type: reward.type,
              title: reward.title,
              description: reward.description,
              amount: reward.amount,
              imageUrl: reward.imageUrl || null,
              estimatedDelivery: reward.estimatedDelivery ? new Date(reward.estimatedDelivery) : null,
              shippingType: reward.shippingType,
              shippingCountries: reward.shippingCountries || [],
              shippingCost: reward.shippingCost || 0,
              quantityAvailable: reward.quantityAvailable ?? null,
              isEnded: reward.isEnded || false,
            };

            if (reward.id) {
              // Update existing reward
              const existingReward = existingRewards.find(r => r.id === reward.id);
              if (existingReward) {
                await tx.reward.update({
                  where: { id: reward.id },
                  data: rewardData,
                });

                // Update items - delete all and recreate
                await tx.rewardItem.deleteMany({ where: { rewardId: reward.id } });
                if (reward.items && reward.items.length > 0) {
                  await tx.rewardItem.createMany({
                    data: reward.items.map(item => ({
                      rewardId: reward.id!,
                      title: item.title,
                      description: item.description || null,
                      imageUrl: item.imageUrl || null,
                    })),
                  });
                }
              }
            } else {
              // Create new reward
              const newReward = await tx.reward.create({
                data: rewardData,
              });

              // Create items
              if (reward.items && reward.items.length > 0) {
                await tx.rewardItem.createMany({
                  data: reward.items.map(item => ({
                    rewardId: newReward.id,
                    title: item.title,
                    description: item.description || null,
                    imageUrl: item.imageUrl || null,
                  })),
                });
              }
            }
          }
        }

        return updatedProject;
      });

      // Handle collaborators if provided
      if (collaborators && collaborators.length > 0) {
        await handleCollaborators(params.id, collaborators, session.user.id, session.user.name || "Project Creator");
      }

      return NextResponse.json({ project: updated });
    } else {
      // No rewards to handle, just update project
      const updated = await db.project.update({
        where: { id: params.id },
        data: updateData,
      });

      // Handle collaborators if provided
      if (collaborators && collaborators.length > 0) {
        await handleCollaborators(params.id, collaborators, session.user.id, session.user.name || "Project Creator");
      }

      return NextResponse.json({ project: updated });
    }
  } catch (error) {
    console.error("Update project error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const project = await db.project.findUnique({
      where: { id: params.id },
      select: { creatorId: true, status: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.creatorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Can only delete draft projects
    if (project.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Can only delete draft projects" },
        { status: 400 }
      );
    }

    await db.project.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete project error:", error);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    );
  }
}
