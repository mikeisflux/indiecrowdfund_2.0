import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

export const dynamic = "force-dynamic";

const JWT_SECRET = new TextEncoder().encode(
  process.env.RETAILER_JWT_SECRET || "retailer-secret-key-change-in-production"
);

// Helper to verify retailer authentication
async function verifyRetailer() {
  const cookieStore = await cookies();
  const token = cookieStore.get("retailer_token")?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { retailerId: string; email: string };
  } catch {
    return null;
  }
}

// GET - Get retailer's invoices (derived from orders with invoice numbers)
export async function GET(req: NextRequest) {
  try {
    const retailerData = await verifyRetailer();

    if (!retailerData) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status");
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {
      retailerId: retailerData.retailerId,
      invoiceNumber: { not: null },
    };

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
