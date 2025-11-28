import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Disable body parsing - we need raw multipart/form-data
export const runtime = "nodejs";

interface EmailEnvelope {
  to: string[];
  from: string;
}

interface ParsedEmail {
  to: string;
  toName?: string;
  from: string;
  fromName?: string;
  subject: string;
  text?: string;
  html?: string;
  cc?: string;
  attachments?: number;
  envelope?: EmailEnvelope;
}

// Extract name and email from "Name <email@example.com>" format
function parseEmailAddress(address: string): { email: string; name?: string } {
  const match = address.match(/^(?:"?([^"]*)"?\s)?<?([^>]+@[^>]+)>?$/);
  if (match) {
    return {
      name: match[1]?.trim() || undefined,
      email: match[2].trim().toLowerCase(),
    };
  }
  return { email: address.trim().toLowerCase() };
}

// Find matching mailbox for the recipient email
async function findMailboxForEmail(toEmail: string) {
  // Try exact match first
  let mailbox = await db.mailbox.findUnique({
    where: { email: toEmail.toLowerCase() },
  });

  if (mailbox) return mailbox;

  // Try matching without subdomain variations (e.g., support@mail.domain.com -> support@domain.com)
  const emailParts = toEmail.split("@");
  if (emailParts.length === 2) {
    const localPart = emailParts[0];
    const domainParts = emailParts[1].split(".");

    // Try removing subdomains one at a time
    while (domainParts.length > 2) {
      domainParts.shift();
      const altEmail = `${localPart}@${domainParts.join(".")}`;
      mailbox = await db.mailbox.findUnique({
        where: { email: altEmail.toLowerCase() },
      });
      if (mailbox) return mailbox;
    }
  }

  // Fall back to default mailbox
  mailbox = await db.mailbox.findFirst({
    where: { isDefault: true, isActive: true },
  });

  // If no default, get any active mailbox
  if (!mailbox) {
    mailbox = await db.mailbox.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    });
  }

  return mailbox;
}

// POST - Handle incoming email from SendGrid Inbound Parse
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    let emailData: ParsedEmail;

    if (contentType.includes("multipart/form-data")) {
      // Parse multipart form data (SendGrid default)
      const formData = await request.formData();

      // Debug: Log all form fields received from SendGrid
      const formFields: Record<string, string> = {};
      formData.forEach((value, key) => {
        if (typeof value === "string") {
          formFields[key] = value.substring(0, 200); // Truncate for logging
        } else {
          formFields[key] = `[File: ${value.name}]`;
        }
      });
      console.log("SendGrid Inbound Parse fields received:", JSON.stringify(formFields, null, 2));

      const toRaw = formData.get("to") as string || "";
      const fromRaw = formData.get("from") as string || "";
      const envelopeRaw = formData.get("envelope") as string;

      // Get email body - try multiple field names
      const textBody = (formData.get("text") as string) ||
                       (formData.get("body-plain") as string) ||
                       (formData.get("stripped-text") as string) || "";
      const htmlBody = (formData.get("html") as string) ||
                       (formData.get("body-html") as string) ||
                       (formData.get("stripped-html") as string) || "";

      console.log("Email body - text length:", textBody?.length || 0, "html length:", htmlBody?.length || 0);

      let envelope: EmailEnvelope | undefined;
      try {
        if (envelopeRaw) {
          envelope = JSON.parse(envelopeRaw);
        }
      } catch {
        // Ignore envelope parse errors
      }

      emailData = {
        to: toRaw,
        from: fromRaw,
        subject: (formData.get("subject") as string) || "(No Subject)",
        text: textBody || undefined,
        html: htmlBody || undefined,
        cc: (formData.get("cc") as string) || undefined,
        attachments: parseInt((formData.get("attachments") as string) || "0", 10),
        envelope,
      };
    } else if (contentType.includes("application/json")) {
      // Parse JSON (if SendGrid is configured for JSON)
      emailData = await request.json();
    } else {
      console.error("Unsupported content type for inbound email:", contentType);
      return NextResponse.json(
        { error: "Unsupported content type" },
        { status: 400 }
      );
    }

    // Parse sender and recipient
    const fromParsed = parseEmailAddress(emailData.from);
    const toParsed = parseEmailAddress(emailData.to);

    // Get the actual recipient email (prefer envelope for accuracy)
    const recipientEmail = emailData.envelope?.to?.[0] || toParsed.email;

    // Find matching mailbox
    const mailbox = await findMailboxForEmail(recipientEmail);

    if (!mailbox) {
      console.warn("No mailbox found for inbound email to:", recipientEmail);
      // Still return 200 to prevent SendGrid from retrying
      return NextResponse.json({
        success: false,
        reason: "No matching mailbox found",
        recipient: recipientEmail,
      });
    }

    // Generate a thread ID based on subject (simple threading)
    const subjectForThread = emailData.subject
      .replace(/^(re:|fw:|fwd:)\s*/gi, "")
      .trim()
      .toLowerCase();
    const threadId = `thread_${Buffer.from(subjectForThread).toString("base64").slice(0, 32)}`;

    // Store the email
    const email = await db.adminEmail.create({
      data: {
        mailboxId: mailbox.id,
        fromEmail: fromParsed.email,
        fromName: fromParsed.name || null,
        toEmail: toParsed.email,
        toName: toParsed.name || null,
        ccEmails: emailData.cc ? emailData.cc.split(",").map((e: string) => e.trim()) : [],
        bccEmails: [],
        subject: emailData.subject,
        bodyHtml: emailData.html || emailData.text?.replace(/\n/g, "<br>") || "",
        bodyText: emailData.text || null,
        folder: "INBOX",
        status: "DELIVERED",
        isRead: false,
        isStarred: false,
        receivedAt: new Date(),
        threadId,
        attachments: emailData.attachments ? { count: emailData.attachments } : null,
      },
    });

    console.log(`Inbound email received and stored: ${email.id} -> ${mailbox.name} (${mailbox.email})`);

    return NextResponse.json({
      success: true,
      emailId: email.id,
      mailboxId: mailbox.id,
      mailboxName: mailbox.name,
    });
  } catch (error) {
    console.error("Error processing inbound email:", error);
    // Return 200 anyway to prevent SendGrid from retrying on our errors
    return NextResponse.json({
      success: false,
      error: "Failed to process email",
    });
  }
}

// GET - Health check / verification endpoint
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Inbound email webhook is active",
    provider: "SendGrid Inbound Parse",
    endpoint: "/api/webhooks/email/inbound",
  });
}
