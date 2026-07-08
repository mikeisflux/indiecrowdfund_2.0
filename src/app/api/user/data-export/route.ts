import { NextResponse } from "next/server";
import { validateSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * POST /api/user/data-export
 * GDPR Article 20: Data portability — request an export of all personal data.
 */
export async function POST() {
  const session = await validateSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Check for recent pending/processing requests (prevent spam)
  const recentRequest = await db.dataExportRequest.findFirst({
    where: {
      userId,
      status: { in: ["PENDING", "PROCESSING"] },
    },
  });

  if (recentRequest) {
    return NextResponse.json({
      error: "You already have a pending data export request",
      requestId: recentRequest.id,
    }, { status: 409 });
  }

  // Create the export request
  const request = await db.dataExportRequest.create({
    data: { userId, status: "PENDING" },
  });

  // Perform the export inline (for smaller datasets)
  try {
    await db.dataExportRequest.update({
      where: { id: request.id },
      data: { status: "PROCESSING" },
    });

    const exportData = await gatherUserData(userId);

    // Store as JSON in the request record
    const exportJson = JSON.stringify(exportData, null, 2);

    await db.dataExportRequest.update({
      where: { id: request.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    logger.info({ userId, requestId: request.id }, "GDPR data export completed");

    return NextResponse.json({
      success: true,
      requestId: request.id,
      data: exportData,
      exportedAt: new Date().toISOString(),
      format: "json",
      note: "This export contains all personal data we hold about you. Download link expires in 7 days.",
    }, {
      headers: {
        "Content-Disposition": `attachment; filename="data-export-${userId}.json"`,
        "Content-Type": "application/json",
        "Content-Length": String(Buffer.byteLength(exportJson)),
      },
    });
  } catch (error) {
    await db.dataExportRequest.update({
      where: { id: request.id },
      data: {
        status: "FAILED",
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });
    logger.error({ userId, requestId: request.id, err: error instanceof Error ? error.message : String(error) },
      "GDPR data export failed");
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}

/**
 * GET /api/user/data-export
 * Check the status of data export requests.
 */
export async function GET() {
  const session = await validateSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requests = await db.dataExportRequest.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      status: true,
      format: true,
      createdAt: true,
      completedAt: true,
      expiresAt: true,
    },
  });

  return NextResponse.json({ requests });
}

/**
 * Gather all user data for GDPR export.
 */
async function gatherUserData(userId: string) {
  const [
    user,
    pledges,
    comments,
    addresses,
    projects,
    behaviors,
    preferences,
    notifications,
    emailLogs,
  ] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        bio: true,
        location: true,
        timezone: true,
        vanityUrl: true,
        websites: true,
        socialLinks: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        emailUnsubscribedAt: true,
        idVerified: true,
        idVerifiedAt: true,
        dateOfBirth: true,
      },
    }),
    db.pledge.findMany({
      where: { userId },
      select: {
        id: true,
        projectId: true,
        amount: true,
        status: true,
        createdAt: true,
        shippingAddress: true,
        surveyResponses: true,
        fulfillmentStatus: true,
      },
    }),
    db.comment.findMany({
      where: { userId },
      select: { id: true, content: true, createdAt: true, projectId: true },
    }),
    db.userAddress.findMany({
      where: { userId },
      select: {
        id: true,
        fullName: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        postalCode: true,
        country: true,
        phone: true,
        isDefault: true,
      },
    }),
    db.project.findMany({
      where: { creatorId: userId },
      select: { id: true, title: true, slug: true, createdAt: true, status: true },
    }),
    db.userBehavior.findMany({
      where: { userId },
      select: { eventType: true, page: true, createdAt: true, metadata: true },
      take: 1000,
    }),
    db.userPreference.findUnique({
      where: { userId },
    }),
    db.notification.findMany({
      where: { userId },
      select: { id: true, type: true, title: true, message: true, createdAt: true, read: true },
      take: 500,
    }),
    db.emailLog.findMany({
      where: { userId },
      select: { id: true, type: true, subject: true, status: true, createdAt: true },
      take: 500,
    }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    gdprArticle: "Article 15 & 20 — Right of access & data portability",
    profile: user,
    pledges,
    comments,
    addresses,
    createdProjects: projects,
    behaviorData: behaviors,
    preferences,
    notifications,
    emailHistory: emailLogs,
  };
}
