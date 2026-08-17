import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";
import { wrapInEmailShell, looksLikeFullEmail } from "@/lib/ai/campaign-email-template";

const formatEmailLogger = logger.child({ module: "ai-marketing-format-email" });

/**
 * POST /api/admin/ai-marketing/format-email
 *
 * Wraps hand-written campaign content in the same branded shell the AI
 * campaigns use. The template lives server-side and is shared with the AI
 * renderers, so the two cannot drift into looking different.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (session?.user?.role !== "SUPER_ADMIN" && session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { html, subject, preheader } = await req.json();

    if (typeof html !== "string" || !html.trim()) {
      return NextResponse.json(
        { error: "There's nothing in the editor to format yet." },
        { status: 400 }
      );
    }

    // Formatting something already wrapped would nest a full document inside
    // a table cell — two <html> elements, two headers, two footers. Refuse and
    // say so rather than quietly producing that.
    if (looksLikeFullEmail(html)) {
      return NextResponse.json(
        {
          error:
            "This content is already a formatted email. Formatting it again would put a second header and footer inside the first.",
          alreadyFormatted: true,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      html: wrapInEmailShell(html, {
        subject: typeof subject === "string" ? subject : "",
        preheader: typeof preheader === "string" ? preheader : "",
      }),
    });
  } catch (error) {
    formatEmailLogger.error({ err: formatError(error) }, "Failed to format email");
    return NextResponse.json({ error: "Failed to format email" }, { status: 500 });
  }
}
