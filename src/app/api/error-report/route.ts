import { NextRequest, NextResponse } from "next/server";
import { captureClientError } from "@/lib/error-tracker";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";

const errorReportLogger = logger.child({ module: "error-report" });

const HEADLESS_UA =
  /Lightpanda|ShapBot|HeadlessChrome|PhantomJS|SlimerJS|Puppeteer|Playwright|Selenium|scrapy|python-requests|Go-http-client|curl\/|wget\/|Googlebot|bingbot|AhrefsBot|SemrushBot|PetalBot|YandexBot|DotBot|MJ12bot|DataForSeoBot|Bytespider|GPTBot|ClaudeBot|CCBot|facebookexternalhit/i;

// POST /api/error-report — Client-side error reporting endpoint
// Rate limited by the error tracker itself
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, stack, url, metadata } = body;

    if (!message) {
      return NextResponse.json({ error: "Missing message" }, { status: 400 });
    }

    const session = await auth();
    const userAgent = req.headers.get("user-agent") || undefined;

    // Headless scrapers run our bundle in half-implemented engines and
    // report their own parse failures ("Unhandled Promise Rejection:
    // failed to parse" from Lightpanda/ShapBot). Not our bug, not a user.
    if (userAgent && HEADLESS_UA.test(userAgent)) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    // Mirror to PM2 stdout so an operator can `pm2 logs` and grep for
    // recent client failures without round-tripping through ErrorLog.
    // The DB-backed capture below is the durable record; this is for
    // live triage.
    errorReportLogger.error(
      { message, url, userAgent, userId: session?.user?.id, metadata },
      "client-error-report"
    );

    await captureClientError(
      message,
      stack,
      url || "unknown",
      userAgent || "unknown",
      session?.user?.id,
      metadata
    );

    return NextResponse.json({ ok: true });
  } catch {
    // Never fail the client on error tracking errors
    return NextResponse.json({ ok: true });
  }
}
