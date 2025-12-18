import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";

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

// POST - Send campaign now
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
      select: {
        id: true,
        name: true,
        subject: true,
        htmlContent: true,
        targetAudience: true,
        status: true,
        recipientCount: true,
        filters: true,
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Check status
    if (campaign.status === "SENT") {
      return NextResponse.json(
        { error: "Campaign has already been sent" },
        { status: 400 }
      );
    }

    if (campaign.status === "SENDING") {
      return NextResponse.json(
        { error: "Campaign is already being sent" },
        { status: 400 }
      );
    }

    // Update status to SENDING
    await db.emailCampaign.update({
      where: { id },
      data: { status: "SENDING" },
    });

    // Get recipients based on target audience
    let recipientEmails: string[] = [];
    const audience = campaign.targetAudience || "all";

    switch (audience) {
      case "subscriber":
        // Get newsletter subscribers (excluding retailers)
        const [subscribers, verifiedUsers] = await Promise.all([
          db.newsletterSubscriber.findMany({
            where: {
              isActive: true,
              NOT: { source: { contains: "retailer", mode: "insensitive" } },
            },
            select: { email: true },
          }),
          db.user.findMany({
            where: { emailVerified: { not: null } },
            select: { email: true },
          }),
        ]);
        const subEmails = new Set<string>(subscribers.map((s: { email: string }) => s.email.toLowerCase()));
        verifiedUsers.forEach(u => subEmails.add(u.email.toLowerCase()));
        recipientEmails = Array.from(subEmails);
        break;

      case "backer":
        const backerPledges = await db.pledge.findMany({
          where: { status: "COMPLETED" },
          select: { userId: true },
          distinct: ["userId"],
        });
        const backerUsers = await db.user.findMany({
          where: { id: { in: backerPledges.map(p => p.userId) } },
          select: { email: true },
        });
        recipientEmails = backerUsers.map(u => u.email.toLowerCase());
        break;

      case "creator":
        const creators = await db.user.findMany({
          where: { createdProjects: { some: {} } },
          select: { email: true },
        });
        recipientEmails = creators.map(c => c.email.toLowerCase());
        break;

      case "retailer":
        const retailers = await db.newsletterSubscriber.findMany({
          where: {
            isActive: true,
            source: { contains: "retailer", mode: "insensitive" },
          },
          select: { email: true },
        });
        recipientEmails = retailers.map((r: { email: string }) => r.email.toLowerCase());
        break;

      default:
        // All verified users
        const allUsers = await db.user.findMany({
          where: { emailVerified: { not: null } },
          select: { email: true },
        });
        recipientEmails = allUsers.map(u => u.email.toLowerCase());
    }

    // Remove duplicates
    recipientEmails = Array.from(new Set(recipientEmails));

    console.log(`Sending campaign "${campaign.name}" to ${recipientEmails.length} recipients`);

    let sentCount = 0;
    let failedCount = 0;

    // Send emails via SendGrid and log them
    for (const email of recipientEmails) {
      try {
        // Actually send the email via SendGrid
        const result = await sendEmail({
          to: email,
          subject: campaign.subject,
          html: campaign.htmlContent,
        });

        if (result.success) {
          // Log successful send
          await db.emailLog.create({
            data: {
              email,
              subject: campaign.subject,
              templateId: campaign.id,
              status: "sent",
              sentAt: new Date(),
              type: "WEEKLY_DISCOVERY",
            },
          });
          sentCount++;
        } else {
          // Log failed send
          await db.emailLog.create({
            data: {
              email,
              subject: campaign.subject,
              templateId: campaign.id,
              status: "failed",
              type: "WEEKLY_DISCOVERY",
            },
          });
          failedCount++;
          console.error(`Failed to send email to ${email}:`, result.error);
        }
      } catch (err) {
        failedCount++;
        console.error(`Error sending email to ${email}:`, err);
      }
    }

    console.log(`Campaign "${campaign.name}" complete: ${sentCount} sent, ${failedCount} failed`);

    // Update campaign as sent
    await db.emailCampaign.update({
      where: { id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        sentCount,
        recipientCount: recipientEmails.length,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Campaign "${campaign.name}" sent to ${sentCount} recipients`,
      sentCount,
      totalRecipients: recipientEmails.length,
    });
  } catch (error) {
    console.error("Error sending campaign:", error);

    // Try to reset status if failed
    try {
      const { id } = await params;
      await db.emailCampaign.update({
        where: { id },
        data: { status: "DRAFT" },
      });
    } catch {
      // Ignore
    }

    return NextResponse.json(
      { error: "Failed to send campaign" },
      { status: 500 }
    );
  }
}
