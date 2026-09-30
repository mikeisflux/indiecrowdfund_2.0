import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { pendingChargebackCards } from "@/lib/chargeback-card";

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

  const creator = await db.user.findFirst({
    where: { id: session.user.id },
    select: { vanityUrl: true },
  });
  const rows = await pendingChargebackCards(session.user.id);
  const slugs = rows.length
    ? await db.project.findMany({
        where: { id: { in: rows.map((r) => r.id) } },
        select: { id: true, slug: true },
      })
    : [];
  const slugById = new Map(slugs.map((s) => [s.id, s.slug]));
  const pending = rows.map((p) => ({
    ...p,
    editUrl: creator?.vanityUrl
      ? `/projects/${creator.vanityUrl}/${slugById.get(p.id)}/edit`
      : `/projects/${slugById.get(p.id)}/edit`,
  }));

  return NextResponse.json({ pending });
}
