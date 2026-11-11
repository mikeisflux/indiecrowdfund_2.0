import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { suggestEmailCorrection } from "@/lib/email/typo-check";

export const dynamic = "force-dynamic";

/**
 * GET /api/user/verify-email/status
 *
 * What the "verify your email" screen needs to be honest with the person:
 * which address we are sending to, whether it is verified, what the mail
 * provider did with the last verification email (delivered, bounced,
 * failed, with reason), and a likely correction when the address looks
 * mistyped. A backer whose address was roger@…​.comm resent the link three
 * times and was told "sent!" each time while every copy bounced.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findFirst({ where: { id: session.user.id, deletedAt: null }, select: { email: true, emailVerified: true } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const last = await db.adminEmail.findFirst({
    where: { toEmail: { equals: user.email, mode: "insensitive" }, folder: "SENT", subject: { contains: "Verify", mode: "insensitive" } },
    orderBy: { sentAt: "desc" },
    select: { status: true, sentAt: true, attachments: true },
  });
  const att = (last?.attachments ?? {}) as Record<string, unknown>;
  const failed = last ? ["FAILED", "BOUNCED"].includes(last.status) : false;
  const typo = suggestEmailCorrection(user.email);

  return NextResponse.json({
    email: user.email,
    verified: !!user.emailVerified,
    lastSend: last
      ? {
          status: last.status,
          sentAt: last.sentAt,
          delivered: last.status === "DELIVERED" || !!att.deliveredAt,
          failed,
          reason: typeof att.bounceReason === "string" && att.bounceReason !== "generic" ? att.bounceReason : null,
        }
      : null,
    suggestion: typo ? { email: typo.suggestion, reason: typo.reason, hard: typo.hard } : null,
  });
}
