import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const creatorIndiekitOrdersNotifyBalanceLogger = logger.child({ module: "creator-indiekit-orders-notify-balance" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendBalanceDueEmail } from "@/lib/email/email-templates-pledge";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { pledgeId, projectId } = body;

    if (!pledgeId || !projectId) {
      return NextResponse.json({ error: "Missing pledgeId or projectId" }, { status: 400 });
    }

    // Verify the user owns or collaborates on this project
    const project = await db.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { creatorId: session.user.id },
          { collaborators: { some: { userId: session.user.id } } },
        ],
      },
      select: {
        id: true,
        title: true,
        slug: true,
        paymentProcessor: true,
        creator: { select: { vanityUrl: true } },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found or no access" }, { status: 404 });
    }

    // Get the pledge with user info
    const pledge = await db.pledge.findFirst({
      where: {
        id: pledgeId,
        projectId,
        status: "COMPLETED",
        deletedAt: null,
      },
      include: {
        user: { select: { email: true, name: true } },
        reward: { select: { title: true } },
        addons: {
          include: { addon: { select: { title: true, amount: true } } },
        },
      },
    });

    if (!pledge) {
      return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
    }

    // Calculate balance due - use stored value from metadata if available (set by order edits)
    const pledgeMeta = (pledge.metadata as Record<string, unknown>) || {};
    const storedBalanceDue = pledgeMeta.balanceDue != null ? Number(pledgeMeta.balanceDue) : null;
    const pledgeTotal = Number(pledge.amount);
    const expectedTotal = Number(pledge.rewardAmount) + Number(pledge.addonsAmount) + Number(pledge.shippingAmount);
    const balanceDue = storedBalanceDue !== null
      ? Math.max(0, Math.round(storedBalanceDue * 100) / 100)
      : Math.max(0, Math.round((expectedTotal - pledgeTotal) * 100) / 100);

    if (balanceDue <= 0) {
      return NextResponse.json({ error: "No balance due for this pledge" }, { status: 400 });
    }

    // Generate a secure payment token
    const paymentToken = crypto.randomBytes(32).toString("hex");
    const tokenExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Atomically check dedup and write new token to prevent duplicate sends under concurrent requests
    const updated = await db.$transaction(async (tx) => {
      const current = await tx.pledge.findUnique({
        where: { id: pledgeId },
        select: { metadata: true },
      });
      if (!current) return null;
      const currentMeta = (current.metadata as Record<string, unknown>) || {};
      const lastSentAt = currentMeta.balanceNotificationSentAt;
      if (lastSentAt) {
        const secondsSince = (Date.now() - new Date(lastSentAt as string).getTime()) / 1000;
        if (secondsSince < 60) {
          return { deduplicated: true, secondsSince: Math.round(secondsSince) };
        }
      }
      await tx.pledge.update({
        where: { id: pledgeId },
        data: {
          metadata: {
            ...currentMeta,
            balancePaymentToken: paymentToken,
            balancePaymentTokenExpiry: tokenExpiry.toISOString(),
            balanceNotificationSentAt: new Date().toISOString(),
            balanceDueAmount: balanceDue,
          },
        },
      });
      return { deduplicated: false };
    });

    if (!updated) {
      return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
    }
    if (updated.deduplicated) {
      return NextResponse.json({
        success: true,
        balanceDue,
        emailSent: true,
        deduplicated: true,
        message: `Notification already sent ${updated.secondsSince}s ago`,
      });
    }

    // Send the email
    const backerEmail = pledge.user.email;
    const backerName = pledge.user.name || "Backer";

    if (!backerEmail) {
      return NextResponse.json({ error: "Backer has no email address" }, { status: 400 });
    }

    // Map addons with null safety (addon could be null if deleted)
    const addonItems = pledge.addons
      .filter((a: { addon: { title: string; amount: unknown } | null; quantity: number }) => a.addon != null)
      .map((a: { addon: { title: string; amount: unknown }; quantity: number }) => ({
        title: a.addon.title,
        quantity: a.quantity,
        amount: Number(a.addon.amount),
      }));

    const emailResult = await sendBalanceDueEmail(
      backerEmail,
      backerName,
      project.title,
      project.slug,
      balanceDue,
      paymentToken,
      pledge.reward?.title || null,
      addonItems,
      project.creator.vanityUrl ? `/projects/${project.creator.vanityUrl}/${project.slug}` : undefined,
    );

    if (!emailResult?.success) {
      creatorIndiekitOrdersNotifyBalanceLogger.error({ err: String(emailResult?.error) }, "Balance notification email failed:");
      return NextResponse.json(
        { error: emailResult?.error || "Email delivery failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      balanceDue,
      emailSent: true,
    });
  } catch (error) {
    creatorIndiekitOrdersNotifyBalanceLogger.error({ err: String(error instanceof Error ? error.stack : error) }, "Error sending balance notification:");
    const message = error instanceof Error ? error.message : "Failed to send balance notification";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
