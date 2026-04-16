import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const creatorBankAccountLogger = logger.child({ module: "creator-bank-account" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { encrypt, getLastDigits } from "@/lib/encryption";

// GET - Check if user has a bank account configured
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bankAccount = await db.divinityCoinBankAccount.findUnique({
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
    creatorBankAccountLogger.error({ err: String(error) }, "Error fetching bank account:");
    return NextResponse.json(
      { error: "Failed to fetch bank account" },
      { status: 500 }
    );
  }
}

// POST - Create or update bank account
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { bankName, accountHolder, accountNumber, routingNumber, accountType, projectId } = body;

    // If projectId is provided, verify the user is the project owner (not just a collaborator)
    if (projectId) {
      const project = await db.project.findFirst({
        where: { id: projectId , deletedAt: null },
        select: { creatorId: true },
      });

      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }

      if (project.creatorId !== session.user.id) {
        return NextResponse.json(
          { error: "Only the project owner can modify bank account settings" },
          { status: 403 }
        );
      }
    }

    // Validation
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

    // Encrypt sensitive data
    const encryptedBankName = encrypt(bankName);
    const encryptedAccountHolder = encrypt(accountHolder);
    const encryptedAccountNumber = encrypt(accountNumber);
    const encryptedRoutingNumber = encrypt(routingNumber);

    // Get last 4 digits for display
    const lastFour = getLastDigits(accountNumber, 4);

    // Upsert bank account
    const bankAccount = await db.divinityCoinBankAccount.upsert({
      where: { userId: session.user.id },
      update: {
        bankNameEncrypted: encryptedBankName,
        accountHolderEncrypted: encryptedAccountHolder,
        accountNumberEncrypted: encryptedAccountNumber,
        routingNumberEncrypted: encryptedRoutingNumber,
        bankNameDisplay: bankName,
        accountLastFour: lastFour,
        accountType: accountType || "checking",
        isVerified: false, // Reset verification on update
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
    creatorBankAccountLogger.error({ err: String(error) }, "Error saving bank account:");
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes("BANK_ACCOUNT_ENCRYPTION_KEY")) {
        return NextResponse.json(
          { error: "Server configuration error: encryption key not set" },
          { status: 500 }
        );
      }
      if (error.message.includes("Unique constraint")) {
        return NextResponse.json(
          { error: "Bank account already exists for this user" },
          { status: 400 }
        );
      }
    }
    return NextResponse.json(
      { error: "Failed to save bank account" },
      { status: 500 }
    );
  }
}

// DELETE - Remove bank account
export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await db.divinityCoinBankAccount.deleteMany({
      where: { userId: session.user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    creatorBankAccountLogger.error({ err: String(error) }, "Error deleting bank account:");
    return NextResponse.json(
      { error: "Failed to delete bank account" },
      { status: 500 }
    );
  }
}
