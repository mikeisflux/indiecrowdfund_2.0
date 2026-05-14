import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const creatorPayPalBankAccountLogger = logger.child({ module: "creator-paypal-bank-account" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { encrypt, getLastDigits } from "@/lib/encryption";
import {
  SUPPORTED_BANK_COUNTRIES,
  sanitizeBankField,
  validateBankFields,
  type BankCountry,
} from "@/lib/bank-countries";

// GET - Check if user has a PayPal bank account configured
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bankAccount = await db.payPalBankAccount.findUnique({
      where: { userId: session.user.id },
      select: {
        id: true,
        bankNameDisplay: true,
        accountLastFour: true,
        accountType: true,
        bankCountry: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!bankAccount) {
      return NextResponse.json({ exists: false });
    }

    return NextResponse.json({
      exists: true,
      bankName: bankAccount.bankNameDisplay,
      lastFour: bankAccount.accountLastFour,
      accountType: bankAccount.accountType,
      bankCountry: bankAccount.bankCountry,
      isVerified: bankAccount.isVerified,
    });
  } catch (error) {
    creatorPayPalBankAccountLogger.error({ err: String(error) }, "Error fetching PayPal bank account:");
    return NextResponse.json(
      { error: "Failed to fetch bank account" },
      { status: 500 }
    );
  }
}

// POST - Create or update PayPal bank account
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { bankName, accountHolder, accountNumber, routingNumber, accountType, bankCountry, payoutPhone } = body;

    // Default to US for backwards compatibility — every account that
    // pre-dates international support is a US ACH account. New form
    // submits include this explicitly.
    const countryRaw = String(bankCountry || "US").toUpperCase();
    if (!SUPPORTED_BANK_COUNTRIES.has(countryRaw)) {
      return NextResponse.json(
        { error: "Unsupported bank country. Currently supported: US, GB (UK), IT (Italy)." },
        { status: 400 }
      );
    }
    const country = countryRaw as BankCountry;

    if (!bankName || !accountHolder || !accountNumber || !routingNumber) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    // Sanitize per country (US/UK digits-only; IT BIC + IBAN are
    // alphanumeric, uppercased, separators stripped) then run the shared
    // country-specific format validation.
    const routingValue = sanitizeBankField(country, String(routingNumber));
    const accountValue = sanitizeBankField(country, String(accountNumber));
    const validationError = validateBankFields(country, {
      routingNumber: routingValue,
      accountNumber: accountValue,
      payoutPhone,
    });
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const encryptedBankName = encrypt(bankName);
    const encryptedAccountHolder = encrypt(accountHolder);
    const encryptedAccountNumber = encrypt(accountValue);
    const encryptedRoutingNumber = encrypt(routingValue);
    const encryptedPayoutPhone = payoutPhone ? encrypt(String(payoutPhone).trim()) : null;
    const lastFour = getLastDigits(accountValue, 4);

    // Atomic upsert on userId @unique — avoids findUnique→create TOCTOU
    // where two concurrent saves both see "not exists" and the second
    // create hits P2002.
    const bankAccount = await db.payPalBankAccount.upsert({
      where: { userId: session.user.id },
      update: {
        bankNameEncrypted: encryptedBankName,
        accountHolderEncrypted: encryptedAccountHolder,
        accountNumberEncrypted: encryptedAccountNumber,
        routingNumberEncrypted: encryptedRoutingNumber,
        bankCountry: country,
        payoutPhoneEncrypted: encryptedPayoutPhone,
        bankNameDisplay: bankName,
        accountLastFour: lastFour,
        accountType: accountType || "checking",
        isVerified: false,
        verifiedAt: null,
      },
      create: {
        userId: session.user.id,
        bankNameEncrypted: encryptedBankName,
        accountHolderEncrypted: encryptedAccountHolder,
        accountNumberEncrypted: encryptedAccountNumber,
        routingNumberEncrypted: encryptedRoutingNumber,
        bankCountry: country,
        payoutPhoneEncrypted: encryptedPayoutPhone,
        bankNameDisplay: bankName,
        accountLastFour: lastFour,
        accountType: accountType || "checking",
      },
    });

    return NextResponse.json({
      success: true,
      id: bankAccount.id,
      lastFour,
    });
  } catch (error) {
    creatorPayPalBankAccountLogger.error({ err: String(error) }, "Error saving PayPal bank account:");
    if (error instanceof Error && error.message.includes("BANK_ACCOUNT_ENCRYPTION_KEY")) {
      return NextResponse.json(
        { error: "Server configuration error: encryption key not set" },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: "Failed to save bank account" },
      { status: 500 }
    );
  }
}

// DELETE - Remove PayPal bank account
export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // deleteMany for idempotency on concurrent double-clicks.
    await db.payPalBankAccount.deleteMany({
      where: { userId: session.user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    creatorPayPalBankAccountLogger.error({ err: String(error) }, "Error deleting PayPal bank account:");
    return NextResponse.json(
      { error: "Failed to delete bank account" },
      { status: 500 }
    );
  }
}
