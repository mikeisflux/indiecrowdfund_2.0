import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db";
import { formatError } from "@/lib/errors";

const dcReportLogger = logger.child({ module: "dc-chargeback-ban-blocked" });

export const dynamic = "force-dynamic";

// POST /api/divinitycoin/chargeback-ban-blocked
//
// DivinityCoin posts here every time their prefilter blocks a charge
// because it matched one of the ban signals we exposed at
// /api/divinitycoin/chargeback-ban-signals. This is our audit trail
// and our trigger to pre-emptively lock the would-be new account on
// our side, so the attacker can't even browse around as a logged-in
// user.
//
// Spec: docs/divinitycoin-chargeback-ban-prefilter-spec.md sec 3.3
//
// Auth: Bearer DIVINITYCOIN_REPORT_TOKEN

interface BlockedReportBody {
  blocked_at?: string;
  attempted_amount_cents?: number;
  attempted_currency?: string;
  matched_signals?: string[];
  source_user_ids?: string[];
  attempted_email?: string;
  attempted_ip?: string;
  attempted_card_last4?: string;
  attempted_card_brand?: string;
  attempted_billing_postal_code?: string;
}

export async function POST(req: NextRequest) {
  const expected = process.env.DIVINITYCOIN_REPORT_TOKEN;
  if (!expected) {
    dcReportLogger.error("DIVINITYCOIN_REPORT_TOKEN not configured -- refusing report");
    return NextResponse.json({ error: "Endpoint not configured" }, { status: 503 });
  }
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${expected}`) {
    dcReportLogger.warn({ ip: req.headers.get("x-forwarded-for") }, "Invalid bearer on blocked-report");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: BlockedReportBody;
  try {
    body = (await req.json()) as BlockedReportBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Log every report to PM2 + ErrorLog so operations can grep for
  // "dc-chargeback-ban-blocked" and see the rolling history.
  dcReportLogger.info(
    {
      blockedAt: body.blocked_at,
      amountCents: body.attempted_amount_cents,
      currency: body.attempted_currency,
      matchedSignals: body.matched_signals,
      sourceBanIds: body.source_user_ids,
      attemptedEmail: body.attempted_email,
      attemptedIp: body.attempted_ip,
      cardLast4: body.attempted_card_last4,
      cardBrand: body.attempted_card_brand,
      billingPostal: body.attempted_billing_postal_code,
    },
    "DC prefilter blocked a charge"
  );

  // If the attempted email maps to an existing IndieCrowdfund account
  // that isn't already locked, lock it now. The attacker tried to
  // create a new pledge under it, so we know it's an evasion attempt.
  if (body.attempted_email) {
    try {
      const target = await db.user.findFirst({
        where: {
          email: { equals: body.attempted_email, mode: "insensitive" },
          bannedAt: null,
          deletedAt: null,
          accountDeletedAt: null,
        },
        select: { id: true, lastKnownIP: true },
      });
      if (target) {
        const reason = `Auto-banned: DC pre-charge prefilter blocked a charge linked to chargeback source bans (${(body.source_user_ids ?? []).join(",")}); matched signals: ${(body.matched_signals ?? []).join(",")}`;
        await db.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: target.id },
            data: {
              lockedAt: new Date(),
              lockedReason: reason,
              bannedAt: new Date(),
              bannedReason: reason,
            },
          });
          await tx.session.deleteMany({ where: { userId: target.id } });
          const ip = target.lastKnownIP || body.attempted_ip;
          if (ip) {
            await tx.iPBlocklist.upsert({
              where: { ipAddress: ip },
              update: {},
              create: {
                ipAddress: ip,
                userId: target.id,
                reason: `DC prefilter blocked charge from this IP (source bans: ${(body.source_user_ids ?? []).join(",")})`,
              },
            });
          }
        });
        dcReportLogger.info({ lockedUserId: target.id }, "Locked matched account post-block");
      } else if (body.attempted_ip) {
        // Email didn't match an existing user, but the IP is still
        // worth blocklisting in case they sign up again later.
        await db.iPBlocklist.upsert({
          where: { ipAddress: body.attempted_ip },
          update: {},
          create: {
            ipAddress: body.attempted_ip,
            reason: `DC prefilter blocked charge from this IP (source bans: ${(body.source_user_ids ?? []).join(",")})`,
          },
        });
      }
    } catch (err) {
      dcReportLogger.error({ err: formatError(err) }, "Failed to apply propagated lock from DC block report");
    }
  }

  return NextResponse.json({ ok: true });
}
