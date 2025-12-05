import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createPledgePayment, calculateWiseFees } from "@/lib/payments/wise";
import { db } from "@/lib/db";

// Create a payment for a pledge
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { projectId, rewardId, addonIds = [], amount } = body;

    if (!projectId || !rewardId || !amount) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get project to check content type
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: {
        hasAdultContent: true,
        hasRiskyContent: true,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    const isNsfw = project.hasAdultContent || project.hasRiskyContent;

    const result = await createPledgePayment({
      projectId,
      rewardId,
      addonIds,
      amount,
      userId: session.user.id,
      isNsfw,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Payment creation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Payment failed" },
      { status: 500 }
    );
  }
}

// Get fee estimate for a payment amount
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const amountStr = searchParams.get("amount");
  const international = searchParams.get("international") === "true";

  if (!amountStr) {
    return NextResponse.json(
      { error: "Amount is required" },
      { status: 400 }
    );
  }

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "Invalid amount" },
      { status: 400 }
    );
  }

  const fees = calculateWiseFees(amount, international);
  return NextResponse.json(fees);
}
