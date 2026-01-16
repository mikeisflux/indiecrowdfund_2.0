import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyProjectLaunched } from "@/lib/notifications";
import { canUserEditProject } from "@/lib/project-auth";

// Helper function to calculate fulfillment percentage for a project
async function getProjectFulfillmentPercentage(projectId: string): Promise<number> {
  const pledges = await db.pledge.findMany({
    where: {
      projectId,
      status: "COMPLETED",
    },
    select: {
      fulfillmentStatus: true,
    },
  });

  if (pledges.length === 0) return 0;

  const fulfilledCount = pledges.filter(
    (p) => p.fulfillmentStatus === "DELIVERED"
  ).length;

  return (fulfilledCount / pledges.length) * 100;
}

// POST - Launch an approved project
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = params.id;

    // Get user with role
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get the project with creator info for URL construction
    const project = await db.project.findUnique({
      where: { id: projectId },
      include: {
        rewards: true,
        creator: {
          select: {
            vanityUrl: true,
            username: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Verify ownership or collaborator with edit permission
    const canEdit = await canUserEditProject(projectId, session.user.id, project.creatorId);
    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if project is approved
    if (project.status !== "APPROVED") {
      return NextResponse.json(
        {
          error: "Only approved projects can be launched",
          currentStatus: project.status,
          message:
            project.status === "DRAFT"
              ? "Please submit your project for review first."
              : project.status === "SUBMITTED"
              ? "Your project is still under review."
              : `Project status is ${project.status}.`,
        },
        { status: 400 }
      );
    }

    // Check campaign limits based on user role (skip for ADMIN/SUPER_ADMIN)
    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      // Get all user's projects that are LIVE or FUNDED (not yet fully fulfilled)
      const userProjects = await db.project.findMany({
        where: {
          creatorId: user.id,
          status: { in: ["LIVE", "FUNDED"] },
        },
        select: {
          id: true,
          status: true,
        },
      });

      // Calculate fulfillment for each project
      const projectsWithFulfillment = await Promise.all(
        userProjects.map(async (p) => ({
          ...p,
          fulfillmentPercentage: await getProjectFulfillmentPercentage(p.id),
        }))
      );

      // Count unfulfilled campaigns (< 85% fulfilled)
      const unfulfilledCampaigns = projectsWithFulfillment.filter(
        (p) => p.fulfillmentPercentage < 85
      );

      // Count currently LIVE campaigns
      const liveCampaigns = projectsWithFulfillment.filter(
        (p) => p.status === "LIVE"
      );

      if (user.role === "COOL_KIDS") {
        // Cool Kids: Can have multiple active, but max 6 campaigns < 85% fulfilled
        if (unfulfilledCampaigns.length >= 6) {
          return NextResponse.json(
            {
              error: "Campaign limit reached",
              message: "Cool Kids can have up to 6 campaigns that are less than 85% fulfilled. Please complete fulfillment on existing campaigns before launching a new one.",
              unfulfilledCount: unfulfilledCampaigns.length,
              limit: 6,
            },
            { status: 400 }
          );
        }
      } else {
        // Standard USER: Max 3 unfulfilled total, only 1 LIVE at a time
        if (unfulfilledCampaigns.length >= 3) {
          return NextResponse.json(
            {
              error: "Campaign limit reached",
              message: "You can have up to 3 unfulfilled campaigns. Please complete fulfillment on existing campaigns before launching a new one.",
              unfulfilledCount: unfulfilledCampaigns.length,
              limit: 3,
            },
            { status: 400 }
          );
        }

        if (liveCampaigns.length >= 1) {
          return NextResponse.json(
            {
              error: "Active campaign limit reached",
              message: "Standard users can only have 1 active (LIVE) campaign at a time. Please wait for your current campaign to end before launching another.",
              activeCampaigns: liveCampaigns.length,
              limit: 1,
            },
            { status: 400 }
          );
        }
      }
    }

    // Calculate end date based on duration settings
    const now = new Date();
    let endDate: Date;

    if (project.durationType === "END_DATE" && project.endDate) {
      endDate = new Date(project.endDate);
      // Ensure end date is in the future
      if (endDate <= now) {
        return NextResponse.json(
          { error: "End date must be in the future" },
          { status: 400 }
        );
      }
    } else if (project.durationType === "FIXED_DAYS" && project.durationDays) {
      endDate = new Date(now);
      endDate.setDate(endDate.getDate() + project.durationDays);
    } else {
      return NextResponse.json(
        { error: "Invalid duration settings" },
        { status: 400 }
      );
    }

    // Update project to LIVE status and clear prelaunch data
    let updatedProject;
    try {
      updatedProject = await db.project.update({
        where: { id: projectId },
        data: {
          status: "LIVE",
          launchDate: now,
          launchedAt: now,
          endDate,
          // Clear prelaunch data - no longer needed once live
          prelaunchActive: false,
          prelaunchDescription: null,
          prelaunchStatus: "DRAFT", // Reset to draft for any future use
        },
      });
    } catch (dbError) {
      console.error("Failed to update project status:", dbError);
      throw new Error(`Failed to update project: ${dbError instanceof Error ? dbError.message : "Unknown DB error"}`);
    }

    // Create a review record for the launch
    try {
      await db.projectReview.create({
        data: {
          projectId,
          action: "APPROVED", // Technically "LAUNCHED" but we use APPROVED action
          previousStatus: "APPROVED",
          newStatus: "LIVE",
          notes: "Project launched by creator",
        },
      });
    } catch (reviewError) {
      console.error("Failed to create review record:", reviewError);
      // Don't throw - review record is not critical
    }

    // Send launch notifications to followers and creator
    try {
      await notifyProjectLaunched(projectId);
    } catch (notifyError) {
      console.error("Failed to send launch notifications:", notifyError);
      // Don't throw - notifications are not critical
    }

    // Construct the correct project URL using vanity name
    const creatorVanity = project.creator?.vanityUrl || project.creator?.username || "projects";
    const projectUrl = `/projects/${creatorVanity}/${project.slug}`;

    return NextResponse.json({
      success: true,
      project: {
        ...updatedProject,
        projectUrl,
      },
      message: "Your project is now live!",
      endDate: endDate.toISOString(),
    });
  } catch (error) {
    console.error("Error launching project:", error);
    // Log more details about the error
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    return NextResponse.json(
      { error: "Failed to launch project", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
