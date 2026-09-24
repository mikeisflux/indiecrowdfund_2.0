import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const creatorIndiekitExportLogger = logger.child({ module: "creator-indiekit-export" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolvePledgeShippingAddress } from "@/lib/fulfillment/shipping-address";

export const dynamic = "force-dynamic";

// GET - Export IndieKit data as CSV
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const exportType = searchParams.get("type") || "backers";

    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    // Verify user has access to this project
    const project = await db.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
        OR: [
          { creatorId: session.user.id },
          {
            collaborators: {
              some: {
                userId: session.user.id,
                status: "ACCEPTED",
              },
            },
          },
        ],
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 403 });
    }

    // ?history=1 — recent exports for the Reports > Export panel.
    if (searchParams.get("history") === "1") {
      const activities = await db.fulfillmentActivity.findMany({
        where: { projectId, type: "DATA_EXPORTED" },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, title: true, metadata: true, createdAt: true },
      });
      return NextResponse.json({
        history: activities.map((a: { id: string; title: string; metadata: unknown; createdAt: Date }) => {
          const meta = (a.metadata as Record<string, unknown>) || {};
          return {
            id: a.id,
            name: a.title,
            type: String(meta.exportType || "backers"),
            format: String(meta.format || "CSV"),
            recordCount: Number(meta.recordCount || 0),
            createdAt: a.createdAt.toISOString(),
            status: "completed" as const,
          };
        }),
      });
    }

    // Column selection for the backers export ("Include Fields" on the
    // Export tab — previously collected and never sent).
    const fieldsParam = searchParams.get("fields");
    const selected = new Set(
      (fieldsParam ? fieldsParam.split(",") : [
        "name", "email", "address", "pledgeLevel", "items", "addons",
        "phone", "surveyAnswers", "paymentDetails",
      ]).map((f) => f.trim()).filter(Boolean)
    );

    let csvContent = "";
    let filename = "";

    switch (exportType) {
      case "backers": {
        // Get all pledges with user and survey data. Committed-PENDING
        // filter so CSV export covers the same backer set as the
        // IndieKit dashboard.
        const pledges = await db.pledge.findMany({
          where: {
            projectId,
            deletedAt: null,
            OR: [
              { status: "COMPLETED" },
              { status: "PENDING", confirmationEmailSent: true },
            ],
          },
          take: 50000,
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
            reward: {
              select: {
                title: true,
                amount: true,
              },
            },
            addons: {
              include: {
                addon: {
                  select: {
                    title: true,
                    amount: true,
                  },
                },
              },
            },
          },
          orderBy: { backerNumber: "asc" },
        });

        // Get survey responses
        const survey = await db.survey.findUnique({
          where: { projectId },
        });

        const surveyResponses = survey
          ? await db.surveyResponse.findMany({
              where: { surveyId: survey.id },
            })
          : [];

        const surveyMap = new Map(surveyResponses.map((sr) => [sr.pledgeId, sr]));

        // Build CSV — columns follow the tab's "Include Fields" choices.
        // Backer Number, Fulfillment Status, and Pledge Date always ship.
        type ColumnDef = { header: string; group: string };
        const allColumns: ColumnDef[] = [
          { header: "Backer Number", group: "always" },
          { header: "Name", group: "name" },
          { header: "Email", group: "email" },
          { header: "Phone", group: "phone" },
          { header: "Reward", group: "pledgeLevel" },
          { header: "Pledge Amount", group: "pledgeLevel" },
          { header: "Items", group: "items" },
          { header: "Add-ons", group: "addons" },
          { header: "Add-on Total", group: "addons" },
          { header: "Total", group: "paymentDetails" },
          { header: "Payment Processor", group: "paymentDetails" },
          { header: "Survey Status", group: "surveyAnswers" },
          { header: "Shipping Name", group: "address" },
          { header: "Address Line 1", group: "address" },
          { header: "Address Line 2", group: "address" },
          { header: "City", group: "address" },
          { header: "State", group: "address" },
          { header: "Postal Code", group: "address" },
          { header: "Country", group: "address" },
          { header: "Fulfillment Status", group: "always" },
          { header: "Pledge Date", group: "always" },
        ];
        const columns = allColumns.filter((c) => c.group === "always" || selected.has(c.group));

        csvContent = columns.map((c) => c.header).join(",") + "\n";

        for (const pledge of pledges) {
          const sr = surveyMap.get(pledge.id);
          // Fall back to the pledge's own address (Order Lock / checkout) and
          // normalize the field shapes so locked backers export cleanly.
          const address = resolvePledgeShippingAddress(sr?.shippingAddress, pledge.shippingAddress);

          const addonsText = pledge.addons
            .map((a: { addon: { title: string }; quantity: number }) => `${a.addon.title} x${a.quantity}`)
            .join("; ");
          const addonsTotal = pledge.addons.reduce(
            (sum: number, a: { addon: { amount: number }; quantity: number }) =>
              sum + Number(a.addon.amount) * a.quantity,
            0
          );
          const itemsText = [
            ...(pledge.reward ? [pledge.reward.title] : []),
            ...pledge.addons.map(
              (a: { addon: { title: string }; quantity: number }) =>
                a.quantity > 1 ? `${a.addon.title} x${a.quantity}` : a.addon.title
            ),
          ].join("; ");

          const values: Record<string, string | number> = {
            "Backer Number": pledge.backerNumber || "",
            "Name": escapeCSV(pledge.user.name || ""),
            "Email": escapeCSV(pledge.user.email || ""),
            "Phone": escapeCSV(address?.phone || ""),
            "Reward": escapeCSV(pledge.reward?.title || "No Reward"),
            "Pledge Amount": Number(pledge.amount).toFixed(2),
            "Items": escapeCSV(itemsText),
            "Add-ons": escapeCSV(addonsText),
            "Add-on Total": addonsTotal.toFixed(2),
            "Total": (Number(pledge.amount) + addonsTotal).toFixed(2),
            "Payment Processor": pledge.paymentProcessor || "",
            "Survey Status": sr?.isComplete ? "Complete" : "Pending",
            "Shipping Name": escapeCSV(address?.name || ""),
            "Address Line 1": escapeCSV(address?.line1 || ""),
            "Address Line 2": escapeCSV(address?.line2 || ""),
            "City": escapeCSV(address?.city || ""),
            "State": escapeCSV(address?.state || ""),
            "Postal Code": escapeCSV(address?.postalCode || ""),
            "Country": escapeCSV(address?.country || ""),
            "Fulfillment Status": pledge.fulfillmentStatus || "NOT_STARTED",
            "Pledge Date": pledge.createdAt.toISOString().split("T")[0],
          };

          csvContent += columns.map((c) => values[c.header] ?? "").join(",") + "\n";
        }

        filename = `backers-${project.slug}-${new Date().toISOString().split("T")[0]}.csv`;
        break;
      }

      case "addresses": {
        // Iterate every committed backer (not just survey responders) so
        // order-locked backers — whose address lives on the pledge, with no
        // SurveyResponse row — are included and normalized.
        const addrPledges = await db.pledge.findMany({
          where: {
            projectId,
            deletedAt: null,
            OR: [
              { status: "COMPLETED" },
              { status: "PENDING", confirmationEmailSent: true },
            ],
          },
          take: 50000,
          include: { user: { select: { name: true, email: true } } },
          orderBy: { backerNumber: "asc" },
        });

        const addrSurvey = await db.survey.findUnique({ where: { projectId } });
        const addrSurveyResponses = addrSurvey
          ? await db.surveyResponse.findMany({ where: { surveyId: addrSurvey.id } })
          : [];
        const addrSurveyMap = new Map(addrSurveyResponses.map((sr) => [sr.pledgeId, sr]));

        const headers = [
          "Name",
          "Email",
          "Shipping Name",
          "Address Line 1",
          "Address Line 2",
          "City",
          "State",
          "Postal Code",
          "Country",
        ];

        csvContent = headers.join(",") + "\n";

        for (const pledge of addrPledges) {
          const address = resolvePledgeShippingAddress(
            addrSurveyMap.get(pledge.id)?.shippingAddress,
            pledge.shippingAddress
          );
          if (!address) continue;

          const row = [
            escapeCSV(pledge.user.name || ""),
            escapeCSV(pledge.user.email || ""),
            escapeCSV(address.name),
            escapeCSV(address.line1),
            escapeCSV(address.line2),
            escapeCSV(address.city),
            escapeCSV(address.state),
            escapeCSV(address.postalCode),
            escapeCSV(address.country),
          ];

          csvContent += row.join(",") + "\n";
        }

        filename = `addresses-${project.slug}-${new Date().toISOString().split("T")[0]}.csv`;
        break;
      }

      case "surveys": {
        const survey = await db.survey.findUnique({
          where: { projectId },
        });

        if (!survey) {
          return NextResponse.json({ error: "No survey found" }, { status: 404 });
        }

        const surveyResponses = await db.surveyResponse.findMany({
          where: { surveyId: survey.id },
          include: {
            pledge: {
              include: {
                user: { select: { name: true, email: true } },
                reward: { select: { title: true } },
              },
            },
          },
        });

        const headers = [
          "Name",
          "Email",
          "Reward",
          "Survey Status",
          "Completed At",
          "Item Selections",
        ];

        csvContent = headers.join(",") + "\n";

        for (const sr of surveyResponses) {
          const selections = sr.itemSelections
            ? JSON.stringify(sr.itemSelections).slice(0, 200)
            : "";

          const row = [
            escapeCSV(sr.pledge.user.name || ""),
            escapeCSV(sr.pledge.user.email || ""),
            escapeCSV(sr.pledge.reward?.title || ""),
            sr.isComplete ? "Complete" : "Pending",
            sr.completedAt ? sr.completedAt.toISOString().split("T")[0] : "",
            escapeCSV(selections),
          ];

          csvContent += row.join(",") + "\n";
        }

        filename = `surveys-${project.slug}-${new Date().toISOString().split("T")[0]}.csv`;
        break;
      }

      default:
        return NextResponse.json({ error: "Invalid export type" }, { status: 400 });
    }

    // Record the export so "Recent Exports" reflects reality.
    const recordCount = Math.max(0, csvContent.split("\n").filter(Boolean).length - 1);
    await db.fulfillmentActivity
      .create({
        data: {
          projectId,
          type: "DATA_EXPORTED",
          title: filename,
          description: `${exportType} export (${recordCount} records)`,
          metadata: { exportType, format: "CSV", recordCount },
          userId: session.user.id,
        },
      })
      .catch(() => {});

    // Return CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    creatorIndiekitExportLogger.error({ err: formatError(error) }, "IndieKit export error:");
    return NextResponse.json({ error: "Failed to export data" }, { status: 500 });
  }
}

// Helper to escape CSV values
function escapeCSV(value: string): string {
  if (!value) return "";
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
