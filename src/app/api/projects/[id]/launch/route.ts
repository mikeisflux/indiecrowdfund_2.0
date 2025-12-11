import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyProjectLaunched } from "@/lib/notifications";

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

    // Get the project
    const project = await db.project.findUnique({
      where: { id: projectId },
      include: {
        rewards: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Verify ownership
    if (project.creatorId !== session.user.id) {
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

    // Update project to LIVE status
    const updatedProject = await db.project.update({
      where: { id: projectId },
      data: {
        status: "LIVE",
        launchDate: now,
        launchedAt: now,
        endDate,
      },
    });

    // Create a review record for the launch
    await db.projectReview.create({
      data: {
        projectId,
        action: "APPROVED", // Technically "LAUNCHED" but we use APPROVED action
        previousStatus: "APPROVED",
        newStatus: "LIVE",
        notes: "Project launched by creator",
      },
    });

    // Send launch notifications to followers and creator
    await notifyProjectLaunched(projectId);

    return NextResponse.json({
      success: true,
      project: updatedProject,
      message: "Your project is now live!",
      endDate: endDate.toISOString(),
    });
  } catch (error) {
    console.error("Error launching project:", error);
    return NextResponse.json(
      { error: "Failed to launch project" },
      { status: 500 }
    );
  }
}
