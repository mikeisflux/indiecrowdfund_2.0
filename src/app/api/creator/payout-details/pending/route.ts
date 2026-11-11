import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { pendingPayoutDetails, PAYOUT_PROCESSOR_API } from "@/lib/payouts/payout-details";

export const dynamic = "force-dynamic";

// GET - Payout accounts of the signed-in creator that are missing required
// information (billing address on a legacy row, or no account at all for a
// launched campaign's processor). Drives the dashboard gate's re-check.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const pending = await pendingPayoutDetails(session.user.id);
  return NextResponse.json({
    pending: pending.map((p) => ({ ...p, saveUrl: PAYOUT_PROCESSOR_API[p.processor] })),
  });
}
