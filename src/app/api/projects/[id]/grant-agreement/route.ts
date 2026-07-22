import { NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { encrypt, decrypt, getLastDigits } from "@/lib/encryption";
import { GRANT_AGREEMENT_VERSION } from "@/components/legal/grant-agreement";

const log = logger.child({ module: "project-grant-agreement" });

export const dynamic = "force-dynamic";

const ENTITY_TYPES = new Set(["INDIVIDUAL", "BUSINESS", "NONPROFIT"]);

// Best-effort decrypt: legacy/absent fields just prefill as empty.
function tryDecrypt(value: string | null | undefined): string {
  if (!value) return "";
  try {
    return decrypt(value);
  } catch {
    return "";
  }
}

interface TaxInfoInput {
  legalName?: unknown;
  businessName?: unknown;
  entityType?: unknown;
  taxId?: unknown;
  addressLine1?: unknown;
  addressLine2?: unknown;
  city?: unknown;
  state?: unknown;
  zip?: unknown;
  country?: unknown;
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

// GET - Agreement status for this project (creator only). When unsigned,
// includes prefill values drawn from data the creator already entered during
// campaign creation (account name, project entity type, bank billing address).
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const project = await db.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true, creatorId: true, projectType: true, paymentProcessor: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (project.creatorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const agreement = await db.grantAgreement.findUnique({
      where: { projectId },
      select: { version: true, acceptedAt: true, taxLegalName: true, taxIdLast4: true },
    });

    if (agreement) {
      return NextResponse.json({
        signed: true,
        version: agreement.version,
        acceptedAt: agreement.acceptedAt,
        currentVersion: GRANT_AGREEMENT_VERSION,
        taxOnFile: !!agreement.taxIdLast4,
      });
    }

    // Prefill from campaign-creation data. Billing address comes from the
    // bank account matching the project's payment processor (all encrypted at
    // rest); name from the creator's account; entity type from the project.
    const user = await db.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
      select: {
        name: true,
        divinityCoinBankAccount: {
          select: {
            accountHolderFirstNameEncrypted: true,
            accountHolderLastNameEncrypted: true,
            billingLine1Encrypted: true,
            billingLine2Encrypted: true,
            billingCityEncrypted: true,
            billingStateEncrypted: true,
            billingZipEncrypted: true,
            billingCountryEncrypted: true,
          },
        },
        whopBankAccount: {
          select: {
            accountHolderFirstNameEncrypted: true,
            accountHolderLastNameEncrypted: true,
            billingLine1Encrypted: true,
            billingLine2Encrypted: true,
            billingCityEncrypted: true,
            billingStateEncrypted: true,
            billingZipEncrypted: true,
            billingCountryEncrypted: true,
          },
        },
        paypalBankAccount: {
          select: {
            // PayPal stores the holder as a single field, not first/last.
            accountHolderEncrypted: true,
            billingLine1Encrypted: true,
            billingLine2Encrypted: true,
            billingCityEncrypted: true,
            billingStateEncrypted: true,
            billingZipEncrypted: true,
            billingCountryEncrypted: true,
          },
        },
      },
    });

    // Resolve holder name + billing address from the processor-matching bank
    // account. Shapes differ: DC/Whop split first/last, PayPal is one field.
    let bankName = "";
    let bank:
      | {
          billingLine1Encrypted: string | null;
          billingLine2Encrypted: string | null;
          billingCityEncrypted: string | null;
          billingStateEncrypted: string | null;
          billingZipEncrypted: string | null;
          billingCountryEncrypted: string | null;
        }
      | null
      | undefined;
    if (project.paymentProcessor === "PAYPAL") {
      bank = user?.paypalBankAccount;
      bankName = tryDecrypt(user?.paypalBankAccount?.accountHolderEncrypted);
    } else {
      const acct =
        project.paymentProcessor === "WHOP"
          ? user?.whopBankAccount
          : user?.divinityCoinBankAccount;
      bank = acct;
      bankName = [
        tryDecrypt(acct?.accountHolderFirstNameEncrypted),
        tryDecrypt(acct?.accountHolderLastNameEncrypted),
      ]
        .filter(Boolean)
        .join(" ");
    }

    return NextResponse.json({
      signed: false,
      currentVersion: GRANT_AGREEMENT_VERSION,
      prefill: {
        legalName: bankName || user?.name || "",
        businessName: "",
        entityType: project.projectType || "INDIVIDUAL",
        addressLine1: tryDecrypt(bank?.billingLine1Encrypted),
        addressLine2: tryDecrypt(bank?.billingLine2Encrypted),
        city: tryDecrypt(bank?.billingCityEncrypted),
        state: tryDecrypt(bank?.billingStateEncrypted),
        zip: tryDecrypt(bank?.billingZipEncrypted),
        country: tryDecrypt(bank?.billingCountryEncrypted) || "US",
      },
    });
  } catch (error) {
    log.error({ err: formatError(error) }, "Failed to read grant agreement status");
    return NextResponse.json({ error: "Failed to read agreement status" }, { status: 500 });
  }
}

// POST - Accept the grant agreement for this project, recording the grantee's
// tax information. Only the project's creator can sign.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const project = await db.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true, creatorId: true, title: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (project.creatorId !== session.user.id) {
      return NextResponse.json(
        { error: "Only the project's creator can sign the grant agreement" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const tax: TaxInfoInput = body?.taxInfo ?? {};
    const legalName = str(tax.legalName);
    const businessName = str(tax.businessName);
    const entityType = str(tax.entityType).toUpperCase();
    const taxId = str(tax.taxId).replace(/[^0-9A-Za-z]/g, "");
    const addressLine1 = str(tax.addressLine1);
    const addressLine2 = str(tax.addressLine2);
    const city = str(tax.city);
    const state = str(tax.state);
    const zip = str(tax.zip);
    const country = str(tax.country).toUpperCase();

    if (!legalName) {
      return NextResponse.json({ error: "Legal name is required" }, { status: 400 });
    }
    if (!ENTITY_TYPES.has(entityType)) {
      return NextResponse.json({ error: "Please select an entity type" }, { status: 400 });
    }
    if (taxId.length < 4 || taxId.length > 20) {
      return NextResponse.json(
        { error: "A valid tax ID (SSN or EIN) is required" },
        { status: 400 }
      );
    }
    if (!addressLine1 || !city || !zip || !country) {
      return NextResponse.json({ error: "A complete address is required" }, { status: 400 });
    }

    // Idempotent: re-signing returns the existing record (unique projectId).
    const existing = await db.grantAgreement.findUnique({ where: { projectId } });
    if (existing) {
      return NextResponse.json({
        signed: true,
        version: existing.version,
        acceptedAt: existing.acceptedAt,
      });
    }

    let agreement;
    try {
      agreement = await db.grantAgreement.create({
        data: {
          userId: session.user.id,
          projectId,
          version: GRANT_AGREEMENT_VERSION,
          taxLegalName: legalName,
          taxBusinessName: businessName || null,
          taxEntityType: entityType,
          taxIdEncrypted: encrypt(taxId),
          taxIdLast4: getLastDigits(taxId, 4),
          taxAddressLine1: addressLine1,
          taxAddressLine2: addressLine2 || null,
          taxCity: city,
          taxState: state || null,
          taxZip: zip,
          taxCountry: country,
        },
      });
    } catch (createErr) {
      // Race: two accepts at once (double-click / two tabs). The unique
      // projectId constraint makes the second create throw P2002 — treat it
      // as success and return the winner's record.
      const isUnique =
        createErr && typeof createErr === "object" && "code" in createErr &&
        (createErr as { code?: string }).code === "P2002";
      if (!isUnique) throw createErr;
      const winner = await db.grantAgreement.findUnique({ where: { projectId } });
      return NextResponse.json({
        signed: true,
        version: winner?.version ?? GRANT_AGREEMENT_VERSION,
        acceptedAt: winner?.acceptedAt ?? new Date(),
      });
    }

    log.info(
      { projectId, userId: session.user.id, version: agreement.version },
      "Grant agreement signed with tax info"
    );

    return NextResponse.json({
      signed: true,
      version: agreement.version,
      acceptedAt: agreement.acceptedAt,
    });
  } catch (error) {
    log.error({ err: formatError(error) }, "Failed to accept grant agreement");
    return NextResponse.json({ error: "Failed to accept agreement" }, { status: 500 });
  }
}
