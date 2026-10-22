import { sendEmail, queueEmail, EMAIL_PRIORITY } from "./email-config";
import { db } from "@/lib/db";

import { logger } from "@/lib/logger";

const emailEmailTemplatesMiscLogger = logger.child({ module: "email-email-templates-misc" });


const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "IndieCrowdfund";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * Send bug report resolution email to the reporter
 */
export async function sendBugReportResolutionEmail(
  email: string,
  reporterName: string,
  bugTitle: string,
  resolution: string,
  status: string
) {
  const statusLabel = status === "RESOLVED" ? "Resolved" : status === "CLOSED" ? "Closed" : status;
  const statusColor = status === "RESOLVED" ? "#22c55e" : "#6366f1";

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bug Report Update - ${APP_NAME}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
        </div>

        <div style="background: #f0fdf4; border-radius: 8px; padding: 30px; margin-bottom: 20px; border: 1px solid #bbf7d0;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="display: inline-block; background: ${statusColor}; color: white; padding: 10px 20px; border-radius: 50px; font-size: 14px; font-weight: 600;">
              ${statusLabel.toUpperCase()}
            </div>
          </div>

          <h2 style="margin-top: 0; color: #15803d; text-align: center;">Your Bug Report Has Been Addressed</h2>

          <p>Hi ${escapeHtml(reporterName || "there")},</p>

          <p>Thank you so much for taking the time to report this issue. Your dedication to improving ${APP_NAME} makes a real difference, and we truly appreciate community members like you who help us build a better platform for everyone. Contributors like you are the backbone of what makes this community so special.</p>

          <p>We wanted to let you know that your bug report <strong>&ldquo;${escapeHtml(bugTitle)}&rdquo;</strong> has been reviewed and addressed by our team. Below you'll find the details of the resolution:</p>

          <div style="background: white; border-radius: 6px; padding: 20px; margin: 20px 0; border-left: 4px solid ${statusColor};">
            <p style="margin: 0 0 8px 0; color: #666; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Resolution</p>
            <p style="margin: 0; color: #333; font-size: 15px; line-height: 1.7;">${escapeHtml(resolution)}</p>
          </div>

          <p>If you notice that the issue persists or if you encounter anything else, please don't hesitate to submit another report. Every piece of feedback helps us improve.</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${APP_URL}" style="display: inline-block; background: ${statusColor}; color: #fff; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
              Visit ${APP_NAME}
            </a>
          </div>

          <p style="color: #666; font-size: 14px; text-align: center;">
            Thank you for being a valued member of the ${APP_NAME} community!
          </p>
        </div>

        <div style="text-align: center; color: #999; font-size: 12px;">
          <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `Your bug report "${bugTitle}" has been ${statusLabel.toLowerCase()}`,
    html,
    skipUnsubscribeCheck: true,
  });
}

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
          <p style="text-align: center;">Hi ${escapeHtml(backerName || "there")},</p>
          <p style="text-align: center;"><strong>${escapeHtml(creatorName)}</strong> has sent you a survey for your pledge to <strong>&ldquo;${escapeHtml(projectTitle)}&rdquo;</strong>.</p>
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
 * Send an "confirm & lock your order" request email to a backer. Locking
 * confirms their address + selections so the creator can print & ship.
 */
export async function sendOrderLockRequestEmail(
  email: string,
  backerName: string,
  projectTitle: string,
  creatorName: string,
  pledgeId: string
) {
  const lockUrl = `${APP_URL}/dashboard/pledges/${pledgeId}/lock-order`;
  const dashboardUrl = `${APP_URL}/dashboard/backer`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Confirm & lock your order</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
        </div>

        <div style="background: linear-gradient(135deg, #16a34a 0%, #0d9488 100%); border-radius: 8px; padding: 30px; margin-bottom: 20px; color: white;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="display: inline-block; background: rgba(255,255,255,0.2); padding: 10px 20px; border-radius: 50px; font-size: 14px; font-weight: 600;">
              📦 READY TO PRINT & SHIP
            </div>
          </div>
          <h2 style="margin-top: 0; color: white; text-align: center;">Confirm &amp; lock your order</h2>
          <p style="text-align: center;">Hi ${escapeHtml(backerName || "there")},</p>
          <p style="text-align: center;"><strong>${escapeHtml(creatorName)}</strong> is ready to produce and ship <strong>&ldquo;${escapeHtml(projectTitle)}&rdquo;</strong>. Review your order, confirm your shipping address, and lock it in.</p>
        </div>

        <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h3 style="margin-top: 0;">What happens when I lock?</h3>
          <ul style="color: #666; margin: 10px 0 0 0; padding-left: 20px;">
            <li>Your reward, add-ons, and shipping address are confirmed</li>
            <li>Your order is finalized so it can be printed &amp; shipped</li>
            <li>You won't be able to change it afterward, so double-check first</li>
          </ul>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${lockUrl}" style="display: inline-block; background: #16a34a; color: #fff; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
            Review &amp; lock my order
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
    subject: `📦 Confirm & lock your order for "${projectTitle}"`,
    html,
    priority: EMAIL_PRIORITY.CREATOR,
  });
}

/**
 * Send survey update request email to backer
 */
export async function sendSurveyUpdateRequestEmail(
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
        <title>Survey Updated - Please Review</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
        </div>

        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 8px; padding: 30px; margin-bottom: 20px; color: white;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="display: inline-block; background: rgba(255,255,255,0.2); padding: 10px 20px; border-radius: 50px; font-size: 14px; font-weight: 600;">
              SURVEY UPDATED
            </div>
          </div>

          <h2 style="margin-top: 0; color: white; text-align: center;">Please Review Your Survey</h2>
          <p style="text-align: center;">Hi ${escapeHtml(backerName || "there")},</p>
          <p style="text-align: center;"><strong>${escapeHtml(creatorName)}</strong> has updated the survey for <strong>&ldquo;${escapeHtml(projectTitle)}&rdquo;</strong> and is requesting that you review and update your responses.</p>
        </div>

        <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h3 style="margin-top: 0;">What changed?</h3>
          <p style="color: #666; margin: 0;">The creator has made changes to the survey questions. Your previous responses have been kept, but please review the updated questions and make sure your answers are still correct. You may need to answer new or modified questions.</p>
        </div>

        <div style="background: #fffbeb; border-radius: 8px; padding: 15px; margin-bottom: 20px; border: 1px solid #fef3c7;">
          <p style="margin: 0; font-size: 14px; color: #92400e;"><strong>Action Required:</strong> Please review and resubmit your survey responses as soon as possible so the creator can proceed with fulfillment.</p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${surveyUrl}" style="display: inline-block; background: #f59e0b; color: #fff; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
            Review Survey Now
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
    subject: `Survey updated for "${projectTitle}" - Please review your responses`,
    html,
    priority: EMAIL_PRIORITY.CREATOR,
  });
}

/**
 * Send retailer approval email with access code and password setup link
 */
export async function sendRetailerApprovalEmail(
  email: string,
  businessName: string,
  contactName: string,
  accessCode: string,
  passwordSetupToken?: string | null
) {
  const loginUrl = `${APP_URL}/retailers/login`;
  const passwordSetupUrl = passwordSetupToken
    ? `${APP_URL}/retailers/reset-password?token=${passwordSetupToken}`
    : null;

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
          <h2 style="margin-top: 0; color: white; text-align: center;">Congratulations, ${escapeHtml(contactName || businessName)}!</h2>
          <p style="text-align: center;">Your retailer application for <strong>${escapeHtml(businessName)}</strong> has been approved! An account has been created for you.</p>
        </div>

        ${passwordSetupUrl ? `
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h3 style="margin-top: 0; color: #1e40af;">Set Up Your Password</h3>
          <p style="color: #1e3a5f; margin-bottom: 15px;">Your account has been created. Please set your password to get started:</p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="${passwordSetupUrl}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%); color: #fff; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
              Set Your Password
            </a>
          </div>
          <p style="color: #1e3a5f; font-size: 13px; margin-bottom: 0;">
            This link expires in 72 hours. If it expires, you can request a new one from the login page.
          </p>
        </div>
        ` : ""}

        <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h3 style="margin-top: 0; color: #333;">Your Retailer Access Code</h3>
          <p style="color: #666; margin-bottom: 15px;">You can also use this access code to sign in to the retailer portal:</p>

          <div style="background: #fff; border: 2px dashed #10b981; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
            <span style="font-family: monospace; font-size: 24px; font-weight: bold; letter-spacing: 2px; color: #10b981;">${accessCode}</span>
          </div>

          <p style="color: #666; font-size: 14px; margin-bottom: 0;">
            <strong>Important:</strong> Keep this code safe as a backup login method.
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
          <p>Hi ${escapeHtml(contactName || businessName)},</p>
          <p>Thank you for your interest in becoming a certified retailer with ${APP_NAME}. After reviewing your application for <strong>${escapeHtml(businessName)}</strong>, we were unable to approve it at this time.</p>

          ${reason ? `
          <div style="background: white; border-radius: 6px; padding: 15px; margin: 20px 0; border-left: 4px solid #dc2626;">
            <p style="margin: 0; color: #666; font-size: 14px;"><strong>Feedback:</strong></p>
            <p style="margin: 10px 0 0 0;">${escapeHtml(reason)}</p>
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
    emailEmailTemplatesMiscLogger.info(`[addToCreatorEmailList] Invalid email: ${email}`);
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
      emailEmailTemplatesMiscLogger.info(`[addToCreatorEmailList] Email ${normalizedEmail} already in list for creator ${creatorId}`);
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

    emailEmailTemplatesMiscLogger.info(`[addToCreatorEmailList] Added ${normalizedEmail} to list for creator ${creatorId} (source: ${source})`);
    return { success: true, isNew: true, subscriberId: subscriber.id };
  } catch (error) {
    // Handle race condition where another request added the same email
    if ((error as { code?: string })?.code === "P2002") {
      emailEmailTemplatesMiscLogger.info(`[addToCreatorEmailList] Race condition: ${normalizedEmail} already exists`);
      return { success: true, isNew: false };
    }

    emailEmailTemplatesMiscLogger.error({ err: error }, `[addToCreatorEmailList] Error adding ${normalizedEmail}:`);
    return { success: false, isNew: false };
  }
}

/**
 * Send digital delivery notification to a backer when their digital files are ready.
 */
export async function sendDigitalDeliveryEmail(
  email: string,
  backerName: string | null,
  projectTitle: string,
  fileCount: number,
  fileNames: string[]
): Promise<{ success: boolean }> {
  try {
    const displayName = backerName || "there";
    const filesListHtml = fileNames
      .slice(0, 10)
      .map((n) => `<li style="margin: 4px 0; color: #334155;">${escapeHtml(n)}</li>`)
      .join("");
    const moreCount = fileNames.length > 10 ? fileNames.length - 10 : 0;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Your digital rewards are ready — ${APP_NAME}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
          </div>

          <div style="background: #f0fdf4; border-radius: 8px; padding: 30px; margin-bottom: 20px; border: 1px solid #bbf7d0;">
            <div style="text-align: center; margin-bottom: 20px;">
              <div style="display: inline-block; background: #22c55e; color: white; padding: 10px 20px; border-radius: 50px; font-size: 14px; font-weight: 600;">
                DIGITAL REWARDS DELIVERED
              </div>
            </div>

            <h2 style="margin-top: 0; color: #15803d; text-align: center;">Your Files Are Ready! 🎉</h2>

            <p>Hi ${escapeHtml(displayName)},</p>

            <p>Great news! Your digital rewards for <strong>${escapeHtml(projectTitle)}</strong> have been delivered and are now available in your Digital Library.</p>

            <div style="background: white; border-radius: 6px; padding: 20px; margin: 20px 0; border-left: 4px solid #22c55e;">
              <p style="margin: 0 0 12px 0; color: #666; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">${fileCount} ${fileCount === 1 ? "File" : "Files"} Delivered</p>
              <ul style="margin: 0; padding-left: 20px; color: #334155;">
                ${filesListHtml}
                ${moreCount > 0 ? `<li style="margin: 4px 0; color: #64748b; font-style: italic;">...and ${moreCount} more</li>` : ""}
              </ul>
            </div>

            <p>Head to your Digital Library to download your files, read comics in the built-in page-flip reader, or stream music and movies right in your browser.</p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${APP_URL}/dashboard/backer?tab=downloads" style="display: inline-block; background: #22c55e; color: #fff; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                Access Your Downloads
              </a>
            </div>

            <p style="color: #666; font-size: 14px; text-align: center;">
              Thanks for backing this project and being part of the ${APP_NAME} community!
            </p>
          </div>

          <div style="text-align: center; color: #999; font-size: 12px;">
            <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;

    await queueEmail({
      to: email,
      subject: `Your digital rewards for "${projectTitle}" are ready!`,
      html,
      priority: EMAIL_PRIORITY.CREATOR,
    });

    return { success: true };
  } catch (error) {
    emailEmailTemplatesMiscLogger.error(
      { err: String(error), email },
      "[sendDigitalDeliveryEmail] Failed to queue email"
    );
    return { success: false };
  }
}

/**
 * Creator: a dispute on their campaign was recouped from their chargeback
 * protection card. This is their receipt for the charge.
 */
/**
 * A campaign has been closed and every backer refunded. Two causes: it
 * ended below the minimum funding level (Terms §6), or an admin closed it.
 * The tone is deliberate — this is bad news for someone who put months
 * into a book, and they should feel welcome to try again.
 */
export async function sendCampaignWoundDownEmail(params: {
  email: string;
  creatorName: string;
  projectTitle: string;
  goalAmount: number;
  raisedAmount: number;
  cause: "under-minimum" | "not-funded" | "admin";
  note: string | null;
  refundedCount: number;
}) {
  const { email, creatorName, projectTitle, goalAmount, raisedAmount, cause, note, refundedCount } = params;
  const pct = goalAmount > 0 ? Math.round((raisedAmount / goalAmount) * 100) : 0;
  const money = (n: number) => `$${n.toFixed(2)}`;
  const why =
    cause === "under-minimum"
      ? `<p>When a campaign closes, we look at what it raised against its goal. <strong>${escapeHtml(projectTitle)}</strong> finished at ${money(raisedAmount)} of its ${money(goalAmount)} goal (${pct}%). Under our Terms of Service, a campaign that ends below 60% of its goal is treated as not funded: at that level, the fixed costs of processing payments, issuing a payout and supporting fulfilment would cost more than the campaign brought in, which would leave you out of pocket as well as us.</p>`
      : cause === "not-funded"
        ? `<p><strong>${escapeHtml(projectTitle)}</strong> closed at ${money(raisedAmount)} of its ${money(goalAmount)} goal. As an All-or-Nothing campaign, it was not funded.</p>`
        : `<p>We have closed <strong>${escapeHtml(projectTitle)}</strong>. It raised ${money(raisedAmount)} against a ${money(goalAmount)} goal, and at that level the costs of processing the payments, issuing a payout and supporting fulfilment would have exceeded what the campaign made. Rather than let that happen, we have ended it and returned every backer's money.</p>${note ? `<p><em>${escapeHtml(note)}</em></p>` : ""}`;
  const html = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;"><h1 style="color: #333; margin: 0;">${APP_NAME}</h1></div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; margin-bottom: 20px;">
          <h2 style="margin-top: 0; color: #1e293b;">About ${escapeHtml(projectTitle)}</h2>
          <p>Hi ${escapeHtml(creatorName)},</p>
          <p>Thank you for launching with us. We know how much work goes into a campaign, and we wanted to write to you directly about what happens next.</p>
          ${why}
          <p><strong>What we have done:</strong> every backer (${refundedCount}) has been refunded in full or had their uncharged pledge released, and each has been emailed to say so. You owe nothing, and no fees have been taken.</p>
          <p><strong>What this is not:</strong> a judgement on the book. Plenty of great projects need a second run with a longer lead-up, a smaller first goal, or a different launch window. Your campaign page, rewards and backer list are still in your dashboard, so relaunching is a copy rather than a rebuild.</p>
          <p>If you would like a hand planning a relaunch, or if anything about this seems wrong, reply to this email and a person will answer.</p>
          <p>With thanks,<br>The ${APP_NAME} team</p>
        </div>
        <div style="text-align: center; color: #999; font-size: 12px; margin-top: 30px;"><p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p></div>
      </body>
    </html>
  `;
  return queueEmail({
    to: email,
    subject: `About your campaign "${projectTitle}"`,
    html,
    text: `Hi ${creatorName},\n\nThank you for launching with us. "${projectTitle}" finished at ${money(raisedAmount)} of its ${money(goalAmount)} goal (${pct}%). ${
      cause === "under-minimum"
        ? "Under our Terms of Service, a campaign that ends below 60% of its goal is treated as not funded, because at that level the fixed costs of processing, payout and fulfilment support would exceed what it raised."
        : cause === "not-funded"
          ? "As an All-or-Nothing campaign, it was not funded."
          : "At that level the costs of processing, payout and fulfilment support would have exceeded what the campaign made, so we have closed it."
    } Every backer (${refundedCount}) has been refunded or released and emailed. You owe nothing and no fees were taken.${note ? ` ${note}` : ""}\n\nThis is not a judgement on the book — many great projects need a second run. Your page, rewards and backer list are still in your dashboard. Reply to this email if you'd like help planning a relaunch.\n\nWith thanks, The ${APP_NAME} team`,
    skipUnsubscribeCheck: true,
    priority: EMAIL_PRIORITY.SYSTEM,
  });
}

export async function sendChargebackRecoupRefundedEmail(params: {
  email: string;
  creatorName: string;
  projectTitle: string;
  amount: number;
  reason: string;
  kind: "CHARGEBACK" | "OVERPAYMENT";
}) {
  const { email, creatorName, projectTitle, amount, reason, kind } = params;
  const what =
    kind === "OVERPAYMENT"
      ? `the $${amount.toFixed(2)} collected from your protection card for "${projectTitle}"`
      : `the $${amount.toFixed(2)} charged to your protection card for a dispute on "${projectTitle}"`;
  const html = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;"><h1 style="color: #333; margin: 0;">${APP_NAME}</h1></div>
        <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 24px; margin-bottom: 20px;">
          <h2 style="margin-top: 0; color: #065f46;">$${amount.toFixed(2)} refunded to your card</h2>
          <p>Hi ${escapeHtml(creatorName)},</p>
          <p>We have refunded ${escapeHtml(what)}.</p>
          <p><strong>Why:</strong> ${escapeHtml(reason)}</p>
          <p style="color: #666; font-size: 14px;">Refunds usually appear on your statement within 5–10 business days. Questions? Reply to this email.</p>
        </div>
        <div style="text-align: center; color: #999; font-size: 12px; margin-top: 30px;"><p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p></div>
      </body>
    </html>
  `;
  return queueEmail({
    to: email,
    subject: `Refunded: $${amount.toFixed(2)} returned to your card for "${projectTitle}"`,
    html,
    text: `Hi ${creatorName} — we have refunded ${what}. Why: ${reason}. Refunds usually appear within 5–10 business days.`,
    skipUnsubscribeCheck: true,
    priority: EMAIL_PRIORITY.SYSTEM,
  });
}

export async function sendChargebackRecoupChargedEmail(params: {
  email: string;
  creatorName: string;
  projectTitle: string;
  backerLabel: string;
  disputedAmount: number;
  feeAmount: number;
  total: number;
  reason: string | null;
  /** CHARGEBACK = one backer's dispute; OVERPAYMENT = paid out more than the campaign ended up earning. */
  kind?: "CHARGEBACK" | "OVERPAYMENT";
}) {
  const { email, creatorName, projectTitle, backerLabel, disputedAmount, feeAmount, total, reason } = params;
  const overpayment = params.kind === "OVERPAYMENT";
  const heading = overpayment
    ? "Overpaid payout collected from your protection card"
    : "Chargeback recouped from your protection card";
  const explanation = overpayment
    ? `<p>Your campaign <strong>${escapeHtml(projectTitle)}</strong> was paid out, and refunds or reversed pledges issued afterwards brought the amount it actually earned below what had already been sent to you. Under the chargeback protection terms you agreed to at launch, the difference was charged to your card on file.</p>`
    : `<p>A backer's bank reversed a pledge on <strong>${escapeHtml(projectTitle)}</strong> (${escapeHtml(backerLabel)}${reason ? `, reason: ${escapeHtml(reason)}` : ""}). Under the chargeback protection terms you agreed to at launch, the amount was charged to your card on file.</p>`;
  const lineLabel = overpayment ? "Paid out beyond earnings" : "Disputed pledge";
  const html = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;"><h1 style="color: #333; margin: 0;">${APP_NAME}</h1></div>
        <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 24px; margin-bottom: 20px;">
          <h2 style="margin-top: 0; color: #9a3412;">${heading}</h2>
          <p>Hi ${escapeHtml(creatorName)},</p>
          ${explanation}
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr><td style="padding: 6px 0; color: #666;">${lineLabel}</td><td style="padding: 6px 0; text-align: right;">$${disputedAmount.toFixed(2)}</td></tr>
          ${overpayment ? "" : `<tr><td style="padding: 6px 0; color: #666;">Dispute fee</td><td style="padding: 6px 0; text-align: right;">$${feeAmount.toFixed(2)}</td></tr>`}
          <tr><td style="padding: 8px 0; font-weight: 600; border-top: 1px solid #eee;">Charged to your card</td><td style="padding: 8px 0; text-align: right; font-weight: 600; border-top: 1px solid #eee;">$${total.toFixed(2)}</td></tr>
        </table>
        <p style="color: #666; font-size: 14px;">It will appear on your statement as <strong>ICF CHARGEBACK</strong>. ${overpayment ? "The full breakdown is on your campaign's payout page. Questions? Reply to this email." : "If the dispute is later won, the amount is returned to you. Questions? Reply to this email."}</p>
        <div style="text-align: center; color: #999; font-size: 12px; margin-top: 30px;"><p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p></div>
      </body>
    </html>
  `;
  return queueEmail({
    to: email,
    subject: overpayment
      ? `Overpaid payout collected: $${total.toFixed(2)} charged for "${projectTitle}"`
      : `Chargeback recouped: $${total.toFixed(2)} charged for "${projectTitle}"`,
    html,
    text: overpayment
      ? `Hi ${creatorName} — "${projectTitle}" was paid out, and later refunds or reversed pledges brought its earnings below what was already sent to you. $${total.toFixed(2)} was charged to your chargeback protection card. It will appear as ICF CHARGEBACK.`
      : `Hi ${creatorName} — a backer's bank reversed a pledge on "${projectTitle}" (${backerLabel}). $${total.toFixed(2)} ($${disputedAmount.toFixed(2)} disputed + $${feeAmount.toFixed(2)} dispute fee) was charged to your chargeback protection card. It will appear as ICF CHARGEBACK.`,
    skipUnsubscribeCheck: true, // Transactional: receipt for a charge
    priority: EMAIL_PRIORITY.SYSTEM,
  });
}

/**
 * Creator: the recoup charge failed (declined, expired, or no vaulted card).
 * Asks them to update the card; when retries are exhausted, tells them the
 * amount will come out of their payout instead.
 */
export async function sendChargebackRecoupFailedEmail(params: {
  email: string;
  creatorName: string;
  projectTitle: string;
  backerLabel: string;
  total: number;
  reason: string;
  heldBack: boolean;
  kind?: "CHARGEBACK" | "OVERPAYMENT";
}) {
  const { email, creatorName, projectTitle, backerLabel, total, reason, heldBack } = params;
  const overpayment = params.kind === "OVERPAYMENT";
  const cause = overpayment
    ? `Your campaign <strong>${escapeHtml(projectTitle)}</strong> was paid out, and later refunds or reversed pledges left <strong>$${total.toFixed(2)}</strong> owed back.`
    : `A backer's bank reversed a pledge on <strong>${escapeHtml(projectTitle)}</strong> (${escapeHtml(backerLabel)}).`;
  const dashboardUrl = `${APP_URL}/dashboard`;
  const html = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;"><h1 style="color: #333; margin: 0;">${APP_NAME}</h1></div>
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 24px; margin-bottom: 20px;">
          <h2 style="margin-top: 0; color: #991b1b;">${heldBack ? "Chargeback amount will be withheld from your payout" : "Action needed: update your chargeback protection card"}</h2>
          <p>Hi ${escapeHtml(creatorName)},</p>
          <p>${cause} We tried to charge <strong>$${total.toFixed(2)}</strong> to your chargeback protection card and it did not go through: <em>${escapeHtml(reason)}</em>.</p>
          ${heldBack
            ? `<p>We have stopped retrying. The amount will be deducted from your next payout for this campaign.</p>`
            : `<p>Please open your campaign's Payment step and re-enter or replace your card. The outstanding amount is collected automatically as soon as a verified card is on file; otherwise it is deducted from your payout.</p>`}
        </div>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${dashboardUrl}" style="display: inline-block; background: #dc2626; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500;">Open my dashboard</a>
        </div>
        <div style="text-align: center; color: #999; font-size: 12px; margin-top: 30px;"><p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p></div>
      </body>
    </html>
  `;
  return queueEmail({
    to: email,
    subject: heldBack
      ? `Chargeback of $${total.toFixed(2)} will be withheld from your "${projectTitle}" payout`
      : `Action needed: chargeback recoup of $${total.toFixed(2)} failed for "${projectTitle}"`,
    html,
    text: `Hi ${creatorName} — we tried to charge $${total.toFixed(2)} to your chargeback protection card ${overpayment ? `for the overpaid payout on "${projectTitle}"` : `for a dispute on "${projectTitle}" (${backerLabel})`} and it failed: ${reason}. ${heldBack ? "The amount will be deducted from your next payout." : `Please update your card at ${dashboardUrl}.`}`,
    skipUnsubscribeCheck: true, // Transactional: money owed
    priority: EMAIL_PRIORITY.SYSTEM,
  });
}

/**
 * Backer: their bank dispute has banned the account and frozen the reward.
 * Sent the moment a chargeback lands (applyChargeback) and resendable from
 * the admin notify route for disputes that predate it.
 */
export async function sendChargebackBackerNoticeEmail(params: {
  email: string;
  backerName: string;
  projectTitle: string;
  rewardTitle: string | null;
  amount: number;
  disputeId: string | null;
  alreadyShipped: boolean;
}) {
  const { email, backerName, projectTitle, rewardTitle, amount, disputeId, alreadyShipped } = params;
  const policyUrl = `${APP_URL}/terms?tab=chargebacks`;
  const html = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;"><h1 style="color: #333; margin: 0;">${APP_NAME}</h1></div>
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 24px; margin-bottom: 20px;">
          <h2 style="margin-top: 0; color: #991b1b;">Your account has been suspended due to a payment dispute</h2>
          <p>Hi ${escapeHtml(backerName || "there")},</p>
          <p>Your bank or card issuer has opened a dispute (chargeback) against your pledge of <strong>$${amount.toFixed(2)}</strong> to <strong>${escapeHtml(projectTitle)}</strong>${rewardTitle ? ` for the reward &ldquo;${escapeHtml(rewardTitle)}&rdquo;` : ""}${disputeId ? ` (dispute reference ${escapeHtml(disputeId)})` : ""}.</p>
          <p>Under our <a href="${policyUrl}" style="color: #991b1b;">Chargeback Handling Policy</a>, which you agreed to when you pledged, filing a dispute results in an immediate suspension of your ${APP_NAME} account. As a result:</p>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li>Your account is suspended and you can no longer sign in.</li>
            <li>${alreadyShipped
              ? "Your reward had already shipped. The creator will not send any further items, and the disputed amount is being recovered from them."
              : "Your reward for this pledge is on hold and <strong>will not be produced or shipped</strong> while the dispute is open."}</li>
            <li>Any other pledges on this account are also on hold.</li>
          </ul>
          <p><strong>If this dispute was a mistake</strong> &mdash; for example you did not recognise the charge on your statement &mdash; contact your bank and withdraw the dispute. Once the dispute is dismissed or resolved in the creator's favour, reply to this email and we will review reinstating your account and your reward.</p>
          <p>If you believe you never made this pledge, no action is needed; the dispute will run its course and the account will stay closed.</p>
        </div>
        <div style="text-align: center; color: #999; font-size: 12px; margin-top: 30px;">
          <p>Questions? Reply to this email.</p>
          <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;
  return queueEmail({
    to: email,
    subject: `Your ${APP_NAME} account has been suspended due to a payment dispute`,
    html,
    text: `Hi ${backerName || "there"} — your bank has opened a dispute against your $${amount.toFixed(2)} pledge to "${projectTitle}"${disputeId ? ` (${disputeId})` : ""}. Under the Chargeback Handling Policy (${policyUrl}) your account is suspended and your reward ${alreadyShipped ? "will receive no further items" : "will not be produced or shipped"} while the dispute is open. If the dispute was a mistake, withdraw it with your bank, then reply to this email once it is dismissed and we will review reinstatement.`,
    skipUnsubscribeCheck: true, // Transactional: account status
    priority: EMAIL_PRIORITY.SYSTEM,
  });
}
