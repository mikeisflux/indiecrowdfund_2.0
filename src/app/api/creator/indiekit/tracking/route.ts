import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

const carriers: Record<string, { name: string; trackingUrl: string }> = {
  usps: { name: "USPS", trackingUrl: "https://tools.usps.com/go/TrackConfirmAction?tLabels=" },
  ups: { name: "UPS", trackingUrl: "https://www.ups.com/track?tracknum=" },
  fedex: { name: "FedEx", trackingUrl: "https://www.fedex.com/fedextrack/?trknbr=" },
  dhl: { name: "DHL", trackingUrl: "https://www.dhl.com/us-en/home/tracking.html?tracking-id=" },
  amazon: { name: "Amazon Logistics", trackingUrl: "" },
  ontrac: { name: "OnTrac", trackingUrl: "https://www.ontrac.com/tracking/?number=" },
  other: { name: "Other", trackingUrl: "" },
};

// POST - Add tracking info to an order
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { pledgeId, projectId, carrier, trackingNumber, notifyBacker, markAsShipped } = body;

    if (!pledgeId || !projectId) {
      return NextResponse.json({ error: "pledgeId and projectId are required" }, { status: 400 });
    }

    if (!carrier || !trackingNumber?.trim()) {
      return NextResponse.json({ error: "Carrier and tracking number are required" }, { status: 400 });
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
      },
      select: {
        id: true,
        fulfillmentStatus: true,
        metadata: true,
        user: { select: { name: true, email: true } },
      },
    });

    if (!pledge) {
      return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
    }

    const carrierInfo = carriers[carrier] || { name: carrier, trackingUrl: "" };
    const trackingUrl = carrierInfo.trackingUrl ? carrierInfo.trackingUrl + trackingNumber.trim() : null;

    // Store tracking info in metadata
    const currentMeta = (pledge.metadata as Record<string, unknown>) || {};
    const updatedMeta = {
      ...currentMeta,
      tracking: {
        carrier: carrierInfo.name,
        carrierId: carrier,
        trackingNumber: trackingNumber.trim(),
        trackingUrl,
        addedAt: new Date().toISOString(),
        addedBy: session.user.id,
      },
    };

    // Update pledge with tracking info and optionally mark as shipped
    await db.pledge.update({
      where: { id: pledgeId },
      data: {
        metadata: updatedMeta,
        ...(markAsShipped ? { fulfillmentStatus: "SHIPPED" } : {}),
      },
    });

    // Log the activity
    await db.fulfillmentActivity.create({
      data: {
        projectId,
        type: "ORDER_SHIPPED",
        title: "Tracking Added",
        description: `${carrierInfo.name} tracking ${trackingNumber.trim()} added for ${pledge.user.name || pledge.user.email}${markAsShipped ? ". Order marked as shipped." : ""}`,
        pledgeId,
        userId: session.user.id,
      },
    });

    // Send notification email if requested
    if (notifyBacker && pledge.user.email) {
      try {
        const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "IndieCrowdfund";
        const trackingLink = trackingUrl
          ? `<a href="${trackingUrl}" style="color: #0d9488; text-decoration: underline;">Track your package</a>`
          : `<strong>${trackingNumber.trim()}</strong>`;

        await sendEmail({
          to: pledge.user.email,
          subject: `Your order from "${project.title}" has shipped!`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #333;">Your order has shipped!</h2>
              <p>Hi ${pledge.user.name || "there"},</p>
              <p>Great news! Your order from <strong>${project.title}</strong> is on its way.</p>
              <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 16px 0;">
                <p style="margin: 0 0 8px 0;"><strong>Carrier:</strong> ${carrierInfo.name}</p>
                <p style="margin: 0 0 8px 0;"><strong>Tracking Number:</strong> ${trackingNumber.trim()}</p>
                <p style="margin: 0;">${trackingLink}</p>
              </div>
              <p>Thank you for your support!</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
              <p style="color: #999; font-size: 12px;">Sent via ${APP_NAME}</p>
            </div>
          `,
          text: `Your order from "${project.title}" has shipped!\n\nCarrier: ${carrierInfo.name}\nTracking Number: ${trackingNumber.trim()}${trackingUrl ? `\nTrack: ${trackingUrl}` : ""}`,
        });
      } catch (emailError) {
        console.error("Failed to send tracking notification email:", emailError);
        // Don't fail the whole operation just because email failed
      }
    }

    return NextResponse.json({
      success: true,
      tracking: {
        carrier: carrierInfo.name,
        trackingNumber: trackingNumber.trim(),
        trackingUrl,
      },
      markedAsShipped: !!markAsShipped,
    });
  } catch (error) {
    console.error("Add tracking error:", error);
    return NextResponse.json(
      { error: "Failed to add tracking information" },
      { status: 500 }
    );
  }
}
