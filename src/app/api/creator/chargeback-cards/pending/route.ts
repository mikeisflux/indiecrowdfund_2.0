import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET - Campaigns of the signed-in creator whose chargeback protection card
// is missing or not yet in the DivinityCoin vault (legacy encrypted rows and
// PaymentCloud vault ids from the decommissioned processor). Drives the
// dashboard banner asking them to enter the card through the secure form.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projects = await db.project.findMany({
    where: {
      creatorId: session.user.id,
      deletedAt: null,
      status: { in: ["SUBMITTED", "APPROVED", "LIVE", "PAUSED", "FUNDED"] },
    },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      creator: { select: { vanityUrl: true } },
      chargebackCard: { select: { divinityCoinPaymentMethodId: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const pending = projects
    .filter((p) => !p.chargebackCard?.divinityCoinPaymentMethodId)
    .map((p) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      hasLegacyCard: !!p.chargebackCard,
      editUrl: p.creator.vanityUrl
        ? `/projects/${p.creator.vanityUrl}/${p.slug}/edit`
        : `/projects/${p.slug}/edit`,
    }));

  return NextResponse.json({ pending });
}
