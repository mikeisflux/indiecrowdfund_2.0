import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { logger } from "@/lib/logger";

const creatorPaypalLogger = logger.child({ module: "creator-paypal" });

export const dynamic = "force-dynamic";

const schema = z.object({
  paypalEmail: z.string().email("Invalid PayPal email address"),
});

// GET - Fetch creator's PayPal payout config
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const config = await db.payPalPayoutConfig.findUnique({
      where: { userId: session.user.id },
      select: { paypalEmail: true, isVerified: true, verifiedAt: true, createdAt: true },
    });

    return NextResponse.json({ config });
  } catch (error) {
    creatorPaypalLogger.error({ err: String(error) }, "Failed to fetch PayPal config");
    return NextResponse.json({ error: "Failed to fetch PayPal config" }, { status: 500 });
  }
}

// POST - Save or update creator's PayPal payout email
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = schema.parse(body);

    const normalizedEmail = data.paypalEmail.toLowerCase().trim();

    // Atomic upsert on userId @unique — avoids findUnique→create TOCTOU.
    // Always set the email; reset verification unconditionally on update
    // (a no-op if email hasn't changed since isVerified was already false
    // from the prior reset, and the cost of the extra write is negligible).
    const config = await db.payPalPayoutConfig.upsert({
      where: { userId: session.user.id },
      update: {
        paypalEmail: normalizedEmail,
        isVerified: false,
        verifiedAt: null,
      },
      create: {
        userId: session.user.id,
        paypalEmail: normalizedEmail,
      },
      select: { paypalEmail: true, isVerified: true },
    });

    return NextResponse.json({ config, message: "PayPal email saved" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid data" }, { status: 400 });
    }
    creatorPaypalLogger.error({ err: String(error) }, "Failed to save PayPal config");
    return NextResponse.json({ error: "Failed to save PayPal config" }, { status: 500 });
  }
}
