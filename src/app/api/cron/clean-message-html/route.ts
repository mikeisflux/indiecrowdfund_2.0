import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { htmlToPlainText, looksLikeHtml } from "@/lib/email/email-to-text";

const log = logger.child({ module: "cron-clean-message-html" });

/**
 * One-time maintenance: strip HTML out of Message rows that were ingested
 * before the inbound-email converter existed.
 *
 * The old ingestion stored either the raw "plain" part (sometimes secretly
 * HTML) or a bare tag-strip that kept <style> contents — so creator inboxes
 * hold messages that read as stylesheets. New mail is clean at the source
 * (see /api/webhooks/email/inbound); this endpoint repairs what is already
 * stored, in place, preserving the "From: ..." header line the ingestion
 * prepends for external senders.
 *
 * Lives under /api/cron for the auth model, not for scheduling: Bearer
 * CRON_SECRET, CSRF-exempt, so it can be driven by a one-shot curl from the
 * server. It is idempotent — cleaned content no longer matches the
 * candidate filter — and safe to re-run.
 *
 * POST body: { "dryRun": true|false (default true), "limit": n (default 200) }
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let dryRun = true;
  let limit = 200;
  try {
    const body = await req.json();
    if (typeof body.dryRun === "boolean") dryRun = body.dryRun;
    if (Number.isFinite(Number(body.limit))) limit = Math.min(Math.max(Number(body.limit), 1), 2000);
  } catch {
    // No body: defaults (dry run) apply.
  }

  // Cheap DB-side prefilter; looksLikeHtml makes the real call per row.
  const candidates = await db.message.findMany({
    where: {
      OR: [
        { content: { contains: "<style" } },
        { content: { contains: "</div>" } },
        { content: { contains: "</p>" } },
        { content: { contains: "</span>" } },
        { content: { contains: "</table>" } },
        { content: { contains: "<br" } },
        { content: { contains: "&nbsp;" } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, subject: true, content: true },
  });

  let changed = 0;
  const samples: { id: string; subject: string | null }[] = [];

  for (const msg of candidates) {
    // The ingestion prepends "From: Name <addr>" for external senders. That
    // line's angle brackets are not markup and must survive the clean.
    const headerMatch = msg.content.match(/^(From: [^\n]+\n\n)([\s\S]*)$/);
    const header = headerMatch ? headerMatch[1] : "";
    const body = headerMatch ? headerMatch[2] : msg.content;

    if (!looksLikeHtml(body)) continue;

    const cleaned = header + htmlToPlainText(body);
    if (cleaned === msg.content) continue;

    if (!dryRun) {
      await db.message.update({
        where: { id: msg.id },
        data: { content: cleaned },
      });
    }
    changed++;
    if (samples.length < 5) samples.push({ id: msg.id, subject: msg.subject });
  }

  log.info({ dryRun, scanned: candidates.length, changed }, "Message HTML cleanup pass");

  return NextResponse.json({
    dryRun,
    scanned: candidates.length,
    changed,
    samples,
    note:
      changed === candidates.length && candidates.length === limit
        ? "Batch was full — run again to continue."
        : "Done for this batch.",
  });
}
