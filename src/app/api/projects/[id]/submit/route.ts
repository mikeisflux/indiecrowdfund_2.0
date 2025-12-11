import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { moderateContent, analyzeFraud } from "@/lib/ai/anthropic";
import { canUserEditProject } from "@/lib/project-auth";

// POST - Submit project for review
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

    // Verify ownership or collaborator with edit permission
    const canEdit = await canUserEditProject(projectId, session.user.id, project.creatorId);
    if (!canEdit) {
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
      (r: { title: string | null; description: string | null; amount: number }) => !r.title || !r.description || r.amount <= 0
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

    // AI-powered flag detection
    const flagsRaised: string[] = [];
    let aiConfidenceScore = 100;

    // Get creator project count for context
    const creatorProjectCount = await db.project.count({
      where: {
        creatorId: project.creatorId,
        status: { in: ["LIVE", "FUNDED", "APPROVED"] },
      },
    });

    // Run AI moderation and fraud detection in parallel
    let aiModerationResult = null;
    let aiFraudResult = null;

    try {
      const projectContent = {
        title: project.title,
        description: project.description,
        risks: project.risks,
        rewards: project.rewards.map((r: { title: string | null; description: string | null; amount: number }) => ({
          title: r.title || "",
          description: r.description || "",
          amount: r.amount,
        })),
        goalAmount: project.goalAmount,
        creatorName: project.creator.name || "Unknown",
        creatorEmail: project.creator.email || undefined,
        creatorProjectCount,
      };

      // Only run AI if API keys are configured
      if (process.env.ANTHROPIC_API_KEY) {
        [aiModerationResult, aiFraudResult] = await Promise.all([
          moderateContent(projectContent),
          analyzeFraud(projectContent),
        ]);

        // Apply AI moderation flags
        if (aiModerationResult) {
          if (!aiModerationResult.isApproved) {
            flagsRaised.push("ai_moderation_failed");
          }
          if (aiModerationResult.riskLevel === "high" || aiModerationResult.riskLevel === "critical") {
            flagsRaised.push(`ai_risk_${aiModerationResult.riskLevel}`);
          }
          aiModerationResult.flags.forEach((flag) => {
            if (!flagsRaised.includes(flag)) {
              flagsRaised.push(flag);
            }
          });
        }

        // Apply AI fraud detection flags
        if (aiFraudResult) {
          if (aiFraudResult.fraudScore > 70) {
            flagsRaised.push("ai_high_fraud_risk");
            aiConfidenceScore = Math.max(0, 100 - aiFraudResult.fraudScore);
          } else if (aiFraudResult.fraudScore > 50) {
            flagsRaised.push("ai_medium_fraud_risk");
            aiConfidenceScore = Math.max(20, 100 - aiFraudResult.fraudScore);
          }
          aiFraudResult.riskFactors.forEach((rf) => {
            if (rf.severity === "high" && !flagsRaised.includes(rf.factor)) {
              flagsRaised.push(rf.factor);
            }
          });
        }
      }
    } catch (aiError) {
      console.error("AI analysis failed, falling back to rule-based checks:", aiError);
      flagsRaised.push("ai_analysis_failed");
    }

    // Fallback rule-based checks (always run as backup)
    const descriptionLower = project.description.toLowerCase();
    const titleLower = project.title.toLowerCase();

    // Flag: First-time creator
    if (creatorProjectCount === 0) {
      if (!flagsRaised.includes("first_project")) {
        flagsRaised.push("first_project");
        aiConfidenceScore = Math.max(0, aiConfidenceScore - 5);
      }
    }

    // Flag: Unverified creator
    if (!project.creator.email) {
      if (!flagsRaised.includes("unverified_creator")) {
        flagsRaised.push("unverified_creator");
        aiConfidenceScore = Math.max(0, aiConfidenceScore - 15);
      }
    }

    // Flag: No video
    if (!project.videoUrl) {
      if (!flagsRaised.includes("no_video")) {
        flagsRaised.push("no_video");
        aiConfidenceScore = Math.max(0, aiConfidenceScore - 5);
      }
    }

    // Flag: High funding goal
    if (project.goalAmount > 100000 && !flagsRaised.includes("high_goal")) {
      flagsRaised.push("high_goal");
      aiConfidenceScore = Math.max(0, aiConfidenceScore - 5);
    }
    if (project.goalAmount > 500000 && !flagsRaised.includes("unrealistic_goal")) {
      flagsRaised.push("unrealistic_goal");
      aiConfidenceScore = Math.max(0, aiConfidenceScore - 15);
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
    if (hasSuspiciousClaims && !flagsRaised.includes("suspicious_claims")) {
      flagsRaised.push("suspicious_claims");
      aiConfidenceScore = Math.max(0, aiConfidenceScore - 25);
    }

    // Flag: Very short campaign
    if (project.durationDays && project.durationDays < 10 && !flagsRaised.includes("short_campaign")) {
      flagsRaised.push("short_campaign");
      aiConfidenceScore = Math.max(0, aiConfidenceScore - 10);
    }

    // Flag: No risks mentioned
    if ((project.risks.toLowerCase().includes("no risk") || project.risks.length < 100) && !flagsRaised.includes("inadequate_risks")) {
      flagsRaised.push("inadequate_risks");
      aiConfidenceScore = Math.max(0, aiConfidenceScore - 10);
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
