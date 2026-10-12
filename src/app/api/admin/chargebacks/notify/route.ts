import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";
import { notifyBackerOfChargebackBan } from "@/lib/bans";

const log = logger.child({ module: "admin-chargebacks-notify" });

export const dynamic = "force-dynamic";

// POST { pledgeId } | { all: true } [, force: true]
//
// Email the backer(s) behind a chargeback that their account is suspended
// and their reward on hold. New disputes get this automatically from
// applyChargeback; this route covers disputes that landed before that and
// lets an admin resend. Auth: ADMIN/SUPER_ADMIN session, or
// `Authorization: Bearer $CRON_SECRET` from the server terminal.
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const hasBearer = !!cronSecret && authHeader === `Bearer ${cronSecret}`;
    if (!hasBearer) {
      const session = await auth();
      if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const admin = await db.user.findFirst({ where: { id: session.user.id, deletedAt: null }, select: { role: true } });
      if (admin?.role !== "ADMIN" && admin?.role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const body = await req.json().catch(() => ({}));
    const force = body.force === true;
    const pledgeIds: string[] = [];
    if (typeof body.pledgeId === "string" && body.pledgeId) {
      pledgeIds.push(body.pledgeId);
    } else if (body.all === true) {
      const rows = await db.pledge.findMany({
        where: { status: "CHARGEBACK", deletedAt: null },
        select: { id: true },
      });
      pledgeIds.push(...rows.map((r: { id: string }) => r.id));
    } else {
      return NextResponse.json({ error: "pledgeId or all:true is required" }, { status: 400 });
    }

    const results = [];
    for (const id of pledgeIds) {
      const r = await notifyBackerOfChargebackBan(id, { force }).catch((err: unknown) => ({
        sent: false,
        reason: formatError(err),
      }));
      results.push({ pledgeId: id, ...r });
    }
    const sent = results.filter((r) => r.sent).length;
    log.info({ sent, total: results.length }, "Chargeback backer notices");
    return NextResponse.json({ ok: true, sent, skipped: results.length - sent, results });
  } catch (error) {
    log.error({ err: formatError(error) }, "notify route failed");
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
}
