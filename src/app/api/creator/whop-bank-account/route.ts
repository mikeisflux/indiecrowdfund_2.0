import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const creatorWhopBankAccountLogger = logger.child({ module: "creator-whop-bank-account" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { encrypt, getLastDigits } from "@/lib/encryption";

// GET - Check if user has a Whop bank account configured
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bankAccount = await db.whopBankAccount.findUnique({
      where: { userId: session.user.id },
      select: {
        id: true,
        bankNameDisplay: true,
        accountLastFour: true,
        accountType: true,
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
      isVerified: bankAccount.isVerified,
    });
  } catch (error) {
    creatorWhopBankAccountLogger.error({ err: String(error) }, "Error fetching Whop bank account:");
    return NextResponse.json(
      { error: "Failed to fetch bank account" },
      { status: 500 }
    );
  }
}

// POST - Create or update Whop bank account
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { bankName, accountHolder, accountNumber, routingNumber, accountType } = body;

    if (!bankName || !accountHolder || !accountNumber || !routingNumber) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    if (routingNumber.length !== 9) {
      return NextResponse.json(
        { error: "Routing number must be 9 digits" },
        { status: 400 }
      );
    }

    if (accountNumber.length < 4 || accountNumber.length > 17) {
      return NextResponse.json(
        { error: "Invalid account number length" },
        { status: 400 }
      );
    }

    const encryptedBankName = encrypt(bankName);
    const encryptedAccountHolder = encrypt(accountHolder);
    const encryptedAccountNumber = encrypt(accountNumber);
    const encryptedRoutingNumber = encrypt(routingNumber);
    const lastFour = getLastDigits(accountNumber, 4);

    // Atomic upsert on userId @unique — avoids findUnique→create TOCTOU.
    const bankAccount = await db.whopBankAccount.upsert({
      where: { userId: session.user.id },
      update: {
        bankNameEncrypted: encryptedBankName,
        accountHolderEncrypted: encryptedAccountHolder,
        accountNumberEncrypted: encryptedAccountNumber,
        routingNumberEncrypted: encryptedRoutingNumber,
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
    creatorWhopBankAccountLogger.error({ err: String(error) }, "Error saving Whop bank account:");
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

// DELETE - Remove Whop bank account
export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // deleteMany for idempotency on concurrent double-clicks.
    await db.whopBankAccount.deleteMany({
      where: { userId: session.user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    creatorWhopBankAccountLogger.error({ err: String(error) }, "Error deleting Whop bank account:");
    return NextResponse.json(
      { error: "Failed to delete bank account" },
      { status: 500 }
    );
  }
}
