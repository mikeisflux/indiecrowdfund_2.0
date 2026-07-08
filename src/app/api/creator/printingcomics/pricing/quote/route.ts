import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { loadPrintingComicsConfig } from "@/lib/printingcomics/config";
import { quotePricing, PrintingComicsApiError, type PCQuoteInput } from "@/lib/printingcomics/client";

const log = logger.child({ module: "printingcomics-pricing-quote" });

// Authenticated proxy to POST /pricing/quote. Returns the same per-line
// breakdown + shipping options + tax + total the storefront uses, so
// the dashboard can preview the exact cost before the creator submits.
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const config = await loadPrintingComicsConfig();
    if (!config) {
      return NextResponse.json(
        { error: "Printing Comics is not configured. Ask an admin to add the API key." },
        { status: 502 }
      );
    }

    let body: PCQuoteInput;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { error: "items array with at least one entry is required" },
        { status: 400 }
      );
    }

    try {
      const data = await quotePricing(config, body);
      return NextResponse.json(data);
    } catch (err) {
      if (err instanceof PrintingComicsApiError) {
        return NextResponse.json(
          { error: err.bodyText, status: err.status },
          { status: err.status >= 400 && err.status < 500 ? err.status : 502 }
        );
      }
      throw err;
    }
  } catch (err) {
    log.error({ err: String(err) }, "pricing quote proxy failed");
    return NextResponse.json({ error: "Failed to get pricing quote" }, { status: 500 });
  }
}
