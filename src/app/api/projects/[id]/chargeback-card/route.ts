import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const projectsChargebackCardLogger = logger.child({ module: "projects-chargeback-card" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { encrypt, decrypt, getLastDigits } from "@/lib/encryption";

export const dynamic = "force-dynamic";

// Helper to detect card brand from number
function detectCardBrand(cardNumber: string): string {
  const num = cardNumber.replace(/\s/g, "");
  if (/^4/.test(num)) return "Visa";
  if (/^5[1-5]/.test(num) || /^2[2-7]/.test(num)) return "Mastercard";
  if (/^3[47]/.test(num)) return "Amex";
  if (/^6(?:011|5)/.test(num)) return "Discover";
  return "Unknown";
}

// Luhn algorithm to validate card number
function isValidLuhn(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, "");
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

// GET - Check if project has a chargeback card on file
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = await params;

    // Check user is creator or admin
    const project = await db.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { creatorId: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
    if (project.creatorId !== session.user.id && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const card = await db.creatorChargebackCard.findUnique({
      where: { projectId },
      select: {
        id: true,
        cardLastFour: true,
        cardBrand: true,
        expMonth: true,
        expYear: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!card) {
      return NextResponse.json({ exists: false });
    }

    return NextResponse.json({
      exists: true,
      lastFour: card.cardLastFour,
      brand: card.cardBrand,
      expMonth: card.expMonth,
      expYear: card.expYear,
      updatedAt: card.updatedAt,
    });
  } catch (error) {
    projectsChargebackCardLogger.error({ err: String(error) }, "Error fetching chargeback card:");
    return NextResponse.json(
      { error: "Failed to fetch chargeback card" },
      { status: 500 }
    );
  }
}

// POST - Save or update chargeback card for project
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = await params;

    // Verify the user is the project creator
    const project = await db.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { creatorId: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.creatorId !== session.user.id) {
      return NextResponse.json(
        { error: "Only the project creator can set the chargeback card" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      cardNumber, expMonth, expYear, cvc,
      billingName, billingLine1, billingLine2,
      billingCity, billingState, billingZip, billingCountry,
    } = body;

    // Validation
    const cleanCardNumber = (cardNumber || "").replace(/\s|-/g, "");
    if (!cleanCardNumber || cleanCardNumber.length < 13 || cleanCardNumber.length > 19) {
      return NextResponse.json(
        { error: "Please enter a valid card number" },
        { status: 400 }
      );
    }

    if (!/^\d+$/.test(cleanCardNumber)) {
      return NextResponse.json(
        { error: "Card number must contain only digits" },
        { status: 400 }
      );
    }

    // Luhn check to validate card number format
    if (!isValidLuhn(cleanCardNumber)) {
      return NextResponse.json(
        { error: "Invalid card number" },
        { status: 400 }
      );
    }

    const expMonthNum = parseInt(expMonth);
    const expYearNum = parseInt(expYear);
    if (!expMonthNum || expMonthNum < 1 || expMonthNum > 12) {
      return NextResponse.json(
        { error: "Invalid expiration month" },
        { status: 400 }
      );
    }

    if (!expYearNum || expYearNum < new Date().getFullYear()) {
      return NextResponse.json(
        { error: "Card is expired" },
        { status: 400 }
      );
    }

    if (!cvc || cvc.length < 3 || cvc.length > 4) {
      return NextResponse.json(
        { error: "Invalid CVC code" },
        { status: 400 }
      );
    }

    if (!billingName || !billingLine1 || !billingCity || !billingState || !billingZip || !billingCountry) {
      return NextResponse.json(
        { error: "All billing address fields are required" },
        { status: 400 }
      );
    }

    // Encrypt all sensitive data
    const encryptedCardNumber = encrypt(cleanCardNumber);
    const encryptedExpMonth = encrypt(String(expMonthNum));
    const encryptedExpYear = encrypt(String(expYearNum));
    const encryptedCvc = encrypt(cvc);
    const encryptedBillingName = encrypt(billingName);
    const encryptedBillingLine1 = encrypt(billingLine1);
    const encryptedBillingLine2 = billingLine2 ? encrypt(billingLine2) : null;
    const encryptedBillingCity = encrypt(billingCity);
    const encryptedBillingState = encrypt(billingState);
    const encryptedBillingZip = encrypt(billingZip);
    const encryptedBillingCountry = encrypt(billingCountry);

    // Display data
    const lastFour = getLastDigits(cleanCardNumber, 4);
    const brand = detectCardBrand(cleanCardNumber);

    projectsChargebackCardLogger.info(`[Chargeback Card] Card saved for project ${projectId}: ${brand} ****${lastFour}`);

    // Upsert card for this project
    await db.creatorChargebackCard.upsert({
      where: { projectId },
      update: {
        cardNumberEncrypted: encryptedCardNumber,
        expMonthEncrypted: encryptedExpMonth,
        expYearEncrypted: encryptedExpYear,
        cvcEncrypted: encryptedCvc,
        billingNameEncrypted: encryptedBillingName,
        billingLine1Encrypted: encryptedBillingLine1,
        billingLine2Encrypted: encryptedBillingLine2,
        billingCityEncrypted: encryptedBillingCity,
        billingStateEncrypted: encryptedBillingState,
        billingZipEncrypted: encryptedBillingZip,
        billingCountryEncrypted: encryptedBillingCountry,
        cardLastFour: lastFour,
        cardBrand: brand,
        expMonth: expMonthNum,
        expYear: expYearNum,
      },
      create: {
        projectId,
        cardNumberEncrypted: encryptedCardNumber,
        expMonthEncrypted: encryptedExpMonth,
        expYearEncrypted: encryptedExpYear,
        cvcEncrypted: encryptedCvc,
        billingNameEncrypted: encryptedBillingName,
        billingLine1Encrypted: encryptedBillingLine1,
        billingLine2Encrypted: encryptedBillingLine2,
        billingCityEncrypted: encryptedBillingCity,
        billingStateEncrypted: encryptedBillingState,
        billingZipEncrypted: encryptedBillingZip,
        billingCountryEncrypted: encryptedBillingCountry,
        cardLastFour: lastFour,
        cardBrand: brand,
        expMonth: expMonthNum,
        expYear: expYearNum,
      },
    });

    return NextResponse.json({
      success: true,
      lastFour,
      brand,
      expMonth: expMonthNum,
      expYear: expYearNum,
    });
  } catch (error) {
    projectsChargebackCardLogger.error({ err: String(error) }, "Error saving chargeback card:");
    if (error instanceof Error && error.message.includes("BANK_ACCOUNT_ENCRYPTION_KEY")) {
      return NextResponse.json(
        { error: "Server configuration error: encryption key not set" },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: "Failed to save chargeback card" },
      { status: 500 }
    );
  }
}

// GET admin endpoint to retrieve full (decrypted) card details
// This is accessed by admins only through a separate admin API
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Admin only
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const { id: projectId } = await params;

    const card = await db.creatorChargebackCard.findUnique({
      where: { projectId },
    });

    if (!card) {
      return NextResponse.json({ error: "No chargeback card on file" }, { status: 404 });
    }

    // Decrypt for admin viewing
    return NextResponse.json({
      cardNumber: decrypt(card.cardNumberEncrypted),
      expMonth: decrypt(card.expMonthEncrypted),
      expYear: decrypt(card.expYearEncrypted),
      cvc: decrypt(card.cvcEncrypted),
      billingName: decrypt(card.billingNameEncrypted),
      billingLine1: decrypt(card.billingLine1Encrypted),
      billingLine2: card.billingLine2Encrypted ? decrypt(card.billingLine2Encrypted) : null,
      billingCity: decrypt(card.billingCityEncrypted),
      billingState: decrypt(card.billingStateEncrypted),
      billingZip: decrypt(card.billingZipEncrypted),
      billingCountry: decrypt(card.billingCountryEncrypted),
      lastFour: card.cardLastFour,
      brand: card.cardBrand,
    });
  } catch (error) {
    projectsChargebackCardLogger.error({ err: String(error) }, "Error fetching decrypted card:");
    return NextResponse.json(
      { error: "Failed to retrieve card details" },
      { status: 500 }
    );
  }
}
