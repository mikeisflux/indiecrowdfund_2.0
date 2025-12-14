import sgMail from "@sendgrid/mail";
import { db } from "@/lib/db";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "IndieCrowdfund";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// Get email settings from database
async function getEmailSettings() {
  try {
    const settings = await db.platformSettings.findUnique({
      where: { id: "default" },
    });
    return settings;
  } catch {
    return null;
  }
}

export async function sendEmail({ to, subject, html, text }: SendEmailOptions) {
  const settings = await getEmailSettings();

  // Check for SendGrid API key (from DB settings or env)
  const sendgridApiKey = settings?.sendgridApiKey || process.env.SENDGRID_API_KEY;
  const fromEmail = settings?.smtpFromEmail || process.env.EMAIL_FROM || "noreply@indiecrowdfund.com";
  const fromName = settings?.smtpFromName || APP_NAME;

  if (!sendgridApiKey) {
    console.warn("Email not configured - SendGrid API key is missing");
    console.log("Would send email to:", to);
    console.log("Subject:", subject);
    return { success: false, error: "Email not configured" };
  }

  try {
    sgMail.setApiKey(sendgridApiKey);

    console.log(`Sending email to: ${to}, subject: ${subject}, from: ${fromEmail}`);

    const response = await sgMail.send({
      to,
      from: {
        email: fromEmail,
        name: fromName,
      },
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ""),
    });

    console.log("Email sent successfully, status:", response[0]?.statusCode);

    // Save a copy to admin email system (sent folder)
    try {
      // Find or create the mailbox for the sender
      let mailbox = await db.mailbox.findFirst({
        where: { email: fromEmail },
      });

      if (!mailbox) {
        // Create the mailbox if it doesn't exist
        mailbox = await db.mailbox.create({
          data: {
            name: fromName,
            email: fromEmail,
            description: "System outgoing emails",
            isDefault: true,
            isActive: true,
          },
        });
        console.log(`Created mailbox for ${fromEmail}`);
      }

      // Save the email to the sent folder
      await db.adminEmail.create({
        data: {
          mailboxId: mailbox.id,
          fromEmail: fromEmail,
          fromName: fromName,
          toEmail: to,
          subject: subject,
          bodyHtml: html,
          bodyText: text || html.replace(/<[^>]*>/g, ""),
          folder: "SENT",
          status: "SENT",
          isRead: true,
          sentAt: new Date(),
        },
      });
      console.log(`Saved outgoing email to admin sent folder`);
    } catch (saveError) {
      // Don't fail the email send if saving to admin fails
      console.error("Failed to save email to admin sent folder:", saveError);
    }

    return { success: true };
  } catch (error: unknown) {
    console.error("Error sending email via SendGrid:");

    // Log detailed SendGrid error information
    if (error && typeof error === "object" && "response" in error) {
      const sgError = error as { response?: { body?: unknown; statusCode?: number } };
      console.error("SendGrid status code:", sgError.response?.statusCode);
      console.error("SendGrid response body:", JSON.stringify(sgError.response?.body, null, 2));
    } else {
      console.error("Error details:", error);
    }

    return { success: false, error: "Failed to send email" };
  }
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
        </div>

        <div style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
          <h2 style="margin-top: 0; color: #333;">Reset Your Password</h2>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="display: inline-block; background: #000; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500;">
              Reset Password
            </a>
          </div>

          <p style="color: #666; font-size: 14px;">
            This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
          </p>

          <p style="color: #666; font-size: 14px; margin-bottom: 0;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${resetUrl}" style="color: #0066cc; word-break: break-all;">${resetUrl}</a>
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
    subject: `Reset your ${APP_NAME} password`,
    html,
  });
}

export async function sendCollaboratorInviteEmail(
  email: string,
  inviterName: string,
  projectTitle: string,
  collaboratorId: string
) {
  const respondUrl = `${APP_URL}/collaborate/${collaboratorId}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>You've Been Invited to Collaborate</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
        </div>

        <div style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
          <h2 style="margin-top: 0; color: #333;">You've Been Invited to Collaborate!</h2>
          <p><strong>${inviterName}</strong> has invited you to collaborate on the project:</p>

          <div style="background: #fff; border: 1px solid #e5e5e5; border-radius: 6px; padding: 20px; margin: 20px 0; text-align: center;">
            <h3 style="margin: 0 0 10px 0; color: #333;">${projectTitle}</h3>
          </div>

          <p>As a collaborator, you'll be able to help manage this project based on the permissions granted to you.</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${respondUrl}" style="display: inline-block; background: #028858; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500; margin-right: 10px;">
              Accept Invitation
            </a>
            <a href="${respondUrl}" style="display: inline-block; background: #fff; color: #666; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500; border: 1px solid #ddd;">
              View Details
            </a>
          </div>

          <p style="color: #666; font-size: 14px; margin-bottom: 0;">
            You'll need to log in to your ${APP_NAME} account to accept or decline this invitation.
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
    subject: `${inviterName} invited you to collaborate on "${projectTitle}"`,
    html,
  });
}

// Project Review Email Functions
export async function sendProjectSubmittedEmail(
  email: string,
  creatorName: string,
  projectTitle: string
) {
  const dashboardUrl = `${APP_URL}/dashboard/projects`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Project Submitted for Review</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
        </div>

        <div style="background: #f0f9ff; border-radius: 8px; padding: 30px; margin-bottom: 20px; border: 1px solid #bae6fd;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="display: inline-block; background: #0ea5e9; color: white; padding: 10px 20px; border-radius: 50px; font-size: 14px; font-weight: 600;">
              UNDER REVIEW
            </div>
          </div>

          <h2 style="margin-top: 0; color: #0369a1; text-align: center;">Project Submitted!</h2>
          <p>Hi ${creatorName || "Creator"},</p>
          <p>Your project <strong>"${projectTitle}"</strong> has been submitted for review.</p>

          <div style="background: white; border-radius: 6px; padding: 15px; margin: 20px 0; border-left: 4px solid #0ea5e9;">
            <p style="margin: 0; color: #666; font-size: 14px;"><strong>What happens next?</strong></p>
            <p style="margin: 10px 0 0 0;">Our team will review your project within 1-2 business days. We'll notify you by email once the review is complete.</p>
          </div>

          <p>In the meantime, you can continue to make edits to your project. Any changes will be included in the review.</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${dashboardUrl}" style="display: inline-block; background: #0ea5e9; color: #fff; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
              View Your Projects
            </a>
          </div>

          <p style="color: #666; font-size: 14px; text-align: center;">
            Thank you for using ${APP_NAME}!
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
    subject: `Your project "${projectTitle}" is under review`,
    html,
  });
}

export async function sendProjectApprovedEmail(
  email: string,
  creatorName: string,
  projectTitle: string,
  projectSlug: string,
  notes?: string
) {
  const dashboardUrl = `${APP_URL}/dashboard/projects`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Project Has Been Approved!</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
        </div>

        <div style="background: #f0fdf4; border-radius: 8px; padding: 30px; margin-bottom: 20px; border: 1px solid #bbf7d0;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="display: inline-block; background: #22c55e; color: white; padding: 10px 20px; border-radius: 50px; font-size: 14px; font-weight: 600;">
              ✓ APPROVED
            </div>
          </div>

          <h2 style="margin-top: 0; color: #15803d; text-align: center;">Congratulations, ${creatorName || "Creator"}!</h2>
          <p style="text-align: center;">Your project <strong>"${projectTitle}"</strong> has been approved and is ready to launch!</p>

          ${notes ? `
          <div style="background: white; border-radius: 6px; padding: 15px; margin: 20px 0; border-left: 4px solid #22c55e;">
            <p style="margin: 0; color: #666; font-size: 14px;"><strong>Notes from reviewer:</strong></p>
            <p style="margin: 10px 0 0 0;">${notes}</p>
          </div>
          ` : ""}

          <div style="text-align: center; margin: 30px 0;">
            <a href="${dashboardUrl}" style="display: inline-block; background: #22c55e; color: #fff; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
              Launch Your Project
            </a>
          </div>

          <p style="color: #666; font-size: 14px; text-align: center;">
            Head to your dashboard to set your launch date and go live!
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
    subject: `🎉 Your project "${projectTitle}" has been approved!`,
    html,
  });
}

export async function sendProjectRejectedEmail(
  email: string,
  creatorName: string,
  projectTitle: string,
  rejectionReason: string,
  notes?: string
) {
  const dashboardUrl = `${APP_URL}/dashboard/projects`;

  const reasonLabels: Record<string, string> = {
    INCOMPLETE_INFORMATION: "Incomplete Information",
    POLICY_VIOLATION: "Policy Violation",
    PROHIBITED_CONTENT: "Prohibited Content",
    INTELLECTUAL_PROPERTY: "Intellectual Property Issues",
    FRAUD_SUSPECTED: "Suspected Fraud",
    UNREALISTIC_GOALS: "Unrealistic Goals",
    MISSING_REWARDS: "Missing or Inadequate Rewards",
    IDENTITY_VERIFICATION: "Identity Verification Required",
    OTHER: "Other",
  };

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Project Review Update</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
        </div>

        <div style="background: #fef2f2; border-radius: 8px; padding: 30px; margin-bottom: 20px; border: 1px solid #fecaca;">
          <h2 style="margin-top: 0; color: #dc2626;">Project Not Approved</h2>
          <p>Hi ${creatorName || "Creator"},</p>
          <p>Unfortunately, your project <strong>"${projectTitle}"</strong> was not approved at this time.</p>

          <div style="background: white; border-radius: 6px; padding: 15px; margin: 20px 0; border-left: 4px solid #dc2626;">
            <p style="margin: 0; color: #666; font-size: 14px;"><strong>Reason:</strong></p>
            <p style="margin: 10px 0 0 0; font-weight: 500;">${reasonLabels[rejectionReason] || rejectionReason}</p>
          </div>

          ${notes ? `
          <div style="background: white; border-radius: 6px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #666; font-size: 14px;"><strong>Reviewer feedback:</strong></p>
            <p style="margin: 10px 0 0 0;">${notes}</p>
          </div>
          ` : ""}

          <p>You may edit your project and resubmit it for review. Please address the issues mentioned above before resubmitting.</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${dashboardUrl}" style="display: inline-block; background: #333; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500;">
              Edit Project
            </a>
          </div>

          <p style="color: #666; font-size: 14px;">
            If you have questions about this decision, please contact our support team.
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
    subject: `Update on your project "${projectTitle}"`,
    html,
  });
}

/**
 * Send pledge confirmation email to backer
 */
export async function sendPledgeConfirmationEmail(
  email: string,
  backerName: string,
  projectTitle: string,
  projectSlug: string,
  amount: number,
  rewardTitle: string | null,
  chargedImmediately: boolean,
  imageUrl?: string | null,
  currency: string = "USD",
  addons: Array<{ title: string; quantity: number; amount: number }> = [],
  shippingInfo?: {
    name: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
  } | null
) {
  const projectUrl = `${APP_URL}/projects/${projectSlug}`;
  const dashboardUrl = `${APP_URL}/dashboard`;

  // Ensure image URL is absolute
  const absoluteImageUrl = imageUrl
    ? (imageUrl.startsWith("http") ? imageUrl : `${APP_URL}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`)
    : null;

  // Format amount with the project's currency
  const formatCurrency = (value: number) => new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
  }).format(value);

  const formattedAmount = formatCurrency(amount);

  const chargeMessage = chargedImmediately
    ? `Your payment of <strong>${formattedAmount}</strong> has been processed successfully.`
    : `Your card has been saved and will be charged <strong>${formattedAmount}</strong> when the campaign reaches its funding goal.`;

  // Build addons HTML
  const addonsHtml = addons.length > 0 ? addons.map(addon => `
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5;">Add-on: ${addon.title}${addon.quantity > 1 ? ` (×${addon.quantity})` : ""}</td>
      <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5; text-align: right;">${formatCurrency(addon.amount)}</td>
    </tr>
  `).join("") : "";

  // Build shipping HTML
  const hasShipping = shippingInfo && (shippingInfo.address || shippingInfo.city || shippingInfo.country);
  const shippingHtml = hasShipping ? `
    <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
      <h3 style="margin-top: 0;">Shipping Address</h3>
      <p style="margin: 0; color: #333;">
        ${shippingInfo!.name || backerName}<br>
        ${shippingInfo!.address || ""}<br>
        ${[shippingInfo!.city, shippingInfo!.state, shippingInfo!.postalCode].filter(Boolean).join(", ")}<br>
        ${shippingInfo!.country || ""}
      </p>
    </div>
  ` : "";

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Pledge Confirmation</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
        </div>

        <div style="background: linear-gradient(135deg, #028858 0%, #10b981 100%); border-radius: 8px; padding: 30px; margin-bottom: 20px; color: white;">
          <h2 style="margin-top: 0; color: white; text-align: center;">Thank You for Your Pledge!</h2>

          ${absoluteImageUrl ? `<img src="${absoluteImageUrl}" alt="${projectTitle}" style="width: 100%; max-width: 500px; height: auto; border-radius: 8px; margin: 20px auto; display: block;">` : ""}

          <div style="background: rgba(255,255,255,0.15); border-radius: 6px; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: white;">${projectTitle}</h3>
            ${rewardTitle ? `<p style="margin: 0; color: rgba(255,255,255,0.9);">Reward: ${rewardTitle}</p>` : `<p style="margin: 0; color: rgba(255,255,255,0.9);">Pledge without reward</p>`}
            ${addons.length > 0 ? `<p style="margin: 5px 0 0 0; color: rgba(255,255,255,0.9);">+ ${addons.length} add-on${addons.length > 1 ? "s" : ""}</p>` : ""}
          </div>

          <p style="text-align: center; margin-bottom: 0;">Hi ${backerName || "there"},</p>
          <p style="text-align: center;">${chargeMessage}</p>
        </div>

        <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h3 style="margin-top: 0;">Pledge Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5;">Reward</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5; text-align: right;">${rewardTitle || "No reward selected"}</td>
            </tr>
            ${addonsHtml}
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5; font-weight: 600;">Total Amount</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5; text-align: right; font-weight: 600;">${formattedAmount}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;">Status</td>
              <td style="padding: 8px 0; text-align: right; color: #028858; font-weight: 600;">${chargedImmediately ? "Paid" : "Card Saved"}</td>
            </tr>
          </table>
        </div>

        ${shippingHtml}

        ${!chargedImmediately ? `
        <div style="background: #fffbeb; border-radius: 8px; padding: 15px; margin-bottom: 20px; border: 1px solid #fef3c7;">
          <p style="margin: 0; font-size: 14px;"><strong>Note:</strong> Your card will only be charged if the campaign successfully reaches its funding goal. If the campaign doesn't reach its goal, you won't be charged.</p>
        </div>
        ` : ""}

        <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <p style="margin: 0 0 15px 0;"><strong>What happens next?</strong></p>
          <p style="margin: 0; color: #666;">You'll receive updates from the creator as the project progresses. ${!hasShipping ? "We'll send you a survey to collect shipping details closer to the estimated delivery date." : "The creator will reach out when it's time to ship your rewards."}</p>
        </div>

        <div style="text-align: center; margin: 20px 0;">
          <a href="${projectUrl}" style="display: inline-block; background: #028858; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500; margin-right: 10px;">
            View Project
          </a>
          <a href="${dashboardUrl}" style="display: inline-block; background: #333; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500;">
            My Dashboard
          </a>
        </div>

        <div style="text-align: center; color: #999; font-size: 12px; margin-top: 30px;">
          <p>You received this email because you backed a project on ${APP_NAME}.</p>
          <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  const subject = `Your pledge for "${projectTitle}" is confirmed!`;
  const result = await sendEmail({
    to: email,
    subject,
    html,
  });

  // Return both the result and the email content for logging
  return {
    ...result,
    subject,
    html,
  };
}

export async function sendProjectChangesRequestedEmail(
  email: string,
  creatorName: string,
  projectTitle: string,
  notes: string
) {
  const dashboardUrl = `${APP_URL}/dashboard/projects`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Changes Requested for Your Project</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
        </div>

        <div style="background: #fffbeb; border-radius: 8px; padding: 30px; margin-bottom: 20px; border: 1px solid #fef3c7;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="display: inline-block; background: #f59e0b; color: white; padding: 10px 20px; border-radius: 50px; font-size: 14px; font-weight: 600;">
              CHANGES REQUESTED
            </div>
          </div>

          <h2 style="margin-top: 0; color: #d97706; text-align: center;">Almost There!</h2>
          <p>Hi ${creatorName || "Creator"},</p>
          <p>Your project <strong>"${projectTitle}"</strong> is close to being approved, but we need a few changes first.</p>

          <div style="background: white; border-radius: 6px; padding: 15px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <p style="margin: 0; color: #666; font-size: 14px;"><strong>Requested changes:</strong></p>
            <p style="margin: 10px 0 0 0;">${notes}</p>
          </div>

          <p>Please make these changes and resubmit your project for review.</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${dashboardUrl}" style="display: inline-block; background: #f59e0b; color: #fff; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
              Edit Your Project
            </a>
          </div>

          <p style="color: #666; font-size: 14px; text-align: center;">
            Once you've made the requested changes, click "Submit for Review" again.
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
    subject: `Changes requested for "${projectTitle}"`,
    html,
  });
}
