import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Map database activity types to display types
const activityTypeMap: Record<string, string> = {
  SURVEY_SENT: "survey_reminder",
  SURVEY_REMINDER: "survey_reminder",
  SURVEY_COMPLETED: "survey_completed",
  ORDERS_LOCKED: "orders_pushed",
  ADDRESSES_LOCKED: "address_updated",
  CARDS_CHARGED: "cards_charged",
  CHARGE_FAILED: "charge_failed",
  ORDERS_PUSHED: "orders_pushed",
  PUSH_FAILED: "charge_failed",
  ORDER_SHIPPED: "order_shipped",
  ORDER_DELIVERED: "order_shipped",
  DIGITAL_DISTRIBUTED: "digital_download",
  ADDRESS_UPDATED: "address_updated",
  REFUND_ISSUED: "refund",
  NOTE_ADDED: "comment",
  BALANCE_ADJUSTED: "cards_charged",
};

// GET - Get timeline entries for a project
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const activityFilter = searchParams.get("filter") || "all";
    const dateRange = searchParams.get("dateRange") || "30days";

    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 });
    }

    // Verify access
    const project = await db.project.findFirst({
      where: {
        id: projectId,
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

    // Calculate date filter
    let dateFilter: Date | undefined;
    const now = new Date();
    switch (dateRange) {
      case "7days":
        dateFilter = new Date(now.setDate(now.getDate() - 7));
        break;
      case "30days":
        dateFilter = new Date(now.setDate(now.getDate() - 30));
        break;
      case "90days":
        dateFilter = new Date(now.setDate(now.getDate() - 90));
        break;
      default:
        dateFilter = undefined;
    }

    // Build type filter
    let typeFilter: string[] | undefined;
    switch (activityFilter) {
      case "survey":
        typeFilter = ["SURVEY_SENT", "SURVEY_REMINDER", "SURVEY_COMPLETED"];
        break;
      case "payment":
        typeFilter = ["CARDS_CHARGED", "CHARGE_FAILED", "REFUND_ISSUED", "BALANCE_ADJUSTED"];
        break;
      case "shipping":
        typeFilter = ["ORDERS_PUSHED", "PUSH_FAILED", "ORDER_SHIPPED", "ORDER_DELIVERED"];
        break;
      case "digital":
        typeFilter = ["DIGITAL_DISTRIBUTED"];
        break;
      case "address":
        typeFilter = ["ADDRESS_UPDATED", "ADDRESSES_LOCKED"];
        break;
      default:
        typeFilter = undefined;
    }

    const activities = await db.fulfillmentActivity.findMany({
      where: {
        projectId,
        ...(dateFilter && { createdAt: { gte: dateFilter } }),
        ...(typeFilter && { type: { in: typeFilter as any[] } }),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    // Group by date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const formattedEntries = activities.map(activity => {
      const activityDate = new Date(activity.createdAt);
      activityDate.setHours(0, 0, 0, 0);

      let dateLabel: string;
      if (activityDate.getTime() === today.getTime()) {
        dateLabel = "TODAY";
      } else if (activityDate.getTime() === yesterday.getTime()) {
        dateLabel = "YESTERDAY";
      } else {
        dateLabel = activity.createdAt.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        }).toUpperCase();
      }

      return {
        id: activity.id,
        type: activityTypeMap[activity.type] || "comment",
        time: activity.createdAt.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }),
        title: activity.title,
        detail: activity.description || "",
        date: dateLabel,
        metadata: activity.metadata,
      };
    });

    return NextResponse.json({ entries: formattedEntries });
  } catch (error) {
    console.error("IndieKit timeline fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch timeline" },
      { status: 500 }
    );
  }
}
