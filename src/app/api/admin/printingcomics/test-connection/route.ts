import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { loadPrintingComicsConfig } from "@/lib/printingcomics/config";
import { whoami, PrintingComicsApiError } from "@/lib/printingcomics/client";

const log = logger.child({ module: "printingcomics-test" });

// SUPER_ADMIN-only endpoint that hits Printing Comics' GET /me with
// the currently-saved credentials and returns the granted scopes.
// Wired to a "Test connection" button on the admin Fulfillment tab so
// admins can verify a freshly-pasted key before the integration goes
// live.
export async function POST() {
  try {
    const session = await auth();
    if (session?.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const config = await loadPrintingComicsConfig();
    if (!config) {
      return NextResponse.json(
        { ok: false, error: "Printing Comics is not configured. Save the API key first." },
        { status: 400 }
      );
    }

    try {
      const me = await whoami(config);
      return NextResponse.json({
        ok: true,
        environment: config.environment,
        name: typeof me.name === "string" ? me.name : null,
        scopes: Array.isArray(me.scopes) ? me.scopes : [],
        // Pass through any extra fields the provider returns; the
        // admin UI just shows scopes + name today but we want the
        // raw response visible if they enable inspect mode.
        raw: me,
      });
    } catch (err) {
      if (err instanceof PrintingComicsApiError) {
        return NextResponse.json(
          {
            ok: false,
            status: err.status,
            error:
              err.status === 401
                ? "Key was rejected (401). Double-check it was pasted in full and hasn't been revoked."
                : err.status === 403
                ? "Key is missing required scopes. Contact developers@printingcomics.com to grant catalog:read + orders:write + uploads:write."
                : `Printing Comics returned ${err.status}: ${err.bodyText.slice(0, 200)}`,
          },
          { status: 200 }
        );
      }
      log.error({ err: String(err) }, "Printing Comics test-connection failed");
      return NextResponse.json(
        { ok: false, error: "Network error reaching Printing Comics." },
        { status: 200 }
      );
    }
  } catch (err) {
    log.error({ err: String(err) }, "test-connection handler error");
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
