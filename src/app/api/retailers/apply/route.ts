import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const retailersApplyLogger = logger.child({ module: "retailers-apply" });
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
      email: rawEmail,
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

    // Normalize email to lowercase to ensure consistent lookup across login/forgot-password
    const email = typeof rawEmail === "string" ? rawEmail.toLowerCase().trim() : rawEmail;

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

    // Hash password if provided (cap length to prevent bcrypt DoS)
    let passwordHash = null;
    if (password) {
      if (typeof password !== "string" || password.length > 1000) {
        return NextResponse.json({ error: "Password must be 1000 characters or less" }, { status: 400 });
      }
      passwordHash = await hash(password, 12);
    }

    // Create retailer application. Catch P2002 on the email @unique
    // constraint so a double-submitted form returns a clean 409
    // instead of a 500 — the findUnique check above is TOCTOU.
    let retailer;
    try {
      retailer = await db.retailer.create({
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
    } catch (createErr) {
      const isUniqueViolation =
        createErr &&
        typeof createErr === "object" &&
        "code" in createErr &&
        (createErr as { code?: string }).code === "P2002";
      if (isUniqueViolation) {
        return NextResponse.json(
          { error: "A retailer with this email already exists" },
          { status: 409 }
        );
      }
      throw createErr;
    }

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
    retailersApplyLogger.error({ err: formatError(error) }, "Error submitting retailer application:");
    return NextResponse.json(
      { error: "Failed to submit application" },
      { status: 500 }
    );
  }
}
