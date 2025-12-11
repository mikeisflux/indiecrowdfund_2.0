import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { sendCollaboratorInviteEmail } from "@/lib/email";

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
  console.log(`Processing ${collaborators.length} collaborators for project ${projectId}`);

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
  console.log(`Existing collaborator emails: ${Array.from(existingEmails).join(", ")}`);

  for (const collab of collaborators) {
    const emailLower = collab.email.toLowerCase();

    // Skip if already a collaborator
    if (existingEmails.has(emailLower)) {
      console.log(`Skipping ${emailLower} - already a collaborator`);
      continue;
    }

    console.log(`Processing new collaborator: ${emailLower}`);

    try {
      // Find user by email
      const user = await db.user.findUnique({
        where: { email: emailLower },
        select: { id: true },
      });

      if (user) {
        console.log(`User found for ${emailLower}, creating collaborator record`);

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
        console.log(`Sending collaborator invite email to ${collab.email}`);
        const emailResult = await sendCollaboratorInviteEmail(
          collab.email,
          creatorName,
          project.title,
          collaboratorRecord.id
        );
        console.log(`Email result for ${collab.email}:`, emailResult);
      } else {
        console.log(`User not found for ${emailLower}, creating pending collaborator`);

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
        console.log(`Sending collaborator invite email to ${collab.email} (new user)`);
        const emailResult = await sendCollaboratorInviteEmail(
          collab.email,
          creatorName,
          project.title,
          collaboratorRecord.id
        );
        console.log(`Email result for ${collab.email}:`, emailResult);
      }
    } catch (error) {
      console.error(`Error processing collaborator ${emailLower}:`, error);
      // Continue processing other collaborators even if one fails
    }
  }

  console.log("Finished processing collaborators");
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
      select: { creatorId: true, status: true },
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

    // Can only edit draft/submitted/approved projects
    // LIVE/FUNDED projects can only be edited via specific endpoints (e.g., end reward)
    if (!["DRAFT", "SUBMITTED", "APPROVED"].includes(project.status)) {
      return NextResponse.json(
        { error: "Cannot edit launched project" },
        { status: 400 }
      );
    }

    const body = await req.json();
    console.log("[API Debug] Received body - rewards count:", body.rewards?.length || 0);
    console.log("[API Debug] Rewards received:", JSON.stringify(body.rewards || []).substring(0, 500));

    const data = updateProjectSchema.parse(body);

    // Extract rewards and collaborators for separate handling
    const { rewards, collaborators, ...projectData } = data;
    console.log("[API Debug] After validation - rewards count:", rewards?.length || 0);

    // Prepare project update data
    const updateData: Record<string, unknown> = {};

    // Add basic fields
    if (projectData.title !== undefined) updateData.title = projectData.title;
    if (projectData.subtitle !== undefined) updateData.subtitle = projectData.subtitle;
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
    if (projectData.prelaunchActive !== undefined) updateData.prelaunchActive = projectData.prelaunchActive;
    if (projectData.prelaunchDescription !== undefined) updateData.prelaunchDescription = projectData.prelaunchDescription;
    if (projectData.customReferralTags !== undefined) updateData.customReferralTags = projectData.customReferralTags;
    if (projectData.googleAnalyticsId !== undefined) updateData.googleAnalyticsId = projectData.googleAnalyticsId;
    if (projectData.metaPixelId !== undefined) updateData.metaPixelId = projectData.metaPixelId;

    // Status
    if (projectData.status !== undefined) updateData.status = projectData.status;

    // Update project using transaction if we have rewards to handle
    console.log("[API Debug] Processing rewards - count:", rewards?.length || 0, "condition:", rewards && rewards.length > 0);
    if (rewards && rewards.length > 0) {
      console.log("[API Debug] Entering rewards transaction");
      // Use transaction to update project and rewards together
      const updated = await db.$transaction(async (tx) => {
        // Update project
        const updatedProject = await tx.project.update({
          where: { id: params.id },
          data: updateData,
        });

        // Delete existing rewards that are not in the new list (only if they have no pledges)
        const existingRewards = await tx.reward.findMany({
          where: { projectId: params.id },
          include: { _count: { select: { pledges: true } } },
        });

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
          console.log("[API Debug] Processing reward:", reward.id || "NEW", reward.title, "items:", reward.items?.length || 0);
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
