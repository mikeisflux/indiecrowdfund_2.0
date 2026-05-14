import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const creatorPayPalBankAccountLogger = logger.child({ module: "creator-paypal-bank-account" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { encrypt, getLastDigits } from "@/lib/encryption";

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
    const country = String(bankCountry || "US").toUpperCase();
    const SUPPORTED_COUNTRIES = new Set(["US", "GB"]);
    if (!SUPPORTED_COUNTRIES.has(country)) {
      return NextResponse.json(
        { error: "Unsupported bank country. Currently supported: US, GB (UK)." },
        { status: 400 }
      );
    }

    if (!bankName || !accountHolder || !accountNumber || !routingNumber) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    // Routing-format validation is country-specific:
    //   US ACH: 9-digit ABA routing number, 4–17 digit account number
    //   UK:     6-digit Sort Code, 8-digit account number, plus a
    //           payout phone (UK banks require it on the payee record).
    // Digits-only is stored either way — the UI may format a UK Sort
    // Code as XX-XX-XX so we strip separators before validating.
    const routingDigits = String(routingNumber).replace(/\D/g, "");
    const accountDigits = String(accountNumber).replace(/\D/g, "");
    if (country === "US") {
      if (!/^\d{9}$/.test(routingDigits)) {
        return NextResponse.json(
          { error: "Routing number must be 9 digits" },
          { status: 400 }
        );
      }
      if (!/^\d{4,17}$/.test(accountDigits)) {
        return NextResponse.json(
          { error: "Invalid account number length" },
          { status: 400 }
        );
      }
    } else if (country === "GB") {
      if (!/^\d{6}$/.test(routingDigits)) {
        return NextResponse.json(
          { error: "UK sort code must be 6 digits (e.g. 60-06-39)" },
          { status: 400 }
        );
      }
      if (!/^\d{8}$/.test(accountDigits)) {
        return NextResponse.json(
          { error: "UK account number must be 8 digits" },
          { status: 400 }
        );
      }
      if (!payoutPhone || String(payoutPhone).trim().length < 7) {
        return NextResponse.json(
          { error: "Phone number is required for UK bank accounts (your bank requires it on the payee record)" },
          { status: 400 }
        );
      }
    }

    const encryptedBankName = encrypt(bankName);
    const encryptedAccountHolder = encrypt(accountHolder);
    const encryptedAccountNumber = encrypt(accountDigits);
    const encryptedRoutingNumber = encrypt(routingDigits);
    const encryptedPayoutPhone = payoutPhone ? encrypt(String(payoutPhone).trim()) : null;
    const lastFour = getLastDigits(accountDigits, 4);

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
