import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadNmiConfig } from "@/lib/nmi";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "nmi-public-key" });

export const dynamic = "force-dynamic";

// Return the PaymentCloud (NMI) public tokenization key for Collect.js.
// This is the *public* key by name and design — it goes in the script
// tag's `data-tokenization-key` attribute, which means it ends up in
// HTML payloads served to logged-out users on backer pledge pages. We
// gate this route to authenticated users only as a small extra step
// that doesn't change the security posture but cuts down on key
// scraping by random crawlers.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const config = await loadNmiConfig();
    if (!config?.publicKey) {
      return NextResponse.json(
        { error: "PaymentCloud not configured" },
        { status: 404 }
      );
    }
    return NextResponse.json({ publicKey: config.publicKey });
  } catch (err) {
    log.error({ err: String(err) }, "public-key fetch error");
    return NextResponse.json({ error: "Failed to load public key" }, { status: 500 });
  }
}
