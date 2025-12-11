import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

export const dynamic = "force-dynamic";

const JWT_SECRET = new TextEncoder().encode(
  process.env.RETAILER_JWT_SECRET || "retailer-secret-key-change-in-production"
);

// Helper to verify retailer authentication
async function verifyRetailer() {
  const cookieStore = await cookies();
  const token = cookieStore.get("retailer_token")?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { retailerId: string; email: string };
  } catch {
    return null;
  }
}

// GET - Get retailer account details
export async function GET() {
  try {
    const retailerData = await verifyRetailer();

    if (!retailerData) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const retailer = await db.retailer.findUnique({
      where: { id: retailerData.retailerId },
      select: {
        id: true,
        businessName: true,
        businessType: true,
        contactName: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        country: true,
        websiteUrl: true,
        taxId: true,
        status: true,
        verifiedAt: true,
        createdAt: true,
      },
    });

    if (!retailer) {
      return NextResponse.json(
        { error: "Retailer not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      account: {
        id: retailer.id,
        businessName: retailer.businessName,
        businessType: retailer.businessType,
        contactName: retailer.contactName,
        email: retailer.email,
        phone: retailer.phone || "",
        address: retailer.address || "",
        city: retailer.city || "",
        state: retailer.state || "",
        zipCode: retailer.zipCode || "",
        country: retailer.country || "",
        website: retailer.websiteUrl || "",
        taxId: retailer.taxId || "",
        description: "",
        status: retailer.status,
        createdAt: retailer.createdAt.toISOString(),
        verifiedAt: retailer.verifiedAt?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error("Error fetching retailer account:", error);
    return NextResponse.json(
      { error: "Failed to fetch account" },
      { status: 500 }
    );
  }
}

// PATCH - Update retailer account details
export async function PATCH(req: NextRequest) {
  try {
    const retailerData = await verifyRetailer();

    if (!retailerData) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      businessName,
      contactName,
      email,
      phone,
      address,
      city,
      state,
      zipCode,
      country,
      website,
      taxId,
    } = body;

    // Validate email if provided
    if (email && email !== retailerData.email) {
      const existingRetailer = await db.retailer.findFirst({
        where: {
          email,
          NOT: { id: retailerData.retailerId },
        },
      });

      if (existingRetailer) {
        return NextResponse.json(
          { error: "Email is already in use by another retailer" },
          { status: 400 }
        );
      }
    }

    const updatedRetailer = await db.retailer.update({
      where: { id: retailerData.retailerId },
      data: {
        businessName: businessName || undefined,
        contactName: contactName || undefined,
        email: email || undefined,
        phone: phone || undefined,
        address: address || undefined,
        city: city || undefined,
        state: state || undefined,
        zipCode: zipCode || undefined,
        country: country || undefined,
        websiteUrl: website || undefined,
        taxId: taxId || undefined,
      },
      select: {
        id: true,
        businessName: true,
        businessType: true,
        contactName: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        country: true,
        websiteUrl: true,
        taxId: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      account: {
        id: updatedRetailer.id,
        businessName: updatedRetailer.businessName,
        businessType: updatedRetailer.businessType,
        contactName: updatedRetailer.contactName,
        email: updatedRetailer.email,
        phone: updatedRetailer.phone || "",
        address: updatedRetailer.address || "",
        city: updatedRetailer.city || "",
        state: updatedRetailer.state || "",
        zipCode: updatedRetailer.zipCode || "",
        country: updatedRetailer.country || "",
        website: updatedRetailer.websiteUrl || "",
        taxId: updatedRetailer.taxId || "",
        description: "",
        status: updatedRetailer.status,
        createdAt: updatedRetailer.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error updating retailer account:", error);
    return NextResponse.json(
      { error: "Failed to update account" },
      { status: 500 }
    );
  }
}
