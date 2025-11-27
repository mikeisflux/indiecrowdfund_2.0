import { NextRequest, NextResponse } from "next/server";
import { getServerSession, authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// POST - Submit project for review
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = params.id;

    // Get the project
    const project = await db.project.findUnique({
      where: { id: projectId },
      include: {
        rewards: true,
        creator: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Verify ownership
    if (project.creatorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if project can be submitted
    if (project.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Only draft projects can be submitted for review" },
        { status: 400 }
      );
    }

    // Validate required fields
    const validationErrors: string[] = [];

    if (!project.title || project.title.length < 5) {
      validationErrors.push("Project title must be at least 5 characters");
    }

    if (!project.description || project.description.length < 100) {
      validationErrors.push("Project description must be at least 100 characters");
    }

    if (!project.risks || project.risks.length < 50) {
      validationErrors.push("Risks section must be at least 50 characters");
    }

    if (!project.goalAmount || project.goalAmount < 100) {
      validationErrors.push("Funding goal must be at least $100");
    }

    if (!project.category) {
      validationErrors.push("Project category is required");
    }

    if (!project.imageUrl) {
      validationErrors.push("Project main image is required");
    }

    if (project.rewards.length === 0) {
      validationErrors.push("At least one reward tier is required");
    }

    // Check rewards have required fields
    const invalidRewards = project.rewards.filter(
      (r) => !r.title || !r.description || r.amount <= 0
    );
    if (invalidRewards.length > 0) {
      validationErrors.push("All reward tiers must have a title, description, and price");
    }

    if (!project.contactEmail) {
      validationErrors.push("Contact email is required");
    }

    // If there are validation errors, return them
    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          error: "Project is not ready for submission",
          validationErrors,
        },
        { status: 400 }
      );
    }

    // AI-powered flag detection (basic implementation)
    const flagsRaised: string[] = [];
    let aiConfidenceScore = 100;

    // Check for suspicious patterns
    const descriptionLower = project.description.toLowerCase();
    const titleLower = project.title.toLowerCase();

    // Flag: First-time creator
    const creatorProjectCount = await db.project.count({
      where: {
        creatorId: project.creatorId,
        status: { in: ["LIVE", "FUNDED", "APPROVED"] },
      },
    });
    if (creatorProjectCount === 0) {
      flagsRaised.push("first_project");
      aiConfidenceScore -= 5;
    }

    // Flag: Unverified creator
    if (!project.creator.email) {
      flagsRaised.push("unverified_creator");
      aiConfidenceScore -= 15;
    }

    // Flag: No video
    if (!project.videoUrl) {
      flagsRaised.push("no_video");
      aiConfidenceScore -= 5;
    }

    // Flag: High funding goal
    if (project.goalAmount > 100000) {
      flagsRaised.push("high_goal");
      aiConfidenceScore -= 5;
    }
    if (project.goalAmount > 500000) {
      flagsRaised.push("unrealistic_goal");
      aiConfidenceScore -= 15;
    }

    // Flag: Suspicious claims
    const suspiciousTerms = [
      "guaranteed",
      "risk-free",
      "100% return",
      "get rich",
      "money back guaranteed",
      "investment opportunity",
      "cryptocurrency",
      "bitcoin",
      "nft",
    ];
    const hasSuspiciousClaims = suspiciousTerms.some(
      (term) =>
        descriptionLower.includes(term) ||
        titleLower.includes(term) ||
        project.risks.toLowerCase().includes(term)
    );
    if (hasSuspiciousClaims) {
      flagsRaised.push("suspicious_claims");
      aiConfidenceScore -= 25;
    }

    // Flag: Very short campaign
    if (project.durationDays && project.durationDays < 10) {
      flagsRaised.push("short_campaign");
      aiConfidenceScore -= 10;
    }

    // Flag: No risks mentioned
    if (project.risks.toLowerCase().includes("no risk") || project.risks.length < 100) {
      flagsRaised.push("inadequate_risks");
      aiConfidenceScore -= 10;
    }

    // Ensure score is between 0 and 100
    aiConfidenceScore = Math.max(0, Math.min(100, aiConfidenceScore));

    // Update project status and create review record
    const [updatedProject] = await db.$transaction([
      db.project.update({
        where: { id: projectId },
        data: { status: "SUBMITTED" },
      }),
      db.projectReview.create({
        data: {
          projectId,
          action: "SUBMITTED",
          previousStatus: project.status,
          newStatus: "SUBMITTED",
          flagsRaised,
          aiConfidenceScore,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      project: updatedProject,
      review: {
        flagsRaised,
        aiConfidenceScore,
        message:
          flagsRaised.length > 0
            ? "Your project has been submitted but flagged for manual review."
            : "Your project has been submitted for review.",
      },
    });
  } catch (error) {
    console.error("Error submitting project:", error);
    return NextResponse.json(
      { error: "Failed to submit project" },
      { status: 500 }
    );
  }
}
