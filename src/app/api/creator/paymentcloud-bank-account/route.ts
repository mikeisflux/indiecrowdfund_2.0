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

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // When a projectId is passed, scope the lookup to the project's
    // creator instead of the caller. Lets accepted collaborators see
    // the same "saved" indicator the creator sees on the Payments
    // step / IndieKit Payments tab. We only return safe display fields
    // (last4, bankName, accountType) — no encrypted PAN/account number.
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    let targetUserId = session.user.id;
    if (projectId) {
      const project = await db.project.findFirst({
        where: {
          id: projectId,
          deletedAt: null,
          OR: [
            { creatorId: session.user.id },
            { collaborators: { some: { userId: session.user.id, status: "ACCEPTED" } } },
          ],
        },
        select: { creatorId: true },
      });
      if (!project) {
        // Don't 403 — the creator hasn't saved a bank yet, OR caller
        // isn't on the project. Either way the UI should show the
        // form-not-saved state, which `exists: false` triggers.
        return NextResponse.json({ exists: false });
      }
      targetUserId = project.creatorId;
    }

    const acct = await db.paymentCloudBankAccount.findUnique({
      where: { userId: targetUserId },
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

    if (!acct) return NextResponse.json({ exists: false });

    return NextResponse.json({
      exists: true,
      bankName: acct.bankNameDisplay,
      lastFour: acct.accountLastFour,
      accountType: acct.accountType,
      bankCountry: acct.bankCountry,
      isVerified: acct.isVerified,
      // Surface to the UI whether the caller can edit this record (only
      // the owner, never collaborators). Collaborators see read-only.
      canEdit: targetUserId === session.user.id,
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
      bankCountry,
      payoutPhone,
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

    // Default to US for backwards compatibility — every account that
    // pre-dates international support is a US ACH account. New form
    // submits include this explicitly.
    const country = (bankCountry || "US").toUpperCase();
    const SUPPORTED_COUNTRIES = new Set(["US", "GB"]);
    if (!SUPPORTED_COUNTRIES.has(country)) {
      return NextResponse.json(
        { error: "Unsupported bank country. Currently supported: US, GB (UK)." },
        { status: 400 }
      );
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

    // Routing-format validation is country-specific:
    //   US ACH:    9 digits (ABA routing transit number)
    //   UK Sort:   6 digits (visually formatted as XX-XX-XX in the UI,
    //              stored as digits-only — same as how we strip
    //              hyphens from the US routing field).
    // Account number length also differs (US: 4–17, UK: 8 standard).
    const routingDigits = routingNumber.replace(/\D/g, "");
    const accountDigits = accountNumber.replace(/\D/g, "");
    if (country === "US") {
      if (!/^\d{9}$/.test(routingDigits)) {
        return NextResponse.json({ error: "Routing number must be 9 digits" }, { status: 400 });
      }
      if (!/^\d{4,17}$/.test(accountDigits)) {
        return NextResponse.json({ error: "Invalid account number" }, { status: 400 });
      }
    } else if (country === "GB") {
      if (!/^\d{6}$/.test(routingDigits)) {
        return NextResponse.json({ error: "UK sort code must be 6 digits (e.g. 60-06-39)" }, { status: 400 });
      }
      if (!/^\d{8}$/.test(accountDigits)) {
        return NextResponse.json({ error: "UK account number must be 8 digits" }, { status: 400 });
      }
      if (!payoutPhone || payoutPhone.trim().length < 7) {
        return NextResponse.json(
          { error: "Phone number is required for UK bank accounts (your bank requires it on the payee record)" },
          { status: 400 }
        );
      }
    }

    // State/region is required for US, optional elsewhere — UK bank
    // records don't include a state/province.
    if (!billingLine1 || !billingCity || !billingZip || !billingCountry) {
      return NextResponse.json({ error: "All billing address fields are required" }, { status: 400 });
    }
    if (country === "US" && !billingState) {
      return NextResponse.json({ error: "Billing state is required for US accounts" }, { status: 400 });
    }

    const lastFour = getLastDigits(accountDigits, 4);

    await db.paymentCloudBankAccount.upsert({
      where: { userId: session.user.id },
      update: {
        bankNameEncrypted: encrypt(bankName),
        accountHolderFirstNameEncrypted: encrypt(accountHolderFirstName!.trim()),
        accountHolderLastNameEncrypted: encrypt(accountHolderLastName!.trim()),
        accountNumberEncrypted: encrypt(accountDigits),
        routingNumberEncrypted: encrypt(routingDigits),
        billingLine1Encrypted: encrypt(billingLine1!.trim()),
        billingLine2Encrypted: billingLine2 ? encrypt(billingLine2.trim()) : null,
        billingCityEncrypted: encrypt(billingCity!.trim()),
        billingStateEncrypted: billingState ? encrypt(billingState.trim()) : null,
        billingZipEncrypted: encrypt(billingZip!.trim()),
        billingCountryEncrypted: encrypt(billingCountry!.trim()),
        bankCountry: country,
        payoutPhoneEncrypted: payoutPhone ? encrypt(payoutPhone.trim()) : null,
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
        accountNumberEncrypted: encrypt(accountDigits),
        routingNumberEncrypted: encrypt(routingDigits),
        billingLine1Encrypted: encrypt(billingLine1!.trim()),
        billingLine2Encrypted: billingLine2 ? encrypt(billingLine2.trim()) : null,
        billingCityEncrypted: encrypt(billingCity!.trim()),
        billingStateEncrypted: billingState ? encrypt(billingState.trim()) : null,
        billingZipEncrypted: encrypt(billingZip!.trim()),
        billingCountryEncrypted: encrypt(billingCountry!.trim()),
        bankCountry: country,
        payoutPhoneEncrypted: payoutPhone ? encrypt(payoutPhone.trim()) : null,
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
