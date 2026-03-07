import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminAiMarketingCampaignsManageDuplicateLogger = logger.child({ module: "admin-ai-marketing-campaigns-manage-duplicate" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Helper to check admin role
async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.id) {
    return { error: "Unauthorized", status: 401 };
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
    return { error: "Forbidden - Admin access required", status: 403 };
  }

  return { user: session.user };
}

// POST - Duplicate campaign
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { id } = await params;

    // Get original campaign
    const original = await db.emailCampaign.findUnique({
      where: { id },
      select: {
        name: true,
        subject: true,
        htmlContent: true,
        targetAudience: true,
        filters: true,
        recipientCount: true,
      },
    });

    if (!original) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Create duplicate with "Copy of" prefix
    const duplicate = await db.emailCampaign.create({
      data: {
        name: `Copy of ${original.name}`,
        subject: original.subject,
        htmlContent: original.htmlContent,
        targetAudience: original.targetAudience,
        filters: original.filters || undefined,
        recipientCount: original.recipientCount,
        status: "DRAFT",
      },
    });

    return NextResponse.json({
      success: true,
      campaign: {
        id: duplicate.id,
        name: duplicate.name,
        status: duplicate.status,
      },
      message: `Campaign duplicated as "${duplicate.name}"`,
    });
  } catch (error) {
    adminAiMarketingCampaignsManageDuplicateLogger.error({ err: String(error) }, "Error duplicating campaign:");
    return NextResponse.json(
      { error: "Failed to duplicate campaign" },
      { status: 500 }
    );
  }
}
