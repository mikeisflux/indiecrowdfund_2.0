import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db";

const cronCleanupChatLogger = logger.child({ module: "cron-cleanup-chat" });

export const dynamic = "force-dynamic";

const RETENTION_DAYS = 180;

function verifyCronAuth(req: NextRequest): boolean {
  const vercelCronSecret = process.env.CRON_SECRET;
  if (vercelCronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader === `Bearer ${vercelCronSecret}`) return true;
  }
  const adminApiKey = process.env.ADMIN_API_KEY;
  if (adminApiKey) {
    const authHeader = req.headers.get("authorization");
    if (authHeader === `Bearer ${adminApiKey}`) return true;
  }
  return false;
}

export async function POST(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let dryRun = false;
  try {
    const body = await req.json();
    if (body.dryRun !== undefined) dryRun = !!body.dryRun;
  } catch {
    // No body — use defaults.
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  if (dryRun) {
    const count = await db.chatMessage.count({
      where: { createdAt: { lt: cutoff } },
    });
    cronCleanupChatLogger.info(
      `[Cron] Dry run: would prune ${count} chat messages older than ${RETENTION_DAYS} days`
    );
    return NextResponse.json({ success: true, dryRun: true, count });
  }

  const deleted = await db.chatMessage.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  cronCleanupChatLogger.info(
    `[Cron] Pruned ${deleted.count} chat messages older than ${RETENTION_DAYS} days`
  );

  return NextResponse.json({
    success: true,
    count: deleted.count,
    retentionDays: RETENTION_DAYS,
  });
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const expiredCount = await db.chatMessage.count({
    where: { createdAt: { lt: cutoff } },
  });
  return NextResponse.json({
    status: "ok",
    retentionDays: RETENTION_DAYS,
    expiredCount,
  });
}
