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
              <a href="${APP_URL}/dashboard/backer?tab=digital-downloads" style="display: inline-block; background: #22c55e; color: #fff; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
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
