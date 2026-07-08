import { NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { createPayPalConnectOnboardingLink } from "@/lib/payments/paypal-connect";

const log = logger.child({ module: "paypal-connect-onboard" });

export const dynamic = "force-dynamic";

// POST - Generate a PayPal Connect (Partner Referrals) onboarding link for the
// signed-in creator and return the action_url to redirect them to.
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || "";
    const returnUrl = `${baseUrl}/api/paypal/connect/complete`;

    const actionUrl = await createPayPalConnectOnboardingLink(session.user.id, returnUrl);

    return NextResponse.json({ actionUrl });
  } catch (error) {
    log.error({ err: formatError(error) }, "Failed to create PayPal Connect onboarding link");
    return NextResponse.json(
      { error: "Failed to start PayPal Connect onboarding" },
      { status: 500 },
    );
  }
}
