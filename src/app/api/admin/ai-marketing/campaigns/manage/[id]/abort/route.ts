import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { exec } from "child_process";

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

// POST - Abort sending campaign
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

    // Get campaign
    const campaign = await db.emailCampaign.findUnique({
      where: { id },
      select: { id: true, name: true, status: true },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Can only abort campaigns that are currently sending
    if (campaign.status !== "SENDING") {
      return NextResponse.json(
        { error: "Campaign is not currently sending" },
        { status: 400 }
      );
    }

    // Mark as cancelled
    await db.emailCampaign.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    console.log(`Campaign "${campaign.name}" has been aborted - restarting server to stop send`);

    // Send response first, then restart
    const response = NextResponse.json({
      success: true,
      message: `Campaign "${campaign.name}" has been aborted`,
    });

    // Restart PM2 to kill the running send process
    // Use setImmediate to send response before restart
    setImmediate(() => {
      // Delete and restart properly to preserve npm start config
      exec("cd /root/indiecrowdfund_2.0 && npx pm2 delete indiecrowdfund 2>/dev/null; npx pm2 start npm --name indiecrowdfund -- start", (error) => {
        if (error) {
          console.error("Failed to restart PM2:", error);
        }
      });
    });

    return response;
  } catch (error) {
    console.error("Error aborting campaign:", error);
    return NextResponse.json(
      { error: "Failed to abort campaign" },
      { status: 500 }
    );
  }
}
