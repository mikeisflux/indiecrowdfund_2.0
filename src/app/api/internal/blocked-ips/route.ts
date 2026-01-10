/**
 * Internal API for bot blocker persistence
 * Called by middleware to persist/retrieve blocked IPs
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET - Retrieve all currently blocked IPs
export async function GET() {
  try {
    const now = new Date();
    const blockedIPs = await db.blockedIP.findMany({
      where: { expiresAt: { gt: now } },
      select: { ipAddress: true, expiresAt: true },
    });

    return NextResponse.json({
      blocked: blockedIPs.map((ip: { ipAddress: string; expiresAt: Date }) => ({
        ip: ip.ipAddress,
        expiresAt: ip.expiresAt.getTime(),
      })),
    });
  } catch (error) {
    console.error("[Bot Blocker API] Error fetching blocked IPs:", error);
    return NextResponse.json({ blocked: [] });
  }
}

// POST - Record suspicious activity and potentially block IP
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { ip, reason, actionId, path, userAgent, block } = body;

    if (!ip) {
      return NextResponse.json({ error: "IP required" }, { status: 400 });
    }

    // Log suspicious activity
    await db.suspiciousActivity.create({
      data: {
        ipAddress: ip,
        reason: reason || "Unknown",
        actionId,
        path,
        userAgent,
      },
    });

    // If block flag is set, add to blocked IPs
    if (block) {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await db.blockedIP.upsert({
        where: { ipAddress: ip },
        create: {
          ipAddress: ip,
          reason: reason || "Bot detected",
          expiresAt,
          lastUserAgent: userAgent,
          lastPath: path,
          lastActionId: actionId,
        },
        update: {
          reason: reason || "Bot detected",
          expiresAt,
          violationCount: { increment: 1 },
          lastUserAgent: userAgent,
          lastPath: path,
          lastActionId: actionId,
        },
      });

      console.log(`[Bot Blocker API] IP blocked: ${ip} - ${reason}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Bot Blocker API] Error:", error);
    return NextResponse.json({ error: "Failed to process" }, { status: 500 });
  }
}
