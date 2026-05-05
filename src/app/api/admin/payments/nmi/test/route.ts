import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { loadNmiConfig, pingNmi } from "@/lib/nmi";

const log = logger.child({ module: "admin-nmi-test" });

// Smoke-test the saved PaymentCloud (NMI) credentials. Hits the
// gateway with an empty customer_vault add_customer call — no real
// card data, no vault entries created. Distinguishes "your security
// key works" (gateway responded with a structured error about missing
// card data) from "your security key is wrong" (gateway responded
// with an authentication error).
//
// Useful in admin/settings → Payments → PaymentCloud Configuration
// to catch typos before a real pledge tries and fails.
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const me = await db.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
      select: { role: true },
    });
    if (me?.role !== "ADMIN" && me?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const config = await loadNmiConfig();
    if (!config) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Mentom Payments is disabled or no security key is saved. Save a key first, then test.",
        },
        { status: 200 }
      );
    }

    const result = await pingNmi(config);
    return NextResponse.json({
      ok: result.ok,
      message: result.message,
      gatewayUrl: result.gatewayUrl,
      hasPublicKey: !!config.publicKey,
      hasWebhookSecret: !!config.webhookSecret,
      environment: config.environment,
    });
  } catch (err) {
    log.error({ err: String(err) }, "test endpoint error");
    return NextResponse.json(
      { ok: false, message: "Internal error during connection test" },
      { status: 500 }
    );
  }
}
