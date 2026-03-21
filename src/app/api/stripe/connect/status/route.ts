import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStripeInstance } from "@/lib/payments/stripe";
import { logger } from "@/lib/logger";

const stripeStatusLogger = logger.child({ module: "stripe-connect-status" });

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const config = await db.stripeConfig.findUnique({
      where: { userId: session.user.id },
    });

    if (!config) {
      return NextResponse.json({
        hasAccount: false,
        status: "none",
      });
    }

    // Retrieve the full account from Stripe to check requirements
    try {
      const stripeClient = await getStripeInstance();
      const account = await stripeClient.accounts.retrieve(config.stripeAccountId);

      const requirements = account.requirements;
      const hasCurrentlyDue = (requirements?.currently_due?.length ?? 0) > 0;
      const hasPastDue = (requirements?.past_due?.length ?? 0) > 0;
      const hasDisabledReason = !!requirements?.disabled_reason;

      // Determine account status
      let status: "enabled" | "restricted" | "restricted_soon" | "pending" | "incomplete";
      if (account.charges_enabled && account.payouts_enabled && !hasCurrentlyDue && !hasPastDue) {
        status = "enabled";
      } else if (hasDisabledReason || (!account.charges_enabled && !account.payouts_enabled)) {
        status = "restricted";
      } else if (hasPastDue || hasCurrentlyDue) {
        status = "restricted_soon";
      } else if (!account.charges_enabled || !account.payouts_enabled) {
        status = "pending";
      } else {
        status = "incomplete";
      }

      // Build a human-readable list of what's needed
      const pendingRequirements: string[] = [];
      const allDue = [
        ...(requirements?.currently_due || []),
        ...(requirements?.past_due || []),
      ];
      const uniqueDue = [...new Set(allDue)];

      for (const req of uniqueDue) {
        pendingRequirements.push(formatRequirement(req));
      }

      return NextResponse.json({
        hasAccount: true,
        status,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        disabledReason: requirements?.disabled_reason || null,
        currentDeadline: requirements?.current_deadline
          ? new Date(requirements.current_deadline * 1000).toISOString()
          : null,
        pendingRequirements,
        pastDue: (requirements?.past_due?.length ?? 0) > 0,
      });
    } catch (stripeError) {
      const sErr = stripeError as { type?: string; code?: string; message?: string };
      if (sErr.type === "StripePermissionError" || sErr.code === "account_invalid") {
        return NextResponse.json({
          hasAccount: true,
          status: "revoked",
          chargesEnabled: false,
          payoutsEnabled: false,
          disabledReason: "Account access has been revoked",
          pendingRequirements: [],
          pastDue: false,
        });
      }
      stripeStatusLogger.error({ err: sErr.message || stripeError }, "Error retrieving Stripe account:");
      return NextResponse.json(
        { error: "Failed to check Stripe account status" },
        { status: 500 }
      );
    }
  } catch (error) {
    stripeStatusLogger.error({ err: error }, "Stripe status check error:");
    return NextResponse.json(
      { error: "Failed to check Stripe status" },
      { status: 500 }
    );
  }
}

function formatRequirement(requirement: string): string {
  const mapping: Record<string, string> = {
    "individual.verification.document": "Identity document",
    "individual.verification.additional_document": "Additional identity document",
    "individual.dob.day": "Date of birth",
    "individual.dob.month": "Date of birth",
    "individual.dob.year": "Date of birth",
    "individual.first_name": "First name",
    "individual.last_name": "Last name",
    "individual.address.line1": "Address",
    "individual.address.city": "City",
    "individual.address.state": "State",
    "individual.address.postal_code": "Postal code",
    "individual.address.country": "Country",
    "individual.ssn_last_4": "Last 4 of SSN",
    "individual.id_number": "ID number",
    "individual.phone": "Phone number",
    "individual.email": "Email address",
    "business_profile.url": "Business website",
    "business_profile.mcc": "Industry",
    "business_profile.product_description": "Product description",
    "external_account": "Bank account",
    "tos_acceptance.date": "Terms of service",
    "tos_acceptance.ip": "Terms of service",
    "company.name": "Company name",
    "company.tax_id": "Tax ID",
    "company.address.line1": "Company address",
    "settings.payments.statement_descriptor": "Statement descriptor",
  };

  // Check for exact match first
  if (mapping[requirement]) return mapping[requirement];

  // Check for partial matches
  for (const [key, value] of Object.entries(mapping)) {
    if (requirement.startsWith(key)) return value;
  }

  // Fallback: make it human-readable
  return requirement
    .replace(/\./g, " ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}
