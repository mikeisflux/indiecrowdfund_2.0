import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateRetailerRequest } from "@/lib/retailer-auth";

// Generate invoice number
function generateInvoiceNumber(): string {
  const prefix = "RTL";
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

// GET - Get retailer's orders
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
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status");
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    // Super admins see all orders, regular retailers see only their own
    if (!authResult.isSuperAdmin && authResult.retailerId) {
      where.retailerId = authResult.retailerId;
    }

    if (status && status !== "all") {
      where.status = status;
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
              imageUrl: true,
              category: true,
              creator: {
                select: { name: true },
              },
            },
          },
        },
      }),
      db.retailerPledge.count({ where }),
    ]);

    interface RetailerOrder {
      id: string;
      invoiceNumber: string | null;
      project: {
        id: string;
        title: string;
        imageUrl: string | null;
        category: string | null;
        creator: { name: string | null } | null;
      };
      quantity: number;
      unitPrice: number;
      discountPercent: number;
      totalAmount: number;
      originalAmount: number;
      shippingCost: number;
      status: string;
      fulfillmentStatus: string;
      trackingNumber: string | null;
      purchaseOrderNumber: string | null;
      createdAt: Date;
      paidAt: Date | null;
      shippedAt: Date | null;
      deliveredAt: Date | null;
    }

    return NextResponse.json({
      orders: orders.map((order: RetailerOrder) => ({
        id: order.id,
        invoiceNumber: order.invoiceNumber,
        projectId: order.project.id,
        projectTitle: order.project.title,
        projectImage: order.project.imageUrl,
        projectCategory: order.project.category,
        creatorName: order.project.creator?.name,
        quantity: order.quantity,
        unitPrice: order.unitPrice,
        discountPercent: order.discountPercent,
        totalAmount: order.totalAmount,
        originalAmount: order.originalAmount,
        shippingCost: order.shippingCost,
        status: order.status,
        fulfillmentStatus: order.fulfillmentStatus,
        trackingNumber: order.trackingNumber,
        purchaseOrderNumber: order.purchaseOrderNumber,
        createdAt: order.createdAt.toISOString(),
        paidAt: order.paidAt?.toISOString(),
        shippedAt: order.shippedAt?.toISOString(),
        deliveredAt: order.deliveredAt?.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching retailer orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}

// POST - Create a new wholesale order
export async function POST(req: NextRequest) {
  try {
    const authResult = await authenticateRetailerRequest();

    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error || "Unauthorized" },
        { status: 401 }
      );
    }

    // Super admins cannot create orders
    if (authResult.isSuperAdmin) {
      return NextResponse.json(
        { error: "Admins cannot create orders in preview mode" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { projectId, items, purchaseOrderNumber, notes, shippingAddress } = body;

    if (!projectId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Project ID and order items are required" },
        { status: 400 }
      );
    }

    // Get the retailer
    const retailer = await db.retailer.findUnique({
      where: { id: authResult.retailerId },
    });

    if (!retailer || retailer.status !== "APPROVED") {
      return NextResponse.json(
        { error: "Invalid or inactive retailer account" },
        { status: 403 }
      );
    }

    // Get the project
    const project = await db.project.findUnique({
      where: { id: projectId },
      include: {
        rewards: true,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    if (!project.allowRetailerPledges) {
      return NextResponse.json(
        { error: "This project does not accept retailer orders" },
        { status: 400 }
      );
    }

    if (project.status !== "LIVE") {
      return NextResponse.json(
        { error: "This project is not currently accepting orders" },
        { status: 400 }
      );
    }

    // Calculate totals
    let totalQuantity = 0;
    let totalOriginalAmount = 0;
    let totalWholesaleAmount = 0;
    const orderItems: Array<{
      rewardId: string;
      rewardTitle: string;
      quantity: number;
      originalPrice: number;
      wholesalePrice: number;
    }> = [];

    for (const item of items) {
      const reward = project.rewards.find((r: { id: string }) => r.id === item.rewardId);
      if (!reward) {
        return NextResponse.json(
          { error: `Reward not found: ${item.rewardId}` },
          { status: 400 }
        );
      }

      const quantity = parseInt(item.quantity);
      if (isNaN(quantity) || quantity <= 0) {
        return NextResponse.json(
          { error: "Invalid quantity" },
          { status: 400 }
        );
      }

      const originalPrice = reward.amount;
      const wholesalePrice = originalPrice * (1 - project.retailerDiscount / 100);

      totalQuantity += quantity;
      totalOriginalAmount += originalPrice * quantity;
      totalWholesaleAmount += wholesalePrice * quantity;

      orderItems.push({
        rewardId: reward.id,
        rewardTitle: reward.title,
        quantity,
        originalPrice,
        wholesalePrice,
      });
    }

    // Validate quantity limits
    if (totalQuantity < project.retailerMinQuantity) {
      return NextResponse.json(
        {
          error: `Minimum order quantity is ${project.retailerMinQuantity} units`,
          minQuantity: project.retailerMinQuantity,
          currentQuantity: totalQuantity,
        },
        { status: 400 }
      );
    }

    if (project.retailerMaxQuantity && totalQuantity > project.retailerMaxQuantity) {
      return NextResponse.json(
        {
          error: `Maximum order quantity is ${project.retailerMaxQuantity} units`,
          maxQuantity: project.retailerMaxQuantity,
          currentQuantity: totalQuantity,
        },
        { status: 400 }
      );
    }

    // Calculate shipping (simplified - in production, use actual shipping calculations)
    const shippingCost = totalWholesaleAmount >= 500 ? 0 : 25;

    // Create the order(s) - one per reward type
    const createdOrders = await db.$transaction(
      orderItems.map((item) =>
        db.retailerPledge.create({
          data: {
            retailerId: retailer.id,
            projectId: project.id,
            rewardId: item.rewardId,
            quantity: item.quantity,
            unitPrice: item.wholesalePrice,
            discountPercent: project.retailerDiscount,
            totalAmount: item.wholesalePrice * item.quantity,
            originalAmount: item.originalPrice * item.quantity,
            status: "PENDING",
            invoiceNumber: generateInvoiceNumber(),
            purchaseOrderNumber: purchaseOrderNumber || null,
            shippingAddress: shippingAddress || {
              address: retailer.address,
              city: retailer.city,
              state: retailer.state,
              zipCode: retailer.zipCode,
              country: retailer.country,
            },
            shippingCost: shippingCost / orderItems.length, // Split shipping across items
            fulfillmentNotes: notes || null,
            fulfillmentStatus: "NOT_STARTED",
          },
        })
      )
    );

    // In production: Send order confirmation email
    // await sendRetailerOrderConfirmation({
    //   to: retailer.email,
    //   orders: createdOrders,
    //   project,
    // });

    // In production: Notify project creator
    // await notifyCreatorOfRetailerOrder(project.creatorId, createdOrders);

    return NextResponse.json({
      success: true,
      message: "Order placed successfully",
      orders: createdOrders.map((order: { id: string; invoiceNumber: string | null; totalAmount: number; status: string }) => ({
        id: order.id,
        invoiceNumber: order.invoiceNumber,
        totalAmount: order.totalAmount,
        status: order.status,
      })),
      summary: {
        totalQuantity,
        originalAmount: totalOriginalAmount,
        wholesaleAmount: totalWholesaleAmount,
        savings: totalOriginalAmount - totalWholesaleAmount,
        shippingCost,
        grandTotal: totalWholesaleAmount + shippingCost,
      },
    });
  } catch (error) {
    console.error("Error creating retailer order:", error);
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 }
    );
  }
}
