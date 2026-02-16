import { sendEmail, queueEmail, EMAIL_PRIORITY } from "./email-config";
import { db } from "@/lib/db";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "IndieCrowdfund";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * Send survey available notification email to backer
 */
export async function sendSurveyAvailableEmail(
  email: string,
  backerName: string,
  projectTitle: string,
  creatorName: string,
  pledgeId: string
) {
  const surveyUrl = `${APP_URL}/dashboard/pledges/${pledgeId}/survey`;
  const dashboardUrl = `${APP_URL}/dashboard/backer`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Survey Available - Action Required</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
        </div>

        <div style="background: linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%); border-radius: 8px; padding: 30px; margin-bottom: 20px; color: white;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="display: inline-block; background: rgba(255,255,255,0.2); padding: 10px 20px; border-radius: 50px; font-size: 14px; font-weight: 600;">
              📋 SURVEY AVAILABLE
            </div>
          </div>

          <h2 style="margin-top: 0; color: white; text-align: center;">Action Required</h2>
          <p style="text-align: center;">Hi ${backerName || "there"},</p>
          <p style="text-align: center;"><strong>${creatorName}</strong> has sent you a survey for your pledge to <strong>"${projectTitle}"</strong>.</p>
        </div>

        <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h3 style="margin-top: 0;">Why do I need to fill this out?</h3>
          <p style="color: #666; margin: 0;">The creator needs additional information from you to fulfill your reward. This may include:</p>
          <ul style="color: #666; margin: 10px 0 0 0; padding-left: 20px;">
            <li>Shipping address confirmation</li>
            <li>Size or color preferences</li>
            <li>Custom reward options</li>
            <li>Other fulfillment details</li>
          </ul>
        </div>

        <div style="background: #fffbeb; border-radius: 8px; padding: 15px; margin-bottom: 20px; border: 1px solid #fef3c7;">
          <p style="margin: 0; font-size: 14px; color: #92400e;"><strong>⏰ Please complete this survey soon!</strong> The creator may need this information to begin fulfillment.</p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${surveyUrl}" style="display: inline-block; background: #0ea5e9; color: #fff; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
            Complete Survey Now
          </a>
        </div>

        <div style="text-align: center; margin-bottom: 20px;">
          <a href="${dashboardUrl}" style="color: #666; font-size: 14px; text-decoration: underline;">View all your pledges</a>
        </div>

        <div style="text-align: center; color: #999; font-size: 12px; margin-top: 30px;">
          <p>You received this email because you backed "${projectTitle}" on ${APP_NAME}.</p>
          <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  return queueEmail({
    to: email,
    subject: `📋 Survey available for "${projectTitle}" - Action Required`,
    html,
    priority: EMAIL_PRIORITY.CREATOR,
  });
}

/**
 * Send retailer approval email with access code
 */
export async function sendRetailerApprovalEmail(
  email: string,
  businessName: string,
  contactName: string,
  accessCode: string
) {
  const loginUrl = `${APP_URL}/retailers/login`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Retailer Application Has Been Approved!</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
          <p style="color: #10b981; font-weight: 500; margin-top: 5px;">Retailer Portal</p>
        </div>

        <div style="background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%); border-radius: 8px; padding: 30px; margin-bottom: 20px; color: white;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="display: inline-block; background: rgba(255,255,255,0.2); padding: 10px 20px; border-radius: 50px; font-size: 14px; font-weight: 600;">
              ✓ APPROVED
            </div>
          </div>
          <h2 style="margin-top: 0; color: white; text-align: center;">Congratulations, ${contactName || businessName}!</h2>
          <p style="text-align: center;">Your retailer application for <strong>${businessName}</strong> has been approved!</p>
        </div>

        <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h3 style="margin-top: 0; color: #333;">Your Retailer Access Code</h3>
          <p style="color: #666; margin-bottom: 15px;">Use this access code to sign in to the retailer portal:</p>

          <div style="background: #fff; border: 2px dashed #10b981; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
            <span style="font-family: monospace; font-size: 24px; font-weight: bold; letter-spacing: 2px; color: #10b981;">${accessCode}</span>
          </div>

          <p style="color: #666; font-size: 14px; margin-bottom: 0;">
            <strong>Important:</strong> Keep this code safe. You can also set up a password after logging in for easier access.
          </p>
        </div>

        <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h3 style="margin-top: 0; color: #333;">What You Can Do Now</h3>
          <ul style="color: #666; margin: 0; padding-left: 20px;">
            <li style="margin-bottom: 10px;">Access exclusive wholesale pricing on all projects</li>
            <li style="margin-bottom: 10px;">Place bulk orders for your retail locations</li>
            <li style="margin-bottom: 10px;">Track your orders and invoices</li>
            <li style="margin-bottom: 10px;">Get priority support from our retailer team</li>
          </ul>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%); color: #fff; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
            Sign In to Retailer Portal
          </a>
        </div>

        <div style="text-align: center; color: #999; font-size: 12px; margin-top: 30px;">
          <p>You received this email because your retailer application was approved on ${APP_NAME}.</p>
          <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  // This is a transactional email - always send
  return sendEmail({
    to: email,
    subject: `Your ${APP_NAME} retailer application has been approved!`,
    html,
    skipUnsubscribeCheck: true,
  });
}

/**
 * Send retailer rejection email
 */
export async function sendRetailerRejectionEmail(
  email: string,
  businessName: string,
  contactName: string,
  reason?: string
) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Update on Your Retailer Application</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
          <p style="color: #10b981; font-weight: 500; margin-top: 5px;">Retailer Portal</p>
        </div>

        <div style="background: #fef2f2; border-radius: 8px; padding: 30px; margin-bottom: 20px; border: 1px solid #fecaca;">
          <h2 style="margin-top: 0; color: #dc2626;">Application Not Approved</h2>
          <p>Hi ${contactName || businessName},</p>
          <p>Thank you for your interest in becoming a certified retailer with ${APP_NAME}. After reviewing your application for <strong>${businessName}</strong>, we were unable to approve it at this time.</p>

          ${reason ? `
          <div style="background: white; border-radius: 6px; padding: 15px; margin: 20px 0; border-left: 4px solid #dc2626;">
            <p style="margin: 0; color: #666; font-size: 14px;"><strong>Feedback:</strong></p>
            <p style="margin: 10px 0 0 0;">${reason}</p>
          </div>
          ` : ""}

          <p>If you believe this decision was made in error or if you have additional information that might support your application, please don't hesitate to contact our retailer support team.</p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="mailto:retailers@indiecrowdfund.com" style="display: inline-block; background: #333; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500;">
            Contact Retailer Support
          </a>
        </div>

        <div style="text-align: center; color: #999; font-size: 12px; margin-top: 30px;">
          <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `Update on your ${APP_NAME} retailer application`,
    html,
    skipUnsubscribeCheck: true,
  });
}

/**
 * Add a user to a creator's email list.
 * Used when:
 * - A backer pledges to a project (source: "pledge")
 * - A user follows a project for updates (source: "follow")
 * - A user signs up for prelaunch notifications (source: "prelaunch")
 *
 * @param options - Options for adding to email list
 * @returns The created or existing email list subscriber record
 */
export async function addToCreatorEmailList(options: {
  creatorId: string;
  email: string;
  name?: string | null;
  source: "pledge" | "follow" | "prelaunch" | "import" | "manual";
  sourceProjectId?: string;
}): Promise<{ success: boolean; isNew: boolean; subscriberId?: string }> {
  const { creatorId, email, name, source, sourceProjectId } = options;

  if (!email || !email.includes("@")) {
    console.log(`[addToCreatorEmailList] Invalid email: ${email}`);
    return { success: false, isNew: false };
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    // Check if already exists in creator's email list
    const existing = await db.emailListSubscriber.findUnique({
      where: {
        creatorId_email: {
          creatorId,
          email: normalizedEmail,
        },
      },
    });

    if (existing) {
      console.log(`[addToCreatorEmailList] Email ${normalizedEmail} already in list for creator ${creatorId}`);
      return { success: true, isNew: false, subscriberId: existing.id };
    }

    // Add to creator's email list
    const subscriber = await db.emailListSubscriber.create({
      data: {
        creatorId,
        email: normalizedEmail,
        name: name || null,
        source,
        sourceProjectId: sourceProjectId || null,
        status: "subscribed",
      },
    });

    console.log(`[addToCreatorEmailList] Added ${normalizedEmail} to list for creator ${creatorId} (source: ${source})`);
    return { success: true, isNew: true, subscriberId: subscriber.id };
  } catch (error) {
    // Handle race condition where another request added the same email
    if ((error as { code?: string })?.code === "P2002") {
      console.log(`[addToCreatorEmailList] Race condition: ${normalizedEmail} already exists`);
      return { success: true, isNew: false };
    }

    console.error(`[addToCreatorEmailList] Error adding ${normalizedEmail}:`, error);
    return { success: false, isNew: false };
  }
}
