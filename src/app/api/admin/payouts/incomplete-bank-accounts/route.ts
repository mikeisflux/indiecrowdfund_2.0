import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";
import { auditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/core";
import { sendPayoutDetailsIncompleteEmail } from "@/lib/email/email-templates-payout";
import { findCreatorsWithIncompletePayoutDetails, pendingPayoutDetails } from "@/lib/payouts/payout-details";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const log = logger.child({ module: "admin-incomplete-bank-accounts" });

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await db.user.findFirst({ where: { id: session.user.id, deletedAt: null }, select: { role: true } });
  return user?.role === "SUPER_ADMIN" ? session.user : null;
}

// GET - Every creator whose payout account is missing required information.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const creators = await findCreatorsWithIncompletePayoutDetails();
  return NextResponse.json({ creators, count: creators.length });
}

async function remind(user: { id: string; name: string | null; email: string }, adminId: string, adminEmail?: string | null) {
  const pending = await pendingPayoutDetails(user.id);
  if (pending.length === 0) return { userId: user.id, email: user.email, skipped: "complete" as const };

  const accounts = pending.map((p) => ({ label: p.label, exists: p.exists, missing: p.missing, projects: p.projects }));
  const result = await sendPayoutDetailsIncompleteEmail({ email: user.email, creatorName: user.name, accounts });

  await createNotification({
    userId: user.id,
    type: "SYSTEM",
    title: "Action required: finish your payout details",
    message: `Your ${accounts.map((a) => a.label).join(" and ")} payout account is missing ${accounts
      .flatMap((a) => a.missing)
      .join(", ")}. We can't send your settlement until it's complete.`,
    actionUrl: "/dashboard",
  }).catch((err: unknown) => log.warn({ err: formatError(err), userId: user.id }, "notification failed"));

  auditLog({
    action: "PAYOUT_DETAILS_REMINDER_SENT",
    actorId: adminId,
    actorEmail: adminEmail || undefined,
    targetId: user.id,
    targetType: "USER",
    details: { email: user.email, accounts: accounts.map((a) => ({ processor: a.label, missing: a.missing })), emailSent: !!result.success },
  });

  return { userId: user.id, email: user.email, emailSent: !!result.success, error: result.success ? undefined : result.error };
}

// POST - Email (and in-app notify) a creator to finish their payout details.
// { userId } for one creator, or { all: true } for everyone currently
// incomplete. Transactional: concerns money owed to them.
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const body = await req.json().catch(() => ({}));

    if (body.all === true) {
      const creators = await findCreatorsWithIncompletePayoutDetails();
      const results = [];
      for (const c of creators) {
        results.push(await remind({ id: c.userId, name: c.name, email: c.email }, admin.id, admin.email));
      }
      const sent = results.filter((r) => "emailSent" in r && r.emailSent).length;
      log.info({ total: creators.length, sent, admin: admin.id }, "Bulk payout-details reminders sent");
      return NextResponse.json({ total: creators.length, sent, results });
    }

    const userId = typeof body.userId === "string" ? body.userId : null;
    if (!userId) return NextResponse.json({ error: "userId or all:true required" }, { status: 400 });
    const user = await db.user.findFirst({ where: { id: userId, deletedAt: null }, select: { id: true, name: true, email: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const result = await remind(user, admin.id, admin.email);
    if ("skipped" in result) {
      return NextResponse.json({ error: "This creator's payout details are already complete." }, { status: 400 });
    }
    if (!result.emailSent) {
      return NextResponse.json({ error: `Email not sent: ${result.error || "provider error"}. In-app notification was created.` }, { status: 502 });
    }
    return NextResponse.json({ success: true, email: user.email });
  } catch (error) {
    log.error({ err: formatError(error) }, "payout-details reminder failed");
    return NextResponse.json({ error: "Failed to send reminder" }, { status: 500 });
  }
}
