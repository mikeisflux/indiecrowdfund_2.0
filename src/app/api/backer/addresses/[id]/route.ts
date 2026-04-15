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

// PATCH: Update an address
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const { id } = await params;
    const body = await request.json();

    // Verify ownership
    const existing = await db.userAddress.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Address not found" }, { status: 404, headers: corsHeaders });
    }

    // Unset other defaults and update this address inside a single
    // transaction so two concurrent "set as default" requests can't
    // leave the user with multiple isDefault rows.
    const address = await db.$transaction(async (tx) => {
      if (body.isDefault && !existing.isDefault) {
        await tx.userAddress.updateMany({
          where: { userId: session.user.id, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.userAddress.update({
        where: { id },
        data: {
          label: body.label,
          fullName: body.fullName,
          line1: body.line1,
          line2: body.line2,
          city: body.city,
          state: body.state,
          postalCode: body.postalCode,
          country: body.country,
          phone: body.phone,
          isDefault: body.isDefault,
        },
      });
    });

    return NextResponse.json({ address }, { headers: corsHeaders });
  } catch (error) {
    backerAddressesLogger.error({ err: String(error) }, "Error updating address:");
    return NextResponse.json(
      { error: "Failed to update address" },
      { status: 500, headers: corsHeaders }
    );
  }
}

// DELETE: Delete an address
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const { id } = await params;

    // Verify ownership
    const existing = await db.userAddress.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Address not found" }, { status: 404, headers: corsHeaders });
    }

    await db.userAddress.delete({
      where: { id },
    });

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    backerAddressesLogger.error({ err: String(error) }, "Error deleting address:");
    return NextResponse.json(
      { error: "Failed to delete address" },
      { status: 500, headers: corsHeaders }
    );
  }
}
