import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST - Apply a balance adjustment (credit or charge) to a pledge
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { pledgeId, projectId, type, amount, reason } = body;

    if (!pledgeId || !projectId) {
      return NextResponse.json({ error: "pledgeId and projectId are required" }, { status: 400 });
    }

    if (!type || !["credit", "charge"].includes(type)) {
      return NextResponse.json({ error: "type must be 'credit' or 'charge'" }, { status: 400 });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
    }

    // Verify user has access to this project
    const project = await db.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { creatorId: session.user.id },
          {
            collaborators: {
              some: {
                userId: session.user.id,
                status: "ACCEPTED",
              },
            },
          },
        ],
      },
      select: { id: true, title: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 403 });
    }

    // Get the pledge
    const pledge = await db.pledge.findFirst({
      where: {
        id: pledgeId,
        projectId,
        status: "COMPLETED",
      },
      select: {
        id: true,
        amount: true,
        rewardAmount: true,
        addonsAmount: true,
        shippingAmount: true,
        user: { select: { name: true, email: true } },
      },
    });

    if (!pledge) {
      return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
    }

    const currentAmount = Number(pledge.amount);
    const rewardAmt = Number(pledge.rewardAmount);
    const addonsAmt = Number(pledge.addonsAmount);
    const shippingAmt = Number(pledge.shippingAmount);
    const currentExpected = rewardAmt + addonsAmt + shippingAmt;
    const currentBalanceDue = Math.max(0, currentExpected - currentAmount);

    let newAmount = currentAmount;
    let newAddonsAmount = addonsAmt;

    if (type === "credit") {
      // Credit: increase the "collected" amount to reduce balance due
      newAmount = currentAmount + parsedAmount;
    } else {
      // Charge: increase the addons amount to increase what's owed
      newAddonsAmount = addonsAmt + parsedAmount;
    }

    // Update the pledge
    await db.pledge.update({
      where: { id: pledgeId },
      data: {
        amount: type === "credit" ? newAmount : currentAmount,
        addonsAmount: type === "charge" ? newAddonsAmount : addonsAmt,
      },
    });

    // Calculate new balance
    const newExpected = rewardAmt + (type === "charge" ? newAddonsAmount : addonsAmt) + shippingAmt;
    const updatedAmount = type === "credit" ? newAmount : currentAmount;
    const newBalanceDue = Math.max(0, newExpected - updatedAmount);

    // Log the activity
    await db.fulfillmentActivity.create({
      data: {
        projectId,
        type: "BALANCE_ADJUSTED",
        title: `Balance ${type === "credit" ? "Credit" : "Charge"} Applied`,
        description: `$${parsedAmount.toFixed(2)} ${type} applied to ${pledge.user.name || pledge.user.email}. ${reason || ""}. Balance: $${currentBalanceDue.toFixed(2)} → $${newBalanceDue.toFixed(2)}`,
        pledgeId,
        userId: session.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      balance: {
        pledgeAmount: updatedAmount,
        pledgeLevelAmount: rewardAmt,
        addonsAmount: type === "charge" ? newAddonsAmount : addonsAmt,
        shippingAmount: shippingAmt,
        totalCharged: updatedAmount,
        balanceDue: newBalanceDue,
      },
      previousBalanceDue: currentBalanceDue,
      newBalanceDue,
    });
  } catch (error) {
    console.error("Balance adjustment error:", error);
    return NextResponse.json(
      { error: "Failed to apply balance adjustment" },
      { status: 500 }
    );
  }
}
