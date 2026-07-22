import { NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const log = logger.child({ module: "admin-grant-records" });

export const dynamic = "force-dynamic";

function csvCell(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// GET - Grant Program record-keeping export (CSV). One row per LIVE/FUNDED
// project: contributions received, program costs retained, grant amount
// disbursed, agreement status, and disbursement dates. This is the paper
// trail showing each grant, its agreement, and how the retained percentage
// was applied.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await db.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
      select: { role: true },
    });
    if (user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden - Super Admin access required" }, { status: 403 });
    }

    const projects = await db.project.findMany({
      where: { status: { in: ["LIVE", "FUNDED"] }, deletedAt: null },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        creator: { select: { name: true, email: true } },
        pledges: {
          where: { status: "COMPLETED", deletedAt: null },
          select: { amount: true },
        },
        grantAgreement: {
          select: {
            version: true,
            acceptedAt: true,
            taxLegalName: true,
            taxBusinessName: true,
            taxEntityType: true,
            taxIdLast4: true,
            taxAddressLine1: true,
            taxAddressLine2: true,
            taxCity: true,
            taxState: true,
            taxZip: true,
            taxCountry: true,
          },
        },
        payouts: {
          where: { deletedAt: null },
          select: { amount: true, platformFees: true, processorFees: true, status: true, sentAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const header = [
      "Project", "Creator", "Creator Email", "Status",
      "Contributions (gross)", "Program Costs Retained", "Processing Costs",
      "Grant Amount", "Payout Status", "Disbursed At",
      "Agreement Signed", "Agreement Version", "Agreement Signed At",
      // Grantee tax info (TIN shown as last 4 only; full TIN stays encrypted)
      "Tax Legal Name", "Tax Business Name", "Tax Entity Type", "TIN Last 4",
      "Tax Address", "Tax City", "Tax State", "Tax ZIP", "Tax Country",
    ].join(",");

    const rows = projects.map((p) => {
      const gross = p.pledges.reduce((s: number, pl: { amount: unknown }) => s + Number(pl.amount), 0);
      const payout = p.payouts[0];
      return [
        csvCell(p.title),
        csvCell(p.creator?.name),
        csvCell(p.creator?.email),
        csvCell(p.status),
        gross.toFixed(2),
        payout ? Number(payout.platformFees).toFixed(2) : "",
        payout ? Number(payout.processorFees).toFixed(2) : "",
        payout ? Number(payout.amount).toFixed(2) : "",
        csvCell(payout?.status ?? "NOT_CREATED"),
        csvCell(payout?.sentAt ? payout.sentAt.toISOString() : ""),
        p.grantAgreement ? "YES" : "NO",
        csvCell(p.grantAgreement?.version),
        csvCell(p.grantAgreement?.acceptedAt ? p.grantAgreement.acceptedAt.toISOString() : ""),
        csvCell(p.grantAgreement?.taxLegalName),
        csvCell(p.grantAgreement?.taxBusinessName),
        csvCell(p.grantAgreement?.taxEntityType),
        csvCell(p.grantAgreement?.taxIdLast4 ? `****${p.grantAgreement.taxIdLast4}` : ""),
        csvCell(
          [p.grantAgreement?.taxAddressLine1, p.grantAgreement?.taxAddressLine2]
            .filter(Boolean)
            .join(", ")
        ),
        csvCell(p.grantAgreement?.taxCity),
        csvCell(p.grantAgreement?.taxState),
        csvCell(p.grantAgreement?.taxZip),
        csvCell(p.grantAgreement?.taxCountry),
      ].join(",");
    });

    const csv = [header, ...rows].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="grant-records-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    log.error({ err: formatError(error) }, "Failed to export grant records");
    return NextResponse.json({ error: "Failed to export grant records" }, { status: 500 });
  }
}
