import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { checkProjectEditPermission } from "@/lib/project-permissions";

export const dynamic = "force-dynamic";

const paymentSchema = z.object({
  projectType: z.enum(["INDIVIDUAL", "BUSINESS", "NONPROFIT"]).optional(),
  hasAdultContent: z.boolean().optional(),
  hasRiskyContent: z.boolean().optional(),
  promoContentSfw: z.boolean().optional(),
  allowRetailerPledges: z.boolean().optional(),
  retailerDiscount: z.number().optional(),
  retailerMinQuantity: z.number().optional(),
});

// POST - Update project payment settings
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = params.id;
    const permissionCheck = await checkProjectEditPermission(projectId, session.user.id);

    if (!permissionCheck.allowed) {
      return NextResponse.json(
        { error: permissionCheck.error },
        { status: permissionCheck.status }
      );
    }

    const { permission } = permissionCheck;

    const body = await req.json();
    const data = paymentSchema.parse(body);

    // For launched projects, only allow retailer settings to be updated
    const launchedAllowedFields = ["allowRetailerPledges", "retailerDiscount", "retailerMinQuantity"];

    if (permission.isLaunched) {
      const requestedFields = Object.keys(data).filter(key => data[key as keyof typeof data] !== undefined);
      const disallowedFields = requestedFields.filter(f => !launchedAllowedFields.includes(f));

      if (disallowedFields.length > 0) {
        return NextResponse.json(
          { error: `Cannot edit ${disallowedFields.join(", ")} on a launched campaign` },
          { status: 400 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};

    if (data.projectType !== undefined) updateData.projectType = data.projectType;
    if (data.hasAdultContent !== undefined) updateData.hasAdultContent = data.hasAdultContent;
    if (data.hasRiskyContent !== undefined) updateData.hasRiskyContent = data.hasRiskyContent;
    if (data.promoContentSfw !== undefined) updateData.promoContentSfw = data.promoContentSfw;
    if (data.allowRetailerPledges !== undefined) updateData.allowRetailerPledges = data.allowRetailerPledges;
    if (data.retailerDiscount !== undefined) updateData.retailerDiscount = data.retailerDiscount;
    if (data.retailerMinQuantity !== undefined) updateData.retailerMinQuantity = data.retailerMinQuantity;

    // Automatically set payment processor based on content flags
    // Adult or risky content requires DivinityCoin, otherwise use Stripe
    if (data.hasAdultContent !== undefined || data.hasRiskyContent !== undefined) {
      const hasAdult = data.hasAdultContent ?? false;
      const hasRisky = data.hasRiskyContent ?? false;
      updateData.paymentProcessor = (hasAdult || hasRisky) ? "DIVINITYCOIN" : "STRIPE";
    }

    const updated = await db.project.update({
      where: { id: projectId },
      data: updateData,
      select: {
        id: true,
        projectType: true,
        paymentProcessor: true,
        hasAdultContent: true,
        hasRiskyContent: true,
        promoContentSfw: true,
        allowRetailerPledges: true,
        retailerDiscount: true,
        retailerMinQuantity: true,
      },
    });

    console.log(`Project payment settings updated for ${projectId}`);

    return NextResponse.json({
      success: true,
      project: updated,
    });
  } catch (error) {
    console.error("Update payment error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid data" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update payment settings" },
      { status: 500 }
    );
  }
}

// GET - Get project payment settings
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = params.id;
    const permissionCheck = await checkProjectEditPermission(projectId, session.user.id);

    if (!permissionCheck.allowed) {
      return NextResponse.json(
        { error: permissionCheck.error },
        { status: permissionCheck.status }
      );
    }

    const project = await db.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        contactEmail: true,
        projectType: true,
        paymentProcessor: true,
        hasAdultContent: true,
        hasRiskyContent: true,
        promoContentSfw: true,
        allowRetailerPledges: true,
        retailerDiscount: true,
        retailerMinQuantity: true,
      },
    });

    return NextResponse.json(project);
  } catch (error) {
    console.error("Get payment error:", error);
    return NextResponse.json(
      { error: "Failed to get payment settings" },
      { status: 500 }
    );
  }
}
