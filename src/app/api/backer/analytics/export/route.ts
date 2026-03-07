import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const backerAnalyticsExportLogger = logger.child({ module: "backer-analytics-export" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET: Export all pledges as CSV for tax records
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    // Get all pledges
    const pledges = await db.pledge.findMany({
      where: {
        userId: session.user.id,
        status: { in: ["COMPLETED", "REFUNDED"] },
      },
      include: {
        project: {
          select: {
            title: true,
            category: true,
            creator: {
              select: { name: true },
            },
          },
        },
        reward: {
          select: {
            title: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Build CSV
    const headers = [
      "Date",
      "Project",
      "Creator",
      "Category",
      "Reward",
      "Pledge Amount",
      "Shipping",
      "Add-ons",
      "Total",
      "Status",
      "Fulfillment Status",
    ];

    const rows = pledges.map((pledge) => {
      const total =
        Number(pledge.amount) +
        Number(pledge.shippingAmount || 0) +
        Number(pledge.addonsAmount || 0);

      return [
        pledge.createdAt.toISOString().split("T")[0],
        `"${pledge.project.title.replace(/"/g, '""')}"`,
        `"${pledge.project.creator.name?.replace(/"/g, '""') || "Unknown"}"`,
        pledge.project.category,
        `"${pledge.reward?.title || "No reward"}"`,
        Number(pledge.amount).toFixed(2),
        Number(pledge.shippingAmount || 0).toFixed(2),
        Number(pledge.addonsAmount || 0).toFixed(2),
        total.toFixed(2),
        pledge.status,
        pledge.fulfillmentStatus,
      ];
    });

    // Calculate totals
    const totalPledged = pledges.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalShipping = pledges.reduce((sum, p) => sum + Number(p.shippingAmount || 0), 0);
    const totalAddons = pledges.reduce((sum, p) => sum + Number(p.addonsAmount || 0), 0);
    const grandTotal = totalPledged + totalShipping + totalAddons;

    rows.push([]);
    rows.push([
      "TOTALS",
      "",
      "",
      "",
      "",
      totalPledged.toFixed(2),
      totalShipping.toFixed(2),
      totalAddons.toFixed(2),
      grandTotal.toFixed(2),
      "",
      "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="crowdfunding-history-${new Date().toISOString().split("T")[0]}.csv"`,
        ...corsHeaders,
      },
    });
  } catch (error) {
    backerAnalyticsExportLogger.error({ err: String(error) }, "Error exporting analytics:");
    return NextResponse.json(
      { error: "Failed to export" },
      { status: 500, headers: corsHeaders }
    );
  }
}
