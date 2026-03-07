import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { auditLog } from "@/lib/audit";

// Force dynamic - this route uses auth/headers
export const dynamic = "force-dynamic";

// Helper to check admin role
async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.id) {
    return { error: "Unauthorized", status: 401 };
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true }
  });

  if (user?.role !== "SUPER_ADMIN") {
    return { error: "Forbidden - Super Admin access required", status: 403 };
  }

  return { user: session.user };
}

// GET - Fetch bank account details (for admin payout purposes)
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

    // Get the bank account
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
    } catch (error) {
      console.error("Error decrypting bank account details:", error);
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
      isVerified: bankAccount.isVerified,
      verifiedAt: bankAccount.verifiedAt,
      verificationMethod: bankAccount.verificationMethod,
      createdAt: bankAccount.createdAt,
      updatedAt: bankAccount.updatedAt,
    });
  } catch (error) {
    console.error("Error fetching bank account:", error);
    return NextResponse.json(
      { error: "Failed to fetch bank account" },
      { status: 500 }
    );
  }
}
