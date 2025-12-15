import { NextResponse } from "next/server";
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
    select: { id: true, role: true },
  });

  if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
    return { error: "Forbidden - Admin access required", status: 403 };
  }

  return { user: { ...session.user, id: user.id } };
}

export async function GET() {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    // Get all pledges with key fields
    const pledges = await db.pledge.findMany({
      select: {
        id: true,
        status: true,
        chargedImmediately: true,
        stripePaymentMethodId: true,
        stripePaymentIntentId: true,
        stripeSetupIntentId: true,
        amount: true,
        lastFailureReason: true,
        createdAt: true,
      },
    });

    // Status breakdown
    const statusCounts: Record<string, number> = {};
    for (const p of pledges) {
      statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
    }

    // Find stuck pledges: PENDING + chargedImmediately=true + no paymentMethodId
    const stuckPledges = pledges.filter(
      (p) =>
        p.status === "PENDING" &&
        p.chargedImmediately === true &&
        !p.stripePaymentMethodId
    );

    // Check for duplicate PaymentIntents (potential double charges)
    const paymentIntentCounts: Record<string, number> = {};
    for (const p of pledges) {
      if (p.stripePaymentIntentId) {
        paymentIntentCounts[p.stripePaymentIntentId] =
          (paymentIntentCounts[p.stripePaymentIntentId] || 0) + 1;
      }
    }
    const duplicatePaymentIntents = Object.entries(paymentIntentCounts)
      .filter(([, count]) => count > 1)
      .map(([pi, count]) => ({ paymentIntentId: pi, pledgeCount: count }));

    // Check for duplicate SetupIntents
    const setupIntentCounts: Record<string, number> = {};
    for (const p of pledges) {
      if (p.stripeSetupIntentId) {
        setupIntentCounts[p.stripeSetupIntentId] =
          (setupIntentCounts[p.stripeSetupIntentId] || 0) + 1;
      }
    }
    const duplicateSetupIntents = Object.entries(setupIntentCounts)
      .filter(([, count]) => count > 1)
      .map(([si, count]) => ({ setupIntentId: si, pledgeCount: count }));

    // Failure reasons breakdown
    const failedPledges = pledges.filter((p) => p.status === "FAILED");
    const failureReasons: Record<string, number> = {};
    for (const p of failedPledges) {
      const reason = p.lastFailureReason || "Unknown";
      failureReasons[reason] = (failureReasons[reason] || 0) + 1;
    }

    // COMPLETED pledges breakdown
    const completedPledges = pledges.filter((p) => p.status === "COMPLETED");
    const completedBreakdown = {
      total: completedPledges.length,
      withPaymentIntent: completedPledges.filter((p) => p.stripePaymentIntentId)
        .length,
      withSetupIntent: completedPledges.filter((p) => p.stripeSetupIntentId)
        .length,
      withBoth: completedPledges.filter(
        (p) => p.stripePaymentIntentId && p.stripeSetupIntentId
      ).length,
    };

    return NextResponse.json({
      totalPledges: pledges.length,
      statusCounts,
      stuckPledges: {
        count: stuckPledges.length,
        details: stuckPledges.map((p) => ({
          id: p.id,
          amount: p.amount,
          createdAt: p.createdAt,
          paymentIntentId: p.stripePaymentIntentId,
          setupIntentId: p.stripeSetupIntentId,
          failureReason: p.lastFailureReason,
        })),
      },
      duplicatePaymentIntents: {
        count: duplicatePaymentIntents.length,
        details: duplicatePaymentIntents,
      },
      duplicateSetupIntents: {
        count: duplicateSetupIntents.length,
        details: duplicateSetupIntents,
      },
      failureReasons,
      completedBreakdown,
    });
  } catch (error) {
    console.error("Error analyzing pledges:", error);
    return NextResponse.json(
      { error: "Failed to analyze pledges" },
      { status: 500 }
    );
  }
}
