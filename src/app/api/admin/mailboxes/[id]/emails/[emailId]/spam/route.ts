import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { blockSenderAtProvider } from "@/lib/email/inbound-blocklist";

const log = logger.child({ module: "admin-email-report-spam" });

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await db.user.findFirst({
    where: { id: session.user.id, deletedAt: null },
    select: { role: true },
  });
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) return null;
  return session.user;
}

// Never let an admin lock the platform out of its own mail.
function isSelfDomain(domain: string): boolean {
  const own = (process.env.NEXT_PUBLIC_APP_URL || "https://indiecrowdfund.com")
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "")
    .toLowerCase();
  return domain === own || domain.endsWith(`.${own}`);
}

// POST - Report an email as spam.
//   1. files this email (and anything else from the sender) under SPAM
//   2. adds the sender to EmailBlocklist so our inbound webhook drops future
//      mail before storing it or its attachments
//   3. creates a Mailgun route that discards the mail at the provider, so it
//      never reaches us at all
// Provider failure is non-fatal: the local block still applies.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; emailId: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id: mailboxId, emailId } = await params;
    const body = await request.json().catch(() => ({}));
    // "email" blocks one address; "domain" blocks the whole sending domain in
    // a single Mailgun route (cheaper when a spammer rotates local parts).
    const scope: "email" | "domain" = body?.scope === "domain" ? "domain" : "email";

    const email = await db.adminEmail.findFirst({
      where: { id: emailId, mailboxId },
      select: { id: true, fromEmail: true, subject: true },
    });
    if (!email) return NextResponse.json({ error: "Email not found" }, { status: 404 });

    const fromEmail = (email.fromEmail || "").trim().toLowerCase();
    if (!fromEmail || !fromEmail.includes("@")) {
      return NextResponse.json({ error: "This email has no usable sender address" }, { status: 400 });
    }
    const domain = fromEmail.split("@")[1];

    if (isSelfDomain(domain)) {
      return NextResponse.json(
        { error: "Refusing to block your own domain — that would drop all platform mail." },
        { status: 400 }
      );
    }

    const type = scope === "domain" ? "DOMAIN" : "EMAIL";
    const value = scope === "domain" ? domain : fromEmail;

    // Local block first: it's the one that always works, and it takes effect
    // on the very next inbound message.
    const entry = await db.emailBlocklist.upsert({
      where: { type_value: { type, value } },
      create: {
        type,
        value,
        reason: `Reported as spam from admin inbox: "${email.subject || "(no subject)"}"`,
        source: "admin-report-spam",
        isActive: true,
      },
      update: { isActive: true, source: "admin-report-spam" },
    });

    // File this message and any other mail already sitting in the inbox from
    // the same sender, so reporting one message clears the whole run.
    const filed = await db.adminEmail.updateMany({
      where: {
        ...(scope === "domain"
          ? { fromEmail: { endsWith: `@${domain}` } }
          : { fromEmail: fromEmail }),
        folder: { not: "SPAM" },
      },
      data: { folder: "SPAM", isRead: true },
    });

    // Then the provider-level drop. Only create a route if we don't already
    // have one for this rule.
    let provider: { ok: boolean; error?: string } = { ok: true };
    if (!entry.providerRouteId) {
      const result = await blockSenderAtProvider(value, type);
      provider = { ok: result.ok, error: result.error };
      if (result.ok && result.routeId) {
        await db.emailBlocklist
          .update({ where: { id: entry.id }, data: { providerRouteId: result.routeId } })
          .catch(() => {});
      }
    }

    log.info(
      { value, type, filed: filed.count, providerOk: provider.ok, adminId: admin.id },
      "Sender reported as spam"
    );

    return NextResponse.json({
      success: true,
      blocked: value,
      scope,
      movedToSpam: filed.count,
      providerBlocked: provider.ok,
      // Surfaced so the UI can tell the admin the block is local-only.
      providerError: provider.ok ? undefined : provider.error,
    });
  } catch (error) {
    log.error({ err: formatError(error) }, "Failed to report spam");
    return NextResponse.json({ error: "Failed to report spam" }, { status: 500 });
  }
}
