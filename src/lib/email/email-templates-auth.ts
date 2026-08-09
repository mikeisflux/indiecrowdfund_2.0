import { sendEmail, queueEmail, EMAIL_PRIORITY } from "./email-config";

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
            This link works for 24 hours and can be used once. If you requested
            more than one reset email, any of the recent ones will work &mdash; but
            open the newest, since each link stops working after it's used.
          </p>

          <p style="color: #666; font-size: 14px;">
            If you didn't request a password reset, you can safely ignore this email.
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

  // Password reset is a transactional email — route through the queue at
  // SYSTEM priority so it never gets stuck behind marketing campaigns when
  // Mailgun/SendGrid is rate-limiting, and so failures are retried with
  // full visibility in /admin/email-queue instead of silently dropping.
  return queueEmail({
    to: email,
    subject: `Reset your ${APP_NAME} password`,
    html,
    skipUnsubscribeCheck: true,
    priority: EMAIL_PRIORITY.SYSTEM,
  });
}

/**
 * Send welcome email to new user on signup
 */
export async function sendWelcomeEmail(
  email: string,
  userName: string
) {
  const dashboardUrl = `${APP_URL}/dashboard`;
  const exploreUrl = `${APP_URL}/explore`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to ${APP_NAME}!</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
        </div>

        <div style="background: linear-gradient(135deg, #028858 0%, #10b981 100%); border-radius: 8px; padding: 30px; margin-bottom: 20px; color: white;">
          <h2 style="margin-top: 0; color: white; text-align: center;">Welcome to ${APP_NAME}!</h2>
          <p style="text-align: center;">Hi ${escapeHtml(userName || "there")},</p>
          <p style="text-align: center;">Thank you for joining our community! You're now part of a platform where creators bring their ideas to life and backers help make them happen.</p>
        </div>

        <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h3 style="margin-top: 0;">What can you do on ${APP_NAME}?</h3>
          <ul style="color: #666; margin: 0; padding-left: 20px;">
            <li style="margin-bottom: 10px;"><strong>Discover Projects</strong> - Explore creative projects across various categories</li>
            <li style="margin-bottom: 10px;"><strong>Back Projects</strong> - Support creators and get exclusive rewards</li>
            <li style="margin-bottom: 10px;"><strong>Create Projects</strong> - Launch your own crowdfunding campaign</li>
            <li style="margin-bottom: 10px;"><strong>Connect</strong> - Join a community of creators and backers</li>
          </ul>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${exploreUrl}" style="display: inline-block; background: #028858; color: #fff; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; margin-right: 10px;">
            Explore Projects
          </a>
          <a href="${dashboardUrl}" style="display: inline-block; background: #333; color: #fff; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
            Go to Dashboard
          </a>
        </div>

        <div style="text-align: center; color: #999; font-size: 12px; margin-top: 30px;">
          <p>You received this email because you signed up for ${APP_NAME}.</p>
          <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `Welcome to ${APP_NAME}! 🎉`,
    html,
  });
}

/**
 * Send email verification email
 */
export async function sendVerificationEmail(
  email: string,
  userName: string,
  verificationToken: string
) {
  // Include both token AND email in the URL so the verify-email page
  // can validate without an extra DB round-trip. The page used to
  // hard-error with "Token or email is missing" for any link that
  // omitted email — this email template was the only sender that
  // dropped it, leaving every brand-new signup unable to verify.
  const verifyUrl = `${APP_URL}/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
        </div>

        <div style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
          <h2 style="margin-top: 0; color: #333;">Verify Your Email Address</h2>
          <p>Hi ${escapeHtml(userName || "there")},</p>
          <p>Please click the button below to verify your email address and complete your registration.</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}" style="display: inline-block; background: #028858; color: #fff; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
              Verify Email Address
            </a>
          </div>

          <p style="color: #666; font-size: 14px;">
            This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
          </p>

          <p style="color: #666; font-size: 14px; margin-bottom: 0;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${verifyUrl}" style="color: #0066cc; word-break: break-all;">${verifyUrl}</a>
          </p>
        </div>

        <div style="text-align: center; color: #999; font-size: 12px;">
          <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  // Email verification is a transactional email — route through the queue at
  // SYSTEM priority so it never gets stuck behind marketing campaigns when
  // Mailgun/SendGrid is rate-limiting, and so failures are retried with
  // full visibility in /admin/email-queue instead of silently dropping.
  return queueEmail({
    to: email,
    subject: `Verify your ${APP_NAME} email address`,
    html,
    skipUnsubscribeCheck: true,
    priority: EMAIL_PRIORITY.SYSTEM,
  });
}
