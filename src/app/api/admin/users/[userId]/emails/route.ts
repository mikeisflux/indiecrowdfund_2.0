import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyBackerPledgeConfirmed } from "@/lib/notifications";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin status
    const currentUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (currentUser?.role !== "ADMIN" && currentUser?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { userId } = await params;

    // Get user's email logs
    const emailLogs = await db.emailLog.findMany({
      where: { userId },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
        pledge: {
          select: {
            id: true,
            amount: true,
            status: true,
          },
        },
      },
      orderBy: { sentAt: "desc" },
    });

    return NextResponse.json({ emailLogs });
  } catch (error) {
    console.error("Error fetching user emails:", error);
    return NextResponse.json(
      { error: "Failed to fetch user emails" },
      { status: 500 }
    );
  }
}

// POST to resend confirmation email for a pledge
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin status
    const currentUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (currentUser?.role !== "ADMIN" && currentUser?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { userId } = await params;
    const body = await req.json();
    const { pledgeId, forceResend } = body;

    if (!pledgeId) {
      return NextResponse.json({ error: "pledgeId is required" }, { status: 400 });
    }

    // Get the pledge
    const pledge = await db.pledge.findUnique({
      where: { id: pledgeId },
      select: {
        id: true,
        userId: true,
        confirmationEmailSent: true,
        chargedImmediately: true,
        status: true,
        stripePaymentMethodId: true,
      },
    });

    if (!pledge) {
      return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
    }

    if (pledge.userId !== userId) {
      return NextResponse.json({ error: "Pledge does not belong to this user" }, { status: 400 });
    }

    // Check if pledge is valid (either COMPLETED or has saved payment method)
    if (pledge.status !== "COMPLETED" && !pledge.stripePaymentMethodId) {
      return NextResponse.json(
        { error: "Pledge is not complete or does not have a saved payment method" },
        { status: 400 }
      );
    }

    // Reset the confirmationEmailSent flag if force resend
    if (forceResend && pledge.confirmationEmailSent) {
      await db.pledge.update({
        where: { id: pledgeId },
        data: { confirmationEmailSent: false },
      });
    }

    // Send the confirmation email
    await notifyBackerPledgeConfirmed(pledgeId, pledge.chargedImmediately);

    return NextResponse.json({
      success: true,
      message: "Confirmation email sent successfully",
    });
  } catch (error) {
    console.error("Error sending confirmation email:", error);
    return NextResponse.json(
      { error: "Failed to send confirmation email" },
      { status: 500 }
    );
  }
}
