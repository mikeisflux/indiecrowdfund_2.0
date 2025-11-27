import { NextRequest, NextResponse } from "next/server";
import { getServerSession, authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// Generate a random access code
function generateAccessCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const segments = [];
  for (let s = 0; s < 3; s++) {
    let segment = "";
    for (let i = 0; i < 4; i++) {
      segment += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    segments.push(segment);
  }
  return segments.join("-");
}

// GET - Get retailer applications
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // In production, verify admin role
    // const user = await db.user.findUnique({ where: { id: session.user.id } });
    // if (user?.role !== "ADMIN") {
    //   return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    // }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "PENDING";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status !== "all") {
      where.status = status;
    }

    const [retailers, total, statusCounts] = await Promise.all([
      db.retailer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          businessName: true,
          businessType: true,
          contactName: true,
          email: true,
          phone: true,
          address: true,
          city: true,
          state: true,
          zipCode: true,
          country: true,
          taxId: true,
          taxIdType: true,
          resaleCertificate: true,
          yearsInBusiness: true,
          numberOfLocations: true,
          annualRevenue: true,
          websiteUrl: true,
          status: true,
          verificationNotes: true,
          verifiedAt: true,
          accessCode: true,
          createdAt: true,
          _count: {
            select: {
              pledges: true,
            },
          },
        },
      }),
      db.retailer.count({ where }),
      Promise.all([
        db.retailer.count({ where: { status: "PENDING" } }),
        db.retailer.count({ where: { status: "UNDER_REVIEW" } }),
        db.retailer.count({ where: { status: "APPROVED" } }),
        db.retailer.count({ where: { status: "REJECTED" } }),
        db.retailer.count({ where: { status: "SUSPENDED" } }),
      ]),
    ]);

    return NextResponse.json({
      retailers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        pending: statusCounts[0],
        underReview: statusCounts[1],
        approved: statusCounts[2],
        rejected: statusCounts[3],
        suspended: statusCounts[4],
      },
    });
  } catch (error) {
    console.error("Error fetching retailers:", error);
    return NextResponse.json(
      { error: "Failed to fetch retailers" },
      { status: 500 }
    );
  }
}

// PATCH - Update retailer status
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { retailerId, action, notes } = body;

    if (!retailerId || !action) {
      return NextResponse.json(
        { error: "Retailer ID and action are required" },
        { status: 400 }
      );
    }

    const retailer = await db.retailer.findUnique({
      where: { id: retailerId },
    });

    if (!retailer) {
      return NextResponse.json(
        { error: "Retailer not found" },
        { status: 404 }
      );
    }

    let updateData: any = {
      verificationNotes: notes || null,
    };

    switch (action) {
      case "APPROVE":
        updateData.status = "APPROVED";
        updateData.verifiedAt = new Date();
        updateData.verifiedBy = session.user.id;
        // Generate access code if not exists
        if (!retailer.accessCode) {
          updateData.accessCode = generateAccessCode();
        }
        break;

      case "REJECT":
        updateData.status = "REJECTED";
        break;

      case "REQUEST_INFO":
        updateData.status = "UNDER_REVIEW";
        break;

      case "SUSPEND":
        updateData.status = "SUSPENDED";
        break;

      case "REACTIVATE":
        updateData.status = "APPROVED";
        break;

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }

    const updatedRetailer = await db.retailer.update({
      where: { id: retailerId },
      data: updateData,
    });

    // In production: Send notification email based on action
    // if (action === "APPROVE") {
    //   await sendRetailerApprovalEmail({
    //     to: retailer.email,
    //     businessName: retailer.businessName,
    //     accessCode: updateData.accessCode || retailer.accessCode,
    //   });
    // } else if (action === "REJECT") {
    //   await sendRetailerRejectionEmail({
    //     to: retailer.email,
    //     businessName: retailer.businessName,
    //     reason: notes,
    //   });
    // }

    return NextResponse.json({
      success: true,
      retailer: updatedRetailer,
    });
  } catch (error) {
    console.error("Error updating retailer:", error);
    return NextResponse.json(
      { error: "Failed to update retailer" },
      { status: 500 }
    );
  }
}
