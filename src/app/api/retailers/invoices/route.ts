import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateRetailerRequest } from "@/lib/retailer-auth";

export const dynamic = "force-dynamic";

// GET - Get retailer's invoices (derived from orders with invoice numbers)
export async function GET(req: NextRequest) {
  try {
    const authResult = await authenticateRetailerRequest();

    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error || "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    // Validate pagination parameters
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20") || 20));
    const status = searchParams.get("status");
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {
      invoiceNumber: { not: null },
    };

    // Super admins see all invoices, regular retailers see only their own
    if (!authResult.isSuperAdmin && authResult.retailerId) {
      where.retailerId = authResult.retailerId;
    }

    // Map invoice status to order status
    if (status && status !== "all") {
      if (status === "PAID") {
        where.status = { in: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] };
      } else if (status === "PENDING") {
        where.status = { in: ["PENDING", "INVOICED"] };
      } else if (status === "OVERDUE") {
        // Orders that are pending/invoiced and created more than 30 days ago
        where.status = { in: ["PENDING", "INVOICED"] };
        where.createdAt = { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
      }
    }

    const [orders, total] = await Promise.all([
      db.retailerPledge.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          project: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      }),
      db.retailerPledge.count({ where }),
    ]);

    // Transform orders to invoice format
    interface RetailerOrderForInvoice {
      id: string;
      invoiceNumber: string | null;
      project: {
        id: string;
        title: string;
      };
      totalAmount: number;
      shippingCost: number;
      status: string;
      createdAt: Date;
      paidAt: Date | null;
    }

    const invoices = orders.map((order: RetailerOrderForInvoice) => {
      // Determine invoice status based on order status
      let invoiceStatus = "PENDING";
      if (["PAID", "PROCESSING", "SHIPPED", "DELIVERED"].includes(order.status)) {
        invoiceStatus = "PAID";
      } else if (order.status === "CANCELLED") {
        invoiceStatus = "CANCELLED";
      } else if (order.createdAt < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) {
        invoiceStatus = "OVERDUE";
      }

      // Due date is 30 days after creation
      const dueDate = new Date(order.createdAt);
      dueDate.setDate(dueDate.getDate() + 30);

      return {
        id: order.id,
        invoiceNumber: order.invoiceNumber,
        projectId: order.project.id,
        projectTitle: order.project.title,
        amount: order.totalAmount + order.shippingCost,
        status: invoiceStatus,
        dueDate: dueDate.toISOString(),
        createdAt: order.createdAt.toISOString(),
        paidAt: order.paidAt?.toISOString() || null,
      };
    });

    return NextResponse.json({
      invoices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching retailer invoices:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoices" },
      { status: 500 }
    );
  }
}
