import { NextResponse } from "next/server";
import fs from "fs/promises";
import { existsSync } from "fs";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { requireSuperAdmin, PDF_FILENAME, PDF_PATH } from "@/lib/copyright-capture";

const log = logger.child({ module: "admin-copyright-download" });

export const dynamic = "force-dynamic";

// GET — stream the assembled PDF back as a download.
export async function GET() {
  try {
    const gate = await requireSuperAdmin();
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    if (!existsSync(PDF_PATH)) {
      return NextResponse.json(
        { error: "No PDF has been generated yet. Run a capture first." },
        { status: 404 }
      );
    }

    const data = await fs.readFile(PDF_PATH);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${PDF_FILENAME}"`,
        "Content-Length": String(data.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    log.error({ err: formatError(error) }, "Failed to download copyright PDF");
    return NextResponse.json({ error: "Failed to download PDF" }, { status: 500 });
  }
}
