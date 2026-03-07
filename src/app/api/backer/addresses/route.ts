import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const backerAddressesLogger = logger.child({ module: "backer-addresses" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET: List all saved addresses for the user
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const addresses = await db.userAddress.findMany({
      where: { userId: session.user.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ addresses }, { headers: corsHeaders });
  } catch (error) {
    backerAddressesLogger.error({ err: String(error) }, "Error fetching addresses:");
    return NextResponse.json(
      { error: "Failed to fetch addresses" },
      { status: 500, headers: corsHeaders }
    );
  }
}

// POST: Create a new address
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const body = await request.json();
    const { label, fullName, line1, line2, city, state, postalCode, country, phone, isDefault } = body;

    if (!fullName || !line1 || !city || !state || !postalCode || !country) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400, headers: corsHeaders }
      );
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await db.userAddress.updateMany({
        where: { userId: session.user.id, isDefault: true },
        data: { isDefault: false },
      });
    }

    const address = await db.userAddress.create({
      data: {
        userId: session.user.id,
        label: label || "Home",
        fullName,
        line1,
        line2: line2 || null,
        city,
        state,
        postalCode,
        country,
        phone: phone || null,
        isDefault: isDefault || false,
      },
    });

    return NextResponse.json({ address }, { headers: corsHeaders });
  } catch (error) {
    backerAddressesLogger.error({ err: String(error) }, "Error creating address:");
    return NextResponse.json(
      { error: "Failed to create address" },
      { status: 500, headers: corsHeaders }
    );
  }
}
