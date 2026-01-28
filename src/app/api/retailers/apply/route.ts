import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hash } from "bcryptjs";
import { verifyRecaptcha } from "@/lib/auth/recaptcha";

/**
 * Get client IP from request headers
 */
function getClientIP(req: NextRequest): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    null
  );
}

// POST - Submit retailer application
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Verify reCAPTCHA
    const clientIP = getClientIP(req);
    const recaptchaResult = await verifyRecaptcha(body.recaptchaToken, clientIP);
    if (!recaptchaResult.valid) {
      return NextResponse.json(
        { error: recaptchaResult.error || "CAPTCHA verification failed" },
        { status: 400 }
      );
    }

    const {
      businessName,
      businessType,
      yearsInBusiness,
      numberOfLocations,
      annualRevenue,
      websiteUrl,
      contactName,
      email,
      phone,
      preferredContact,
      address,
      city,
      state,
      zipCode,
      country,
      taxIdType,
      taxId,
      resaleCertificate,
      password,
    } = body;

    // Validate required fields
    const requiredFields = [
      "businessName",
      "businessType",
      "contactName",
      "email",
      "phone",
      "address",
      "city",
      "state",
      "zipCode",
      "taxIdType",
      "taxId",
    ];

    const missingFields = requiredFields.filter((field) => !body[field]);
    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(", ")}` },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingRetailer = await db.retailer.findUnique({
      where: { email },
    });

    if (existingRetailer) {
      return NextResponse.json(
        { error: "A retailer with this email already exists" },
        { status: 400 }
      );
    }

    // Hash password if provided
    let passwordHash = null;
    if (password) {
      passwordHash = await hash(password, 12);
    }

    // Create retailer application
    const retailer = await db.retailer.create({
      data: {
        businessName,
        businessType,
        contactName,
        email,
        phone,
        address,
        city,
        state,
        zipCode,
        country: country || "US",
        taxId,
        taxIdType,
        resaleCertificate,
        yearsInBusiness: yearsInBusiness ? parseInt(yearsInBusiness) : null,
        numberOfLocations: numberOfLocations ? parseInt(numberOfLocations) : 1,
        annualRevenue,
        websiteUrl,
        socialMedia: preferredContact ? ({ preferredContact } as object) : undefined,
        status: "PENDING",
        passwordHash,
      },
    });

    // In production: Send confirmation email
    // await sendRetailerApplicationEmail({
    //   to: email,
    //   businessName,
    //   contactName,
    // });

    // In production: Notify admin of new application
    // await notifyAdminOfRetailerApplication(retailer.id);

    return NextResponse.json({
      success: true,
      message: "Your application has been submitted successfully",
      applicationId: retailer.id,
    });
  } catch (error) {
    console.error("Error submitting retailer application:", error);
    return NextResponse.json(
      { error: "Failed to submit application" },
      { status: 500 }
    );
  }
}
