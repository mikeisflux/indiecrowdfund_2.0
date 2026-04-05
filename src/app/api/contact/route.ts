import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const contactLogger = logger.child({ module: "contact" });
import { z } from "zod";
import { sendEmail } from "@/lib/email";
import { db } from "@/lib/db";
import { escapeHtml, escapeHtmlForEmail } from "@/lib/utils/api-params";

// Schema for contact form validation
const contactSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address"),
  category: z.enum(["general", "support", "billing", "project", "report"]),
  subject: z.string().min(1, "Subject is required").max(200),
  message: z.string().min(10, "Message must be at least 10 characters").max(5000),
});

const categoryLabels: Record<string, string> = {
  general: "General Inquiry",
  support: "Technical Support",
  billing: "Billing & Payments",
  project: "Project Issues",
  report: "Report a Problem",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate input
    const data = contactSchema.parse(body);

    // Get support email from settings or use default
    let supportEmail = "support@indiecrowdfund.com";
    try {
      const settings = await db.platformSettings.findUnique({ where: { id: "default" }, select: { supportEmail: true } });
      if (settings?.supportEmail) {
        supportEmail = settings.supportEmail;
      }
    } catch {
      // Use default email if settings can't be fetched
    }

    // Escape user input for safe HTML rendering
    const safeName = escapeHtml(data.name);
    const safeEmail = escapeHtml(data.email);
    const safeSubject = escapeHtml(data.subject);
    const safeMessage = escapeHtmlForEmail(data.message);
    const safeCategory = escapeHtml(categoryLabels[data.category] || data.category);

    // Send email to support team
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">New Contact Form Submission</h2>

        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>From:</strong> ${safeName}</p>
          <p style="margin: 0 0 10px 0;"><strong>Email:</strong> ${safeEmail}</p>
          <p style="margin: 0 0 10px 0;"><strong>Category:</strong> ${safeCategory}</p>
          <p style="margin: 0;"><strong>Subject:</strong> ${safeSubject}</p>
        </div>

        <div style="margin: 20px 0;">
          <h3 style="color: #333;">Message:</h3>
          <div style="background: #fff; border: 1px solid #ddd; padding: 15px; border-radius: 8px;">${safeMessage}</div>
        </div>

        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />

        <p style="color: #666; font-size: 12px;">
          Reply directly to this email to respond to ${safeName} at ${safeEmail}
        </p>
      </div>
    `;

    const result = await sendEmail({
      to: supportEmail,
      subject: `[Contact Form] ${categoryLabels[data.category]}: ${data.subject}`,
      html: emailHtml,
      text: `New contact form submission from ${data.name} (${data.email})\n\nCategory: ${categoryLabels[data.category]}\nSubject: ${data.subject}\n\nMessage:\n${data.message}`,
    });

    if (!result.success) {
      contactLogger.error({ err: String(result.error) }, "Failed to send contact email:");
      return NextResponse.json(
        { error: "Failed to send message. Please try again later." },
        { status: 500 }
      );
    }

    // Optionally save to database for tracking
    try {
      await db.contactMessage.create({
        data: {
          name: data.name,
          email: data.email,
          category: data.category,
          subject: data.subject,
          message: data.message,
        },
      });
    } catch {
      // If ContactMessage model doesn't exist, that's okay - email was still sent
    }

    return NextResponse.json({
      success: true,
      message: "Your message has been sent successfully.",
    });
  } catch (error) {
    contactLogger.error({ err: String(error) }, "Contact form error:");

    if (error instanceof z.ZodError) {
      const errorMessage = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to send message. Please try again later." },
      { status: 500 }
    );
  }
}
