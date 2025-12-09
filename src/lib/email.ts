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
