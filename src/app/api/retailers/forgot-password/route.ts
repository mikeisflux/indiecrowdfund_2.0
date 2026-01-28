import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";
import { sendEmail } from "@/lib/email";
import { verifyRecaptcha } from "@/lib/auth/recaptcha";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "IndieCrowdfund";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * Get client IP from request headers
 */
function getClientIP(req: NextRequest): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    null
  );
}

// POST - Request password reset for retailer
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, recaptchaToken } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Get client IP for rate limiting and reCAPTCHA
    const clientIP = getClientIP(req);

    // Verify reCAPTCHA if token provided
    const recaptchaResult = await verifyRecaptcha(recaptchaToken, clientIP);
    if (!recaptchaResult.valid) {
      return NextResponse.json(
        { error: recaptchaResult.error || "CAPTCHA verification failed" },
        { status: 400 }
      );
    }

    // Always return success to prevent email enumeration
    // But only actually send email if retailer exists and is approved
    const retailer = await db.retailer.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (retailer && retailer.status === "APPROVED") {
      // Delete any existing tokens for this email
      await db.passwordResetToken.deleteMany({
        where: { email: retailer.email },
      });

      // Generate a secure token
      const token = crypto.randomUUID();
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Create the reset token
      await db.passwordResetToken.create({
        data: {
          email: retailer.email,
          token,
          expires,
        },
      });

      // Send the reset email
      const resetUrl = `${APP_URL}/retailers/reset-password?token=${token}`;

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reset Your Retailer Password</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
              <p style="color: #10b981; font-weight: 500; margin-top: 5px;">Retailer Portal</p>
            </div>

            <div style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
              <h2 style="margin-top: 0; color: #333;">Reset Your Retailer Password</h2>
              <p>Hi ${retailer.contactName || retailer.businessName},</p>
              <p>We received a request to reset your retailer portal password. Click the button below to create a new password:</p>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%); color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500;">
                  Reset Password
                </a>
              </div>

              <p style="color: #666; font-size: 14px;">
                This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
              </p>

              <p style="color: #666; font-size: 14px; margin-bottom: 0;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${resetUrl}" style="color: #10b981; word-break: break-all;">${resetUrl}</a>
              </p>
            </div>

            <div style="text-align: center; color: #999; font-size: 12px;">
              <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
            </div>
          </body>
        </html>
      `;

      await sendEmail({
        to: retailer.email,
        subject: `Reset your ${APP_NAME} retailer password`,
        html,
        skipUnsubscribeCheck: true, // Transactional email
      });
    }

    // Always return success to prevent email enumeration
    return NextResponse.json({
      success: true,
      message: "If an account exists with this email, you will receive a password reset link.",
    });
  } catch (error) {
    console.error("Error requesting retailer password reset:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
