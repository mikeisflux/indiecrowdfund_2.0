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

    const existing = await db.payPalPayoutConfig.findUnique({
      where: { userId: session.user.id },
    });

    if (existing) {
      const updated = await db.payPalPayoutConfig.update({
        where: { userId: session.user.id },
        data: {
          paypalEmail: data.paypalEmail.toLowerCase().trim(),
          // Reset verification if email changed
          ...(existing.paypalEmail !== data.paypalEmail.toLowerCase().trim()
            ? { isVerified: false, verifiedAt: null }
            : {}),
        },
        select: { paypalEmail: true, isVerified: true },
      });
      return NextResponse.json({ config: updated, message: "PayPal email updated" });
    }

    const created = await db.payPalPayoutConfig.create({
      data: {
        userId: session.user.id,
        paypalEmail: data.paypalEmail.toLowerCase().trim(),
      },
      select: { paypalEmail: true, isVerified: true },
    });

    return NextResponse.json({ config: created, message: "PayPal email saved" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid data" }, { status: 400 });
    }
    creatorPaypalLogger.error({ err: String(error) }, "Failed to save PayPal config");
    return NextResponse.json({ error: "Failed to save PayPal config" }, { status: 500 });
  }
}
