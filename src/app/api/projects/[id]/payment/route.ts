import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const projectsPaymentLogger = logger.child({ module: "projects-payment" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { checkProjectEditPermission } from "@/lib/project-permissions";

export const dynamic = "force-dynamic";

const paymentSchema = z.object({
  projectType: z.enum(["INDIVIDUAL", "BUSINESS", "NONPROFIT"]).optional(),
  // NMI is accepted as a legacy input value and silently transformed
  // to DIVINITYCOIN. The project builder loads the project's existing
  // paymentProcessor into its store and re-sends it on every save —
  // any legacy project still tagged "NMI" 400'd on every payment-step
  // save until this transform existed. The processor was decommissioned
  // when PaymentCloud cancelled the merchant account; DIVINITYCOIN is
  // the supported replacement, so coercing to DC on save is what the
  // creator actually wants (and matches the migrate-to-dc admin tool's
  // behavior).
  paymentProcessor: z
    .preprocess(
      // The builder re-sends the project's stored processor on every save.
      // A draft that never picked one sends "" or null, which the enum
      // rejects with a 400. Coerce empty/null to undefined (treated as a
      // no-op — the processor field is simply left unchanged).
      (v) => (v === "" || v === null ? undefined : v),
      z
        .enum(["STRIPE", "DIVINITYCOIN", "PAYPAL", "WHOP", "NMI"])
        .transform((v) => (v === "NMI" ? ("DIVINITYCOIN" as const) : v))
        .optional()
    ),
  campaignType: z.enum(["ALL_OR_NOTHING", "KEEP_IT_ALL"]).optional(),
  hasAdultContent: z.boolean().optional(),
  hasRiskyContent: z.boolean().optional(),
  promoContentSfw: z.boolean().optional(),
  allowRetailerPledges: z.boolean().optional(),
  retailerDiscount: z.number().min(0).max(100).optional(),
  retailerMinQuantity: z.number().int().min(1).optional(),
});

// POST - Update project payment settings
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = id;
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

    // For launched projects, only allow retailer settings changes (super admins can change anything)
    const isSuperAdmin = session.user.role === "SUPER_ADMIN";
    const launchedAllowedFields = [
      "allowRetailerPledges",
      "retailerDiscount",
      "retailerMinQuantity",
      // NSFW content flags can always be toggled — if flipping to NSFW on a live
      // project, we also auto-correct campaignType/paymentProcessor below.
      "hasAdultContent",
      "hasRiskyContent",
      "promoContentSfw",
      // campaignType is allowed on launched projects ONLY for upgrades to
      // KEEP_IT_ALL (validated below). This lets NSFW creators fix projects
      // that got stuck on ALL_OR_NOTHING from before the NSFW→KEEP_IT_ALL
      // auto-correction existed. We never allow downgrading KEEP_IT_ALL →
      // ALL_OR_NOTHING on a live project because that breaks backer
      // expectations and payment collection timing.
      "campaignType",
    ];

    if (permission.isLaunched && !isSuperAdmin) {
      const requestedFields = Object.keys(data).filter(key => data[key as keyof typeof data] !== undefined);
      const disallowedFields = requestedFields.filter(f => !launchedAllowedFields.includes(f));

      if (disallowedFields.length > 0) {
        return NextResponse.json(
          { error: `Cannot edit ${disallowedFields.join(", ")} on a launched campaign` },
          { status: 400 }
        );
      }

      // Block downgrading from KEEP_IT_ALL → ALL_OR_NOTHING on a launched
      // project. Leave no-op saves alone (client re-sends the current value
      // on every save, so blocking ALL_OR_NOTHING outright would break every
      // non-NSFW launched project's retailer settings save).
      if (data.campaignType === "ALL_OR_NOTHING") {
        const existing = await db.project.findFirst({
          where: { id: projectId, deletedAt: null },
          select: { campaignType: true },
        });
        if (existing?.campaignType === "KEEP_IT_ALL") {
          return NextResponse.json(
            { error: "Cannot change a launched campaign back to All or Nothing" },
            { status: 400 }
          );
        }
      }
    }

    // Get current project to check content flags
    const currentProject = await db.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { paymentProcessor: true, hasAdultContent: true, hasRiskyContent: true },
    });

    const updateData: Record<string, unknown> = {};

    if (data.projectType !== undefined) updateData.projectType = data.projectType;
    if (data.campaignType !== undefined) updateData.campaignType = data.campaignType;
    if (data.hasAdultContent !== undefined) updateData.hasAdultContent = data.hasAdultContent;
    if (data.hasRiskyContent !== undefined) updateData.hasRiskyContent = data.hasRiskyContent;
    if (data.promoContentSfw !== undefined) updateData.promoContentSfw = data.promoContentSfw;
    if (data.allowRetailerPledges !== undefined) updateData.allowRetailerPledges = data.allowRetailerPledges;
    if (data.retailerDiscount !== undefined) updateData.retailerDiscount = data.retailerDiscount;
    if (data.retailerMinQuantity !== undefined) updateData.retailerMinQuantity = data.retailerMinQuantity;

    // Handle explicit payment processor change
    if (data.paymentProcessor !== undefined) {
      // NSFW campaigns can NEVER switch to Stripe or PayPal
      const isNsfw = (data.hasAdultContent ?? currentProject?.hasAdultContent) ||
                     (data.hasRiskyContent ?? currentProject?.hasRiskyContent);
      if ((data.paymentProcessor === "STRIPE" || data.paymentProcessor === "PAYPAL") && isNsfw) {
        return NextResponse.json(
          { error: "Projects with adult or controversial content cannot use Stripe or PayPal" },
          { status: 400 }
        );
      }
      updateData.paymentProcessor = data.paymentProcessor;
    }

    // Automatically set payment processor and campaign type based on content flags
    // Adult or risky content cannot use Stripe/PayPal — must use DivinityCoin or Whop
    if (data.hasAdultContent !== undefined || data.hasRiskyContent !== undefined) {
      const hasAdult = data.hasAdultContent ?? currentProject?.hasAdultContent ?? false;
      const hasRisky = data.hasRiskyContent ?? currentProject?.hasRiskyContent ?? false;
      if (hasAdult || hasRisky) {
        // Force Keep It All campaign type for NSFW projects
        if (!updateData.campaignType) {
          updateData.campaignType = "KEEP_IT_ALL";
        }
        // Only force-switch if currently on a deprecated/disallowed
        // processor for NSFW (STRIPE, PAYPAL, or legacy NMI).
        // DIVINITYCOIN/WHOP stay as-is.
        const currentProcessor = currentProject?.paymentProcessor;
        if ((currentProcessor === "STRIPE" || currentProcessor === "PAYPAL" || currentProcessor === "NMI") && !updateData.paymentProcessor) {
          updateData.paymentProcessor = "DIVINITYCOIN";
        }
      }
    }

    const updated = await db.project.update({
      where: { id: projectId },
      data: updateData,
      select: {
        id: true,
        projectType: true,
        paymentProcessor: true,
        campaignType: true,
        hasAdultContent: true,
        hasRiskyContent: true,
        promoContentSfw: true,
        allowRetailerPledges: true,
        retailerDiscount: true,
        retailerMinQuantity: true,
      },
    });

    projectsPaymentLogger.info(`Project payment settings updated for ${projectId}`);

    return NextResponse.json({
      success: true,
      project: updated,
    });
  } catch (error) {
    projectsPaymentLogger.error({ err: formatError(error) }, "Update payment error:");

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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = id;
    const permissionCheck = await checkProjectEditPermission(projectId, session.user.id);

    if (!permissionCheck.allowed) {
      return NextResponse.json(
        { error: permissionCheck.error },
        { status: permissionCheck.status }
      );
    }

    const project = await db.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: {
        id: true,
        contactEmail: true,
        projectType: true,
        paymentProcessor: true,
        campaignType: true,
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
    projectsPaymentLogger.error({ err: formatError(error) }, "Get payment error:");
    return NextResponse.json(
      { error: "Failed to get payment settings" },
      { status: 500 }
    );
  }
}
