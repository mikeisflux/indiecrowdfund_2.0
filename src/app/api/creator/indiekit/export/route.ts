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

        // Build CSV
        const headers = [
          "Backer Number",
          "Name",
          "Email",
          "Reward",
          "Pledge Amount",
          "Add-ons",
          "Add-on Total",
          "Total",
          "Survey Status",
          "Shipping Name",
          "Address Line 1",
          "Address Line 2",
          "City",
          "State",
          "Postal Code",
          "Country",
          "Fulfillment Status",
          "Pledge Date",
        ];

        csvContent = headers.join(",") + "\n";

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

          const row = [
            pledge.backerNumber || "",
            escapeCSV(pledge.user.name || ""),
            escapeCSV(pledge.user.email || ""),
            escapeCSV(pledge.reward?.title || "No Reward"),
            Number(pledge.amount).toFixed(2),
            escapeCSV(addonsText),
            addonsTotal.toFixed(2),
            (Number(pledge.amount) + addonsTotal).toFixed(2),
            sr?.isComplete ? "Complete" : "Pending",
            escapeCSV(address?.name || ""),
            escapeCSV(address?.line1 || ""),
            escapeCSV(address?.line2 || ""),
            escapeCSV(address?.city || ""),
            escapeCSV(address?.state || ""),
            escapeCSV(address?.postalCode || ""),
            escapeCSV(address?.country || ""),
            pledge.fulfillmentStatus || "NOT_STARTED",
            pledge.createdAt.toISOString().split("T")[0],
          ];

          csvContent += row.join(",") + "\n";
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
