import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const adminBankAccountsLogger = logger.child({ module: "admin-bank-accounts" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/encryption";
import { auditLog } from "@/lib/audit";

// Force dynamic - this route uses auth/headers
export const dynamic = "force-dynamic";

// Helper to check admin role
async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.id) {
    return { error: "Unauthorized", status: 401 };
  }

  const user = await db.user.findFirst({
    where: { id: session.user.id, deletedAt: null },
    select: { role: true }
  });

  if (user?.role !== "SUPER_ADMIN") {
    return { error: "Forbidden - Super Admin access required", status: 403 };
  }

  return { user: session.user };
}

// GET - Fetch bank account details (for admin payout purposes)
// Supports DivinityCoin, PayPal, and Whop bank accounts via ?type= query param
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "divinitycoin";

    // Whop bank account lookup
    if (type === "whop") {
      const bankAccount = await db.whopBankAccount.findUnique({
        where: { id },
        include: { user: { select: { id: true, name: true, email: true } } },
      });

      if (!bankAccount) {
        return NextResponse.json({ error: "Bank account not found" }, { status: 404 });
      }

      let bankName = bankAccount.bankNameDisplay || "[Encrypted]";
      let accountHolder = "[Encrypted]";
      let accountNumber = "[Encrypted]";
      let routingNumber = "[Encrypted]";
      let payoutPhone: string | null = null;
      let billingLine1: string | null = null;
      let billingLine2: string | null = null;
      let billingCity: string | null = null;
      let billingState: string | null = null;
      let billingZip: string | null = null;
      let billingCountry: string | null = null;

      try {
        if (bankAccount.bankNameEncrypted) bankName = decrypt(bankAccount.bankNameEncrypted);
        if (bankAccount.accountHolderEncrypted) accountHolder = decrypt(bankAccount.accountHolderEncrypted);
        if (bankAccount.accountNumberEncrypted) accountNumber = decrypt(bankAccount.accountNumberEncrypted);
        if (bankAccount.routingNumberEncrypted) routingNumber = decrypt(bankAccount.routingNumberEncrypted);
        if (bankAccount.payoutPhoneEncrypted) payoutPhone = decrypt(bankAccount.payoutPhoneEncrypted);
        if (bankAccount.billingLine1Encrypted) billingLine1 = decrypt(bankAccount.billingLine1Encrypted);
        if (bankAccount.billingLine2Encrypted) billingLine2 = decrypt(bankAccount.billingLine2Encrypted);
        if (bankAccount.billingCityEncrypted) billingCity = decrypt(bankAccount.billingCityEncrypted);
        if (bankAccount.billingStateEncrypted) billingState = decrypt(bankAccount.billingStateEncrypted);
        if (bankAccount.billingZipEncrypted) billingZip = decrypt(bankAccount.billingZipEncrypted);
        if (bankAccount.billingCountryEncrypted) billingCountry = decrypt(bankAccount.billingCountryEncrypted);
      } catch (error) {
        adminBankAccountsLogger.error({ err: formatError(error) }, "Error decrypting Whop bank account details:");
      }

      auditLog({
        action: "BANK_ACCOUNT_VIEW",
        actorId: authResult.user.id,
        actorEmail: authResult.user.email || undefined,
        targetId: id,
        targetType: "USER",
        details: { bankAccountUserId: bankAccount.userId, processor: "WHOP" },
      });

      return NextResponse.json({
        id: bankAccount.id,
        userId: bankAccount.userId,
        user: bankAccount.user,
        bankName,
        bankNameDisplay: bankAccount.bankNameDisplay,
        accountHolder,
        accountNumber,
        accountLastFour: bankAccount.accountLastFour,
        routingNumber,
        accountType: bankAccount.accountType,
        bankCountry: bankAccount.bankCountry,
        payoutPhone,
        billingLine1,
        billingLine2,
        billingCity,
        billingState,
        billingZip,
        billingCountry,
        isVerified: bankAccount.isVerified,
        verifiedAt: bankAccount.verifiedAt,
        verificationMethod: null,
        createdAt: bankAccount.createdAt,
        updatedAt: bankAccount.updatedAt,
      });
    }

    // PayPal bank account lookup
    if (type === "paypal") {
      const bankAccount = await db.payPalBankAccount.findUnique({
        where: { id },
        include: { user: { select: { id: true, name: true, email: true } } },
      });

      if (!bankAccount) {
        return NextResponse.json({ error: "Bank account not found" }, { status: 404 });
      }

      let bankName = bankAccount.bankNameDisplay || "[Encrypted]";
      let accountHolder = "[Encrypted]";
      let accountNumber = "[Encrypted]";
      let routingNumber = "[Encrypted]";
      let payoutPhone: string | null = null;
      let billingLine1: string | null = null;
      let billingLine2: string | null = null;
      let billingCity: string | null = null;
      let billingState: string | null = null;
      let billingZip: string | null = null;
      let billingCountry: string | null = null;

      try {
        if (bankAccount.bankNameEncrypted) bankName = decrypt(bankAccount.bankNameEncrypted);
        if (bankAccount.accountHolderEncrypted) accountHolder = decrypt(bankAccount.accountHolderEncrypted);
        if (bankAccount.accountNumberEncrypted) accountNumber = decrypt(bankAccount.accountNumberEncrypted);
        if (bankAccount.routingNumberEncrypted) routingNumber = decrypt(bankAccount.routingNumberEncrypted);
        if (bankAccount.payoutPhoneEncrypted) payoutPhone = decrypt(bankAccount.payoutPhoneEncrypted);
        if (bankAccount.billingLine1Encrypted) billingLine1 = decrypt(bankAccount.billingLine1Encrypted);
        if (bankAccount.billingLine2Encrypted) billingLine2 = decrypt(bankAccount.billingLine2Encrypted);
        if (bankAccount.billingCityEncrypted) billingCity = decrypt(bankAccount.billingCityEncrypted);
        if (bankAccount.billingStateEncrypted) billingState = decrypt(bankAccount.billingStateEncrypted);
        if (bankAccount.billingZipEncrypted) billingZip = decrypt(bankAccount.billingZipEncrypted);
        if (bankAccount.billingCountryEncrypted) billingCountry = decrypt(bankAccount.billingCountryEncrypted);
      } catch (error) {
        adminBankAccountsLogger.error({ err: formatError(error) }, "Error decrypting PayPal bank account details:");
      }

      auditLog({
        action: "BANK_ACCOUNT_VIEW",
        actorId: authResult.user.id,
        actorEmail: authResult.user.email || undefined,
        targetId: id,
        targetType: "USER",
        details: { bankAccountUserId: bankAccount.userId, processor: "PAYPAL" },
      });

      return NextResponse.json({
        id: bankAccount.id,
        userId: bankAccount.userId,
        user: bankAccount.user,
        bankName,
        bankNameDisplay: bankAccount.bankNameDisplay,
        accountHolder,
        accountNumber,
        accountLastFour: bankAccount.accountLastFour,
        routingNumber,
        accountType: bankAccount.accountType,
        bankCountry: bankAccount.bankCountry,
        payoutPhone,
        billingLine1,
        billingLine2,
        billingCity,
        billingState,
        billingZip,
        billingCountry,
        isVerified: bankAccount.isVerified,
        verifiedAt: bankAccount.verifiedAt,
        verificationMethod: bankAccount.verificationMethod,
        createdAt: bankAccount.createdAt,
        updatedAt: bankAccount.updatedAt,
      });
    }

    // Default: DivinityCoin bank account
    const bankAccount = await db.divinityCoinBankAccount.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!bankAccount) {
      return NextResponse.json(
        { error: "Bank account not found" },
        { status: 404 }
      );
    }

    // Decrypt the sensitive fields for admin viewing
    let bankName = bankAccount.bankNameDisplay || "[Encrypted]";
    let accountHolder = "[Encrypted]";
    let accountNumber = "[Encrypted]";
    let routingNumber = "[Encrypted]";
    let payoutPhone: string | null = null;
    let billingLine1: string | null = null;
    let billingLine2: string | null = null;
    let billingCity: string | null = null;
    let billingState: string | null = null;
    let billingZip: string | null = null;
    let billingCountry: string | null = null;

    try {
      if (bankAccount.bankNameEncrypted) {
        bankName = decrypt(bankAccount.bankNameEncrypted);
      }
      if (bankAccount.accountHolderEncrypted) {
        accountHolder = decrypt(bankAccount.accountHolderEncrypted);
      }
      if (bankAccount.accountNumberEncrypted) {
        accountNumber = decrypt(bankAccount.accountNumberEncrypted);
      }
      if (bankAccount.routingNumberEncrypted) {
        routingNumber = decrypt(bankAccount.routingNumberEncrypted);
      }
      if (bankAccount.payoutPhoneEncrypted) {
        payoutPhone = decrypt(bankAccount.payoutPhoneEncrypted);
      }
      if (bankAccount.billingLine1Encrypted) billingLine1 = decrypt(bankAccount.billingLine1Encrypted);
      if (bankAccount.billingLine2Encrypted) billingLine2 = decrypt(bankAccount.billingLine2Encrypted);
      if (bankAccount.billingCityEncrypted) billingCity = decrypt(bankAccount.billingCityEncrypted);
      if (bankAccount.billingStateEncrypted) billingState = decrypt(bankAccount.billingStateEncrypted);
      if (bankAccount.billingZipEncrypted) billingZip = decrypt(bankAccount.billingZipEncrypted);
      if (bankAccount.billingCountryEncrypted) billingCountry = decrypt(bankAccount.billingCountryEncrypted);
    } catch (error) {
      adminBankAccountsLogger.error({ err: formatError(error) }, "Error decrypting bank account details:");
      // Continue with encrypted placeholders if decryption fails
    }

    auditLog({
      action: "BANK_ACCOUNT_VIEW",
      actorId: authResult.user.id,
      actorEmail: authResult.user.email || undefined,
      targetId: id,
      targetType: "USER",
      details: { bankAccountUserId: bankAccount.userId },
    });

    return NextResponse.json({
      id: bankAccount.id,
      userId: bankAccount.userId,
      user: bankAccount.user,
      bankName,
      bankNameDisplay: bankAccount.bankNameDisplay,
      accountHolder,
      accountNumber,
      accountLastFour: bankAccount.accountLastFour,
      routingNumber,
      accountType: bankAccount.accountType,
      bankCountry: bankAccount.bankCountry,
      payoutPhone,
      billingLine1,
      billingLine2,
      billingCity,
      billingState,
      billingZip,
      billingCountry,
      isVerified: bankAccount.isVerified,
      verifiedAt: bankAccount.verifiedAt,
      verificationMethod: bankAccount.verificationMethod,
      createdAt: bankAccount.createdAt,
      updatedAt: bankAccount.updatedAt,
    });
  } catch (error) {
    adminBankAccountsLogger.error({ err: formatError(error) }, "Error fetching bank account:");
    return NextResponse.json(
      { error: "Failed to fetch bank account" },
      { status: 500 }
    );
  }
}

// PATCH - Admin correction of a creator's bank account (DC / PayPal / Whop)
// Accepts any subset of { accountHolder, bankName, routingNumber, accountNumber, accountType }.
// Re-encrypts updated fields and refreshes accountLastFour/bankNameDisplay.
// Clears isVerified on any change so the creator re-verifies against the corrected details.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "divinitycoin";

    const body = await request.json();
    const {
      accountHolder,
      bankName,
      routingNumber,
      accountNumber,
      accountType,
    } = body as Record<string, string | undefined>;

    if (accountType && !["checking", "savings"].includes(accountType)) {
      return NextResponse.json({ error: "accountType must be 'checking' or 'savings'" }, { status: 400 });
    }
    if (routingNumber && !/^\d{9}$/.test(routingNumber)) {
      return NextResponse.json({ error: "routingNumber must be 9 digits" }, { status: 400 });
    }
    if (accountNumber && !/^\d{4,17}$/.test(accountNumber)) {
      return NextResponse.json({ error: "accountNumber must be 4–17 digits" }, { status: 400 });
    }

    const updateData: Record<string, string | boolean | null> = {};
    if (bankName !== undefined) {
      updateData.bankNameEncrypted = encrypt(bankName);
      updateData.bankNameDisplay = bankName;
    }
    if (accountHolder !== undefined) {
      updateData.accountHolderEncrypted = encrypt(accountHolder);
    }
    if (routingNumber !== undefined) {
      updateData.routingNumberEncrypted = encrypt(routingNumber);
    }
    if (accountNumber !== undefined) {
      updateData.accountNumberEncrypted = encrypt(accountNumber);
      updateData.accountLastFour = accountNumber.slice(-4);
    }
    if (accountType !== undefined) {
      updateData.accountType = accountType;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    // Any correction means the previous verification no longer applies
    updateData.isVerified = false;
    updateData.verifiedAt = null;

    let updatedUserId: string;
    let processor: "DIVINITYCOIN" | "PAYPAL" | "WHOP";

    if (type === "whop") {
      const existing = await db.whopBankAccount.findUnique({ where: { id }, select: { userId: true } });
      if (!existing) return NextResponse.json({ error: "Bank account not found" }, { status: 404 });
      await db.whopBankAccount.update({ where: { id }, data: updateData });
      updatedUserId = existing.userId;
      processor = "WHOP";
    } else if (type === "paypal") {
      const existing = await db.payPalBankAccount.findUnique({ where: { id }, select: { userId: true } });
      if (!existing) return NextResponse.json({ error: "Bank account not found" }, { status: 404 });
      await db.payPalBankAccount.update({ where: { id }, data: updateData });
      updatedUserId = existing.userId;
      processor = "PAYPAL";
    } else {
      const existing = await db.divinityCoinBankAccount.findUnique({ where: { id }, select: { userId: true } });
      if (!existing) return NextResponse.json({ error: "Bank account not found" }, { status: 404 });
      await db.divinityCoinBankAccount.update({ where: { id }, data: updateData });
      updatedUserId = existing.userId;
      processor = "DIVINITYCOIN";
    }

    auditLog({
      action: "BANK_ACCOUNT_ADMIN_EDIT",
      actorId: authResult.user.id,
      actorEmail: authResult.user.email || undefined,
      targetId: id,
      targetType: "USER",
      details: {
        bankAccountUserId: updatedUserId,
        processor,
        fieldsChanged: Object.keys(body).filter((k) => body[k] !== undefined),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    adminBankAccountsLogger.error({ err: formatError(error) }, "Error updating bank account:");
    return NextResponse.json(
      { error: "Failed to update bank account" },
      { status: 500 }
    );
  }
}
