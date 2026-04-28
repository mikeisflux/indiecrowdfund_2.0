import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { encrypt, getLastDigits } from "@/lib/encryption";
import { logger } from "@/lib/logger";
import { isValidNamePart, describeNameError } from "@/lib/validation/name";

const log = logger.child({ module: "creator-paymentcloud-bank-account" });

// PaymentCloud creator payout bank account.
//
// Mirrors /api/creator/bank-account (DivinityCoin) but with the new
// rules the legacy form was missing:
//   - account holder is required as separate first + last name fields
//   - both name fields are validated (letters only, no emails/symbols)
//   - billing address is captured at the same time
//
// AES-256 encryption per the existing pattern; non-sensitive display
// data (bank name, last4, account type) is stored in plaintext for UI.

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const acct = await db.paymentCloudBankAccount.findUnique({
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

    if (!acct) return NextResponse.json({ exists: false });

    return NextResponse.json({
      exists: true,
      bankName: acct.bankNameDisplay,
      lastFour: acct.accountLastFour,
      accountType: acct.accountType,
      isVerified: acct.isVerified,
    });
  } catch (err) {
    // Defensive: if the table doesn't exist yet (schema mismatch on
    // a fresh deploy where prisma db push hasn't run), return
    // `exists: false` so the project creation page doesn't surface
    // a 500 banner. Real errors are still logged for triage.
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ err: msg }, "GET error");
    if (
      msg.includes("does not exist") ||
      msg.includes("relation") ||
      msg.includes("PaymentCloudBankAccount")
    ) {
      return NextResponse.json({ exists: false });
    }
    return NextResponse.json({ exists: false }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      bankName,
      accountHolderFirstName,
      accountHolderLastName,
      accountNumber,
      routingNumber,
      accountType,
      billingLine1,
      billingLine2,
      billingCity,
      billingState,
      billingZip,
      billingCountry,
      projectId,
    } = body as Record<string, string | undefined>;

    if (projectId) {
      const project = await db.project.findFirst({
        where: { id: projectId, deletedAt: null },
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

    if (!bankName || !accountNumber || !routingNumber) {
      return NextResponse.json({ error: "All bank fields are required" }, { status: 400 });
    }
    if (!isValidNamePart(accountHolderFirstName)) {
      return NextResponse.json({ error: describeNameError("account holder first name") }, { status: 400 });
    }
    if (!isValidNamePart(accountHolderLastName)) {
      return NextResponse.json({ error: describeNameError("account holder last name") }, { status: 400 });
    }
    if (!/^\d{9}$/.test(routingNumber)) {
      return NextResponse.json({ error: "Routing number must be 9 digits" }, { status: 400 });
    }
    if (!/^\d{4,17}$/.test(accountNumber)) {
      return NextResponse.json({ error: "Invalid account number" }, { status: 400 });
    }
    if (!billingLine1 || !billingCity || !billingState || !billingZip || !billingCountry) {
      return NextResponse.json({ error: "All billing address fields are required" }, { status: 400 });
    }

    const lastFour = getLastDigits(accountNumber, 4);

    await db.paymentCloudBankAccount.upsert({
      where: { userId: session.user.id },
      update: {
        bankNameEncrypted: encrypt(bankName),
        accountHolderFirstNameEncrypted: encrypt(accountHolderFirstName!.trim()),
        accountHolderLastNameEncrypted: encrypt(accountHolderLastName!.trim()),
        accountNumberEncrypted: encrypt(accountNumber),
        routingNumberEncrypted: encrypt(routingNumber),
        billingLine1Encrypted: encrypt(billingLine1!.trim()),
        billingLine2Encrypted: billingLine2 ? encrypt(billingLine2.trim()) : null,
        billingCityEncrypted: encrypt(billingCity!.trim()),
        billingStateEncrypted: encrypt(billingState!.trim()),
        billingZipEncrypted: encrypt(billingZip!.trim()),
        billingCountryEncrypted: encrypt(billingCountry!.trim()),
        bankNameDisplay: bankName,
        accountLastFour: lastFour,
        accountType: accountType || "checking",
        isVerified: false,
        verifiedAt: null,
      },
      create: {
        userId: session.user.id,
        bankNameEncrypted: encrypt(bankName),
        accountHolderFirstNameEncrypted: encrypt(accountHolderFirstName!.trim()),
        accountHolderLastNameEncrypted: encrypt(accountHolderLastName!.trim()),
        accountNumberEncrypted: encrypt(accountNumber),
        routingNumberEncrypted: encrypt(routingNumber),
        billingLine1Encrypted: encrypt(billingLine1!.trim()),
        billingLine2Encrypted: billingLine2 ? encrypt(billingLine2.trim()) : null,
        billingCityEncrypted: encrypt(billingCity!.trim()),
        billingStateEncrypted: encrypt(billingState!.trim()),
        billingZipEncrypted: encrypt(billingZip!.trim()),
        billingCountryEncrypted: encrypt(billingCountry!.trim()),
        bankNameDisplay: bankName,
        accountLastFour: lastFour,
        accountType: accountType || "checking",
      },
    });

    return NextResponse.json({ success: true, lastFour });
  } catch (err) {
    log.error({ err: String(err) }, "POST error");
    if (err instanceof Error && err.message.includes("BANK_ACCOUNT_ENCRYPTION_KEY")) {
      return NextResponse.json(
        { error: "Server configuration error: encryption key not set" },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: "Failed to save bank account" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await db.paymentCloudBankAccount.deleteMany({ where: { userId: session.user.id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    log.error({ err: String(err) }, "DELETE error");
    return NextResponse.json({ error: "Failed to delete bank account" }, { status: 500 });
  }
}
