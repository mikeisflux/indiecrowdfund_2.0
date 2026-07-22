import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const contactLogger = logger.child({ module: "contact" });
import { z } from "zod";
import { sendEmail } from "@/lib/email";
import { db } from "@/lib/db";
import { escapeHtml, escapeHtmlForEmail } from "@/lib/utils/api-params";
import { rateLimiter } from "@/lib/rate-limiter";
import { verifyRecaptcha } from "@/lib/auth/recaptcha";

// Schema for contact form validation
const contactSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address"),
  category: z.enum(["general", "support", "billing", "project", "report"]),
  subject: z.string().min(1, "Subject is required").max(200).refine(s => !/[\r\n]/.test(s), "Subject cannot contain line breaks"),
  message: z.string().min(10, "Message must be at least 10 characters").max(5000),
  recaptchaToken: z.string().nullish(),
  // Anti-spam signals from the form: honeypot field (must stay empty) and
  // the time the form was rendered (bots submit instantly).
  website: z.string().optional(),
  formLoadedAt: z.number().optional(),
});

// Random-string spam detector. The bot traffic we see fills name/subject/
// message with single tokens of random mixed-case letters ("KODRWrFUSGbMGYmCec").
// A lone alphabetic token with many lower→upper case flips is essentially
// never a real name, subject, or message — real single-word values ("Hello",
// "REFUND") flip case at most once or twice.
function looksLikeRandomToken(value: string): boolean {
  const s = value.trim();
  if (s.length < 10 || /\s/.test(s) || !/^[A-Za-z]+$/.test(s)) return false;
  let flips = 0;
  for (let i = 1; i < s.length; i++) {
    const prevUpper = s[i - 1] >= "A" && s[i - 1] <= "Z";
    const curUpper = s[i] >= "A" && s[i] <= "Z";
    if (prevUpper !== curUpper) flips++;
  }
  return flips >= 4;
}

const categoryLabels: Record<string, string> = {
  general: "General Inquiry",
  support: "Technical Support",
  billing: "Billing & Payments",
  project: "Project Issues",
  report: "Report a Problem",
};

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 5 submissions per IP per 10 minutes
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = await rateLimiter.check("contact", ip, { limit: 5, windowSec: 600 });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait before submitting again." },
        { status: 429, headers: { "Retry-After": String(rl.resetAt - Math.floor(Date.now() / 1000)) } }
      );
    }

    const body = await req.json();

    // Validate input
    const data = contactSchema.parse(body);

    // reCAPTCHA — enforced when keys are configured (Admin > Settings), no-op
    // otherwise. This is the hard gate against bots POSTing the API directly.
    const recaptchaResult = await verifyRecaptcha(data.recaptchaToken ?? null, ip);
    if (!recaptchaResult.valid) {
      return NextResponse.json(
        { error: recaptchaResult.error || "CAPTCHA verification failed" },
        { status: 400 }
      );
    }

    // Silent spam drops: respond with success so bots don't learn what
    // tripped them, but never send the email or store the message.
    // 1. Honeypot: the hidden "website" field is invisible to humans.
    // 2. Timing: humans don't fill five fields in under 3 seconds.
    // 3. Gibberish: two or more of name/subject/message are random tokens.
    const gibberishFields = [data.name, data.subject, data.message].filter(looksLikeRandomToken).length;
    const tooFast = typeof data.formLoadedAt === "number" && Date.now() - data.formLoadedAt < 3000;
    if (data.website || tooFast || gibberishFields >= 2) {
      contactLogger.warn(
        {
          ip,
          honeypot: !!data.website,
          tooFast,
          gibberishFields,
          email: data.email,
        },
        "Dropped spam contact form submission"
      );
      return NextResponse.json({
        success: true,
        message: "Your message has been sent successfully.",
      });
    }

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
    contactLogger.error({ err: formatError(error) }, "Contact form error:");

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
