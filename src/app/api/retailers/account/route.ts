import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateRetailerRequest } from "@/lib/retailer-auth";

export const dynamic = "force-dynamic";

// GET - Get retailer account details
export async function GET() {
  try {
    const authResult = await authenticateRetailerRequest();

    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error || "Unauthorized" },
        { status: 401 }
      );
    }

    // Super admins get a preview account
    if (authResult.isSuperAdmin) {
      return NextResponse.json({
        account: {
          id: "admin-preview",
          businessName: "Admin Preview",
          businessType: "ADMIN",
          contactName: "Super Admin",
          email: "admin@preview.com",
          phone: "",
          address: "",
          city: "",
          state: "",
          zipCode: "",
          country: "",
          website: "",
          taxId: "",
          description: "",
          status: "APPROVED",
          createdAt: new Date().toISOString(),
          verifiedAt: new Date().toISOString(),
          isAdminPreview: true,
        },
      });
    }

    const retailer = await db.retailer.findUnique({
      where: { id: authResult.retailerId },
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
    const authResult = await authenticateRetailerRequest();

    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error || "Unauthorized" },
        { status: 401 }
      );
    }

    // Super admins cannot update in preview mode
    if (authResult.isSuperAdmin) {
      return NextResponse.json(
        { error: "Cannot update account in preview mode" },
        { status: 403 }
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

    // Get current retailer to check email
    const currentRetailer = await db.retailer.findUnique({
      where: { id: authResult.retailerId },
      select: { email: true },
    });

    // Validate email if provided
    if (email && currentRetailer && email !== currentRetailer.email) {
      const existingRetailer = await db.retailer.findFirst({
        where: {
          email,
          NOT: { id: authResult.retailerId },
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
      where: { id: authResult.retailerId },
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
