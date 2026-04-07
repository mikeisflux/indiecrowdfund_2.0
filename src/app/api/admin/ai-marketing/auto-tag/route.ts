import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminAiMarketingAutoTagLogger = logger.child({ module: "admin-ai-marketing-auto-tag" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { autoTagProject } from "@/lib/ai";

// Force dynamic - this route uses auth/headers
export const dynamic = "force-dynamic";

// Helper to check admin role
async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.id) {
    return { error: "Unauthorized", status: 401 };
  }

  const user = await db.user.findFirst({
    where: { id: session.user.id, deletedAt: null },
    select: { role: true }
  });

  if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
    return { error: "Forbidden - Admin access required", status: 403 };
  }

  return { user: session.user };
}

// POST - Run auto-tagging on projects (preview mode - doesn't save)
export async function POST(request: Request) {
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const { projectIds, confidenceThreshold = 75, maxTags = 10 } = body;

    // Get projects to tag
    let projectsToTag;

    if (projectIds && projectIds.length > 0) {
      // Tag specific projects
      projectsToTag = await db.project.findMany({
        where: { id: { in: projectIds }, deletedAt: null },
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          goalAmount: true,
          tags: true,
          rewards: {
            select: { title: true, description: true, amount: true }
          }
        }
      });
    } else {
      // Tag projects with no tags or few tags
      projectsToTag = await db.project.findMany({
        where: {
          deletedAt: null,
          OR: [
            { tags: { isEmpty: true } },
            { tags: { equals: [] } }
          ]
        },
        take: 20,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          goalAmount: true,
          tags: true,
          rewards: {
            select: { title: true, description: true, amount: true }
          }
        }
      });
    }

    if (projectsToTag.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No projects need tagging",
        taggedProjects: [],
      });
    }

    // Generate tags for each project using AI
    const tagResults = await Promise.all(
      projectsToTag.map(async (project) => {
        try {
          const result = await autoTagProject({
            title: project.title,
            description: project.description || "",
            category: project.category || undefined,
            goalAmount: project.goalAmount ? Number(project.goalAmount) : undefined,
            rewards: project.rewards.map((r: { title: string; description: string | null; amount: number }) => ({
              title: r.title,
              description: r.description || "",
              amount: Number(r.amount)
            })),
          });

          // Filter tags by confidence threshold
          const filteredTags = result.confidence * 100 >= confidenceThreshold
            ? result.tags.slice(0, maxTags)
            : [];

          return {
            projectId: project.id,
            projectTitle: project.title,
            currentTags: project.tags as string[],
            suggestedTags: filteredTags,
            primaryCategory: result.primaryCategory,
            suggestedCategories: result.suggestedCategories,
            confidence: Math.round(result.confidence * 100),
            status: "pending" as const,
          };
        } catch (error) {
          adminAiMarketingAutoTagLogger.error({ err: String(error) }, `Error tagging project ${project.id}:`);
          return {
            projectId: project.id,
            projectTitle: project.title,
            currentTags: project.tags as string[],
            suggestedTags: [],
            primaryCategory: null,
            suggestedCategories: [],
            confidence: 0,
            status: "error" as const,
            error: "Failed to generate tags",
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      message: `Generated tags for ${tagResults.filter(r => r.suggestedTags.length > 0).length} projects`,
      taggedProjects: tagResults,
    });
  } catch (error) {
    adminAiMarketingAutoTagLogger.error({ err: String(error) }, "Error running auto-tagging:");
    return NextResponse.json(
      { error: "Failed to run auto-tagging" },
      { status: 500 }
    );
  }
}

// PATCH - Apply approved tags to projects
export async function PATCH(request: Request) {
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const { projectUpdates } = body;

    if (!projectUpdates || !Array.isArray(projectUpdates)) {
      return NextResponse.json(
        { error: "projectUpdates array is required" },
        { status: 400 }
      );
    }

    // Apply tags to each approved project
    const results = await Promise.all(
      projectUpdates.map(async (update: { projectId: string; tags: string[]; category?: string }) => {
        try {
          const updateData: { tags: string[]; category?: string } = {
            tags: update.tags,
          };

          // Optionally update category if provided
          if (update.category) {
            updateData.category = update.category.toUpperCase();
          }

          await db.project.update({
            where: { id: update.projectId },
            data: updateData,
          });

          return { projectId: update.projectId, success: true };
        } catch (error) {
          adminAiMarketingAutoTagLogger.error({ err: String(error) }, `Error updating project ${update.projectId}:`);
          return { projectId: update.projectId, success: false, error: "Failed to update" };
        }
      })
    );

    const successCount = results.filter(r => r.success).length;

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${successCount} of ${projectUpdates.length} projects`,
      results,
    });
  } catch (error) {
    adminAiMarketingAutoTagLogger.error({ err: String(error) }, "Error applying tags:");
    return NextResponse.json(
      { error: "Failed to apply tags" },
      { status: 500 }
    );
  }
}
