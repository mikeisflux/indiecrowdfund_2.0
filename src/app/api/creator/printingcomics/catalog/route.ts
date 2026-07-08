import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { loadPrintingComicsConfig } from "@/lib/printingcomics/config";
import { pcFetch, PrintingComicsApiError } from "@/lib/printingcomics/client";

const log = logger.child({ module: "printingcomics-catalog" });

// Authenticated proxy to GET /catalog/products. Pass a `slug` query
// param to fetch a single product's full configurator + variants.
// Anything else is forwarded to the provider as a list query.
export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");
    if (slug) {
      try {
        const data = await pcFetch(config, {
          method: "GET",
          path: `/catalog/products/${encodeURIComponent(slug)}`,
        });
        return NextResponse.json(data);
      } catch (err) {
        if (err instanceof PrintingComicsApiError) {
          return NextResponse.json({ error: err.bodyText }, { status: err.status });
        }
        throw err;
      }
    }

    // List query: forward category, q, limit, cursor
    const params = new URLSearchParams();
    for (const k of ["category", "q", "limit", "cursor"]) {
      const v = searchParams.get(k);
      if (v) params.set(k, v);
    }
    const path = "/catalog/products" + (params.toString() ? "?" + params : "");
    try {
      const data = await pcFetch(config, { method: "GET", path });
      return NextResponse.json(data);
    } catch (err) {
      if (err instanceof PrintingComicsApiError) {
        return NextResponse.json({ error: err.bodyText }, { status: err.status });
      }
      throw err;
    }
  } catch (err) {
    log.error({ err: String(err) }, "catalog proxy failed");
    return NextResponse.json({ error: "Failed to load catalog" }, { status: 500 });
  }
}
