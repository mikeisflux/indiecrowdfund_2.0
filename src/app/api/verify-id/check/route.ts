import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requiresIdVerification } from "@/lib/shufti";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/verify-id/check?projectId=xxx - Check if project requires ID verification
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    // Get session (optional - can check without being logged in)
    const session = await getServerSession(authOptions);

    // Check verification settings
    const settings = await prisma.platformSettings.findUnique({
      where: { id: "default" },
      select: { idVerificationEnabled: true },
    });

    // If verification not enabled, no requirements
    if (!settings?.idVerificationEnabled) {
      return NextResponse.json({
        required: false,
        verified: true,
        enabled: false,
      });
    }

    // Check if project requires verification
    const result = await requiresIdVerification(projectId, session?.user?.id);

    return NextResponse.json({
      ...result,
      enabled: true,
      loggedIn: !!session?.user?.id,
    });
  } catch (error) {
    console.error("Error checking verification requirement:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
