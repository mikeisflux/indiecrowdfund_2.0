import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const surveysRespondLogger = logger.child({ module: "surveys-respond" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

// Lenient address schema for progress saves (allows empty strings)
const addressSchemaPartial = z.object({
  name: z.string().max(100),
  line1: z.string().max(200),
  line2: z.string().max(200).optional().nullable(),
  city: z.string().max(100),
  state: z.string().max(100),
  postalCode: z.string().max(20),
  country: z.string().max(10),
  phone: z.string().max(30).optional().nullable(),
});

// Strict address schema for final submission
const addressSchemaStrict = z.object({
  name: z.string().min(1, "Name is required").max(100),
  line1: z.string().min(1, "Address is required").max(200),
  line2: z.string().max(200).optional().nullable(),
  city: z.string().min(1, "City is required").max(100),
  state: z.string().min(1, "State is required").max(100),
  postalCode: z.string().min(1, "Postal code is required").max(20),
  country: z.string().min(1, "Country is required").max(10),
  phone: z.string().max(30).optional().nullable(),
});

const responseValueSchema = z.union([z.string().max(10000), z.array(z.string().max(500)).max(50)]);

const responseSchema = z.object({
  itemResponses: z.record(
    z.string().max(100),
    z.object({
      variants: z.record(z.string().max(100), z.string().max(500)).optional(),
      customAnswers: z.record(z.string().max(100), responseValueSchema).optional(),
    })
  ).refine(r => Object.keys(r).length <= 200, "Too many item responses").optional(),
  backerResponses: z.record(z.string().max(100), responseValueSchema)
    .refine(r => Object.keys(r).length <= 100, "Too many backer responses").optional(),
  shippingAddress: addressSchemaPartial.optional().nullable(),
  selectedAddons: z.record(z.string().max(100), z.number().int().min(0))
    .refine(r => Object.keys(r).length <= 50, "Too many addons").optional(),
  submit: z.boolean().default(false), // If true, mark as complete
});

// GET - Get survey for a pledge (backer view)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pledgeId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { pledgeId } = await params;

    // Get pledge and verify ownership
    const pledge = await db.pledge.findFirst({
      where: { id: pledgeId, deletedAt: null },
      include: {
        project: {
          select: { id: true, title: true, imageUrl: true, paymentProcessor: true, slug: true },
        },
        reward: {
          select: { id: true, title: true },
        },
        addons: {
          include: {
            addon: {
              select: { id: true, title: true },
            },
          },
        },
      },
    });

    if (!pledge) {
      return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
    }

    if (pledge.userId !== session.user.id) {
      surveysRespondLogger.warn(
        {
          pledgeId,
          sessionUserId: session.user.id,
          pledgeUserId: pledge.userId,
          projectId: pledge.projectId,
        },
        "Survey GET forbidden: session user does not own pledge"
      );
      return NextResponse.json(
        {
          error:
            "This survey is for a different account. Please log out and sign in with the email you used when you backed this project.",
        },
        { status: 403 }
      );
    }

    // Non-COMPLETED pledges (PENDING/FAILED/REFUNDED/CANCELLED/CHARGEBACK) are not backers.
    // Deny them access to the survey form so they can't submit responses either.
    if (pledge.status !== "COMPLETED") {
      surveysRespondLogger.warn(
        {
          pledgeId,
          pledgeStatus: pledge.status,
          userId: pledge.userId,
          projectId: pledge.projectId,
        },
        "Survey GET forbidden: pledge is not COMPLETED"
      );
      return NextResponse.json(
        { error: "This survey is only available to backers with a completed pledge." },
        { status: 403 }
      );
    }

    // Get survey for this project
    const survey = await db.survey.findUnique({
      where: { projectId: pledge.projectId },
      include: {
        itemQuestions: {
          include: {
            variants: { orderBy: { sortOrder: "asc" } },
            customQuestions: { orderBy: { sortOrder: "asc" } },
          },
          orderBy: { sortOrder: "asc" },
        },
        backerQuestions: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!survey) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    // Defensive dedupe: if a creator's old data has two SurveyItemVariant
    // rows with the same variantType on the same itemQuestion (e.g.,
    // two "Size" rows from a pre-fix duplicate), keep the first by
    // sortOrder. Without this the backer sees two identical "Size"
    // dropdowns, fills one, and submission fails with "Please select a
    // Size" because the unfilled duplicate is still empty.
    for (const itemQ of survey.itemQuestions) {
      const seen = new Set<string>();
      itemQ.variants = itemQ.variants.filter((v: { variantType: string }) => {
        const key = v.variantType.trim().toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    if (survey.status === "DRAFT") {
      return NextResponse.json(
        { error: "Survey has not been sent yet" },
        { status: 400 }
      );
    }

    // Get or create response. Use upsert so two concurrent GETs (e.g.
    // backer double-clicks the survey link or hits it from two tabs)
    // don't race past findUnique and then both hit P2002 on the unique
    // pledgeId. The previous find-then-create pattern leaked a 500 to
    // the second request even though there was nothing wrong to do.
    const response = await db.surveyResponse.upsert({
      where: { pledgeId },
      create: {
        surveyId: survey.id,
        pledgeId,
        isComplete: false,
      },
      update: {},
    });

    // Filter item questions to only show those relevant to this backer's reward
    const relevantItemQuestions = survey.itemQuestions.filter(
      (iq: { rewardId: string }) => iq.rewardId === pledge.rewardId
    );

    // Also include item questions for any addons
    const addonIds = pledge.addons.map((a: { addonId: string }) => a.addonId);
    const addonItemQuestions = survey.itemQuestions.filter(
      (iq: { rewardId: string }) => addonIds.includes(iq.rewardId)
    );

    // Filter backer questions based on targeting
    const relevantBackerQuestions = survey.backerQuestions.filter(
      (bq: { targetType: string; targetRewardIds: string[] }) => {
        if (bq.targetType === "ALL_BACKERS") return true;
        if (bq.targetType === "SPECIFIC_REWARDS") {
          return (
            bq.targetRewardIds.includes(pledge.rewardId) ||
            bq.targetRewardIds.some((id: string) => addonIds.includes(id))
          );
        }
        return false;
      }
    );

    // Determine if pledge requires physical shipping
    // A pledge needs shipping only if the main reward OR any of its addons require shipping.
    // pledge.rewardId is null for a "No Reward" pledge — guard it so findUnique
    // (which rejects a null id) doesn't 500 the survey, and treat a missing
    // reward as contributing no shipping requirement.
    const rewardWithShipping = pledge.rewardId
      ? await db.reward.findUnique({
          where: { id: pledge.rewardId },
          select: { shippingType: true },
        })
      : null;

    const addonRewards = addonIds.length > 0
      ? await db.reward.findMany({
          where: { id: { in: addonIds } },
          select: { shippingType: true },
        })
      : [];

    const requiresShipping =
      (!!pledge.rewardId && rewardWithShipping?.shippingType !== "NO_SHIPPING") ||
      addonRewards.some(a => a.shippingType !== "NO_SHIPPING");

    // Get available addons for this project that the backer can purchase
    const availableAddons = await db.reward.findMany({
      where: {
        projectId: pledge.projectId,
        type: "ADDON",
        isEnded: false,
      },
      select: {
        id: true,
        title: true,
        description: true,
        amount: true,
        quantityAvailable: true,
        quantityClaimed: true,
        imageUrl: true,
      },
      orderBy: [{ displayOrder: { sort: "asc", nulls: "last" } }, { amount: "asc" }],
    });

    // Filter out sold out addons and format for frontend
    const purchasableAddons = availableAddons
      .filter(addon => {
        if (addon.quantityAvailable === null) return true; // Unlimited
        return addon.quantityClaimed < addon.quantityAvailable;
      })
      .map(addon => ({
        id: addon.id,
        title: addon.title,
        description: addon.description,
        price: Number(addon.amount),
        imageUrl: addon.imageUrl,
        quantityAvailable: addon.quantityAvailable ? addon.quantityAvailable - addon.quantityClaimed : null,
        alreadyPurchased: addonIds.includes(addon.id),
      }));

    return NextResponse.json({
      survey: {
        id: survey.id,
        introTitle: survey.introTitle,
        introMessage: survey.introMessage,
        collectAddresses: survey.collectAddresses,
        status: survey.status,
        addressesLocked: survey.addressesLocked,
        requiresShipping,
      },
      pledge: {
        id: pledge.id,
        projectId: pledge.projectId,
        projectTitle: pledge.project.title,
        projectImage: pledge.project.imageUrl,
        projectSlug: pledge.project.slug,
        paymentProcessor: pledge.project.paymentProcessor || "STRIPE",
        rewardTitle: pledge.reward?.title || "No Reward",
        addons: pledge.addons.map((a: { addon: { id: string; title: string } }) => ({
          id: a.addon.id,
          title: a.addon.title,
        })),
      },
      itemQuestions: [...relevantItemQuestions, ...addonItemQuestions],
      backerQuestions: relevantBackerQuestions,
      availableAddons: purchasableAddons,
      response: {
        itemResponses: response.itemResponses,
        backerResponses: response.backerResponses,
        shippingAddress: response.shippingAddress,
        isComplete: response.isComplete,
        addressLocked: response.addressLocked,
        selectedAddons: {},
      },
    });
  } catch (error) {
    surveysRespondLogger.error({ err: formatError(error) }, "Error fetching survey:");
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to fetch survey: ${errorMessage}` },
      { status: 500 }
    );
  }
}

// POST - Submit/update survey response
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pledgeId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { pledgeId } = await params;

    // Get pledge and verify ownership
    const pledge = await db.pledge.findFirst({
      where: { id: pledgeId, deletedAt: null },
      include: {
        addons: true,
      },
    });

    if (!pledge) {
      return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
    }

    if (pledge.userId !== session.user.id) {
      surveysRespondLogger.warn(
        {
          pledgeId,
          sessionUserId: session.user.id,
          pledgeUserId: pledge.userId,
          projectId: pledge.projectId,
        },
        "Survey POST forbidden: session user does not own pledge"
      );
      return NextResponse.json(
        {
          error:
            "This survey is for a different account. Please log out and sign in with the email you used when you backed this project.",
        },
        { status: 403 }
      );
    }

    // Order lock freeze: once a backer has locked their order it can no
    // longer be changed (address / rewards / add-ons are final for print).
    if (pledge.orderLockStatus === "LOCKED") {
      return NextResponse.json(
        { error: "Your order is locked and can no longer be changed." },
        { status: 403 }
      );
    }

    // Only backers with a fully COMPLETED pledge may submit survey responses.
    // PENDING/FAILED/REFUNDED/CANCELLED/CHARGEBACK pledges are not real backers
    // and must be blocked at the response endpoint.
    if (pledge.status !== "COMPLETED") {
      surveysRespondLogger.warn(
        {
          pledgeId,
          pledgeStatus: pledge.status,
          userId: pledge.userId,
          projectId: pledge.projectId,
        },
        "Survey POST forbidden: pledge is not COMPLETED"
      );
      return NextResponse.json(
        { error: "Survey submissions require a completed pledge." },
        { status: 403 }
      );
    }

    // Get survey
    const survey = await db.survey.findUnique({
      where: { projectId: pledge.projectId },
      include: {
        itemQuestions: {
          include: {
            variants: true,
            customQuestions: true,
          },
        },
        backerQuestions: true,
      },
    });

    if (!survey) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    // Same defensive dedupe as GET: if old creator data has two
    // SurveyItemVariant rows with the same variantType on one
    // itemQuestion, the duplicate would still fire "Please select
    // a Size" here because the backer's response only fills one
    // copy. GET dedupes for rendering but POST has its own load
    // -- without dedup here, the backer can fill what the UI shows
    // and still get blocked at submit.
    for (const itemQ of survey.itemQuestions) {
      const seen = new Set<string>();
      itemQ.variants = itemQ.variants.filter((v: { variantType: string }) => {
        const key = v.variantType.trim().toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    if (survey.status === "DRAFT") {
      return NextResponse.json(
        { error: "Survey has not been sent yet" },
        { status: 400 }
      );
    }

    if (survey.status === "LOCKED") {
      return NextResponse.json(
        { error: "This survey has been locked by the creator and can no longer be edited." },
        { status: 400 }
      );
    }

    // Get existing response with a select-for-update pattern to prevent concurrent submissions
    const existingResponse = await db.surveyResponse.findUnique({
      where: { pledgeId },
    });

    if (!existingResponse) {
      return NextResponse.json(
        { error: "Survey response not found" },
        { status: 404 }
      );
    }

    // Prevent resubmission of already completed surveys
    if (existingResponse.isComplete) {
      return NextResponse.json(
        { error: "Survey has already been submitted. Contact the creator if you need to make changes." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const data = responseSchema.parse(body);

    // Check if address is locked
    if (existingResponse.addressLocked || survey.addressesLocked) {
      // Can still update non-address fields, but not address
      if (data.shippingAddress && JSON.stringify(data.shippingAddress) !== JSON.stringify(existingResponse.shippingAddress)) {
        return NextResponse.json(
          { error: "Address has been locked and cannot be changed" },
          { status: 400 }
        );
      }
    }

    // Validate required fields if submitting
    if (data.submit) {
      const addonIds = pledge.addons.map((a: { addonId: string }) => a.addonId);

      // Check required backer questions
      for (const question of survey.backerQuestions) {
        // Check if this question applies to this backer
        const applies =
          question.targetType === "ALL_BACKERS" ||
          (question.targetType === "SPECIFIC_REWARDS" &&
            (question.targetRewardIds.includes(pledge.rewardId) ||
              question.targetRewardIds.some((id: string) => addonIds.includes(id))));

        if (applies && question.isRequired) {
          const answer = data.backerResponses?.[question.id];
          if (!answer || (Array.isArray(answer) && answer.length === 0)) {
            return NextResponse.json(
              { error: `Required question "${question.question}" is not answered` },
              { status: 400 }
            );
          }
        }
      }

      // Check required item questions
      for (const itemQ of survey.itemQuestions) {
        // Check if this item applies to this backer
        const applies =
          itemQ.rewardId === pledge.rewardId ||
          addonIds.includes(itemQ.rewardId);

        if (applies) {
          // Check variants are selected. Accept either the variant.id
          // key (preferred, exact match) or the variantType key
          // (fallback). The fallback handles two cases:
          //   1. A creator re-saved the item-questions after this
          //      backer started filling the survey -- our save flow
          //      deletes + recreates SurveyItemVariant rows, so the
          //      backer's selections reference OLD variant.ids that
          //      no longer exist. variantType is stable across saves.
          //   2. Legacy / cross-device responses where the client
          //      keyed by variantType from a previous client build.
          // Without this fallback, backers see their picked size in
          // the UI but submission fails with "Please select a Size"
          // -- exact symptom reported by the creator.
          for (const variant of itemQ.variants) {
            const variants = data.itemResponses?.[itemQ.id]?.variants;
            const selection =
              variants?.[variant.id] || variants?.[variant.variantType];
            if (!selection) {
              return NextResponse.json(
                { error: `Please select a ${variant.variantType} for ${itemQ.itemName}` },
                { status: 400 }
              );
            }
          }

          // Check required custom questions
          for (const customQ of itemQ.customQuestions) {
            if (customQ.isRequired) {
              const answer = data.itemResponses?.[itemQ.id]?.customAnswers?.[customQ.id];
              if (!answer || (Array.isArray(answer) && answer.length === 0)) {
                return NextResponse.json(
                  { error: `Required question "${customQ.question}" for ${itemQ.itemName} is not answered` },
                  { status: 400 }
                );
              }
            }
          }
        }
      }

      // Check address if required - but only for pledges that need physical shipping
      if (survey.collectAddresses) {
        // Determine if this pledge requires shipping. Guard the null rewardId
        // ("No Reward" pledge) so findUnique doesn't 500 the survey.
        const rewardForShipping = pledge.rewardId
          ? await db.reward.findUnique({
              where: { id: pledge.rewardId },
              select: { shippingType: true },
            })
          : null;
        const addonRewardsForShipping = addonIds.length > 0
          ? await db.reward.findMany({
              where: { id: { in: addonIds } },
              select: { shippingType: true },
            })
          : [];
        const pledgeRequiresShipping =
          (!!pledge.rewardId && rewardForShipping?.shippingType !== "NO_SHIPPING") ||
          addonRewardsForShipping.some(a => a.shippingType !== "NO_SHIPPING");

        if (pledgeRequiresShipping) {
          const addressToValidate = data.shippingAddress || existingResponse.shippingAddress;
          if (!addressToValidate) {
            return NextResponse.json(
              { error: "Shipping address is required" },
              { status: 400 }
            );
          }
          // Validate address with strict schema on submit
          const addressResult = addressSchemaStrict.safeParse(addressToValidate);
          if (!addressResult.success) {
            const errorMessage = addressResult.error.issues.map(i => i.message).join(', ');
            return NextResponse.json(
              { error: `Shipping address incomplete: ${errorMessage}` },
              { status: 400 }
            );
          }
        }
      }
    }

    // Note: Addon purchases are handled separately via the add-items payment flow
    // (POST /api/pledges/[pledgeId]/add-items → payment → confirm-add-items)
    // The survey page submits selectedAddons info so we can return it for the frontend payment step

    // Update response — when submitting, guard against concurrent double-submission
    // by requiring isComplete: false in the where clause (atomic check-and-set)
    let updatedResponse;
    if (data.submit) {
      const result = await db.surveyResponse.updateMany({
        where: { pledgeId, isComplete: false },
        data: {
          itemResponses: data.itemResponses || existingResponse.itemResponses,
          backerResponses: data.backerResponses || existingResponse.backerResponses,
          shippingAddress: data.shippingAddress !== undefined
            ? data.shippingAddress
            : existingResponse.shippingAddress,
          isComplete: true,
          completedAt: new Date(),
        },
      });
      if (result.count === 0) {
        return NextResponse.json(
          { error: "Survey has already been submitted. Contact the creator if you need to make changes." },
          { status: 400 }
        );
      }
      updatedResponse = await db.surveyResponse.findUnique({ where: { pledgeId } });
    } else {
      updatedResponse = await db.surveyResponse.update({
        where: { pledgeId },
        data: {
          itemResponses: data.itemResponses || existingResponse.itemResponses,
          backerResponses: data.backerResponses || existingResponse.backerResponses,
          shippingAddress: data.shippingAddress !== undefined
            ? data.shippingAddress
            : existingResponse.shippingAddress,
          isComplete: existingResponse.isComplete,
          completedAt: existingResponse.completedAt,
        },
      });
    }

    // Update pledge survey status
    if (data.submit) {
      await db.pledge.update({
        where: { id: pledgeId },
        data: {
          surveyCompleted: true,
          shippingAddress: data.shippingAddress || existingResponse.shippingAddress,
          surveyResponses: {
            itemResponses: data.itemResponses || existingResponse.itemResponses,
            backerResponses: data.backerResponses || existingResponse.backerResponses,
          },
        },
      });

      // Send survey completion confirmation email
      try {
        const pledgeWithDetails = await db.pledge.findFirst({
          where: { id: pledgeId , deletedAt: null },
          select: {
            user: { select: { email: true, name: true } },
            project: { select: { title: true, slug: true, creator: { select: { vanityUrl: true } } } },
            reward: { select: { title: true } },
          },
        });

        if (pledgeWithDetails?.user.email) {
          const { sendSurveyCompletionEmail } = await import("@/lib/email/email-templates-pledge");
          const projectUrlPath = pledgeWithDetails.project.creator.vanityUrl
            ? `/${pledgeWithDetails.project.creator.vanityUrl}/${pledgeWithDetails.project.slug}`
            : undefined;

          await sendSurveyCompletionEmail(
            pledgeWithDetails.user.email,
            pledgeWithDetails.user.name || "",
            pledgeWithDetails.project.title,
            pledgeWithDetails.reward?.title || null,
            pledgeWithDetails.project.slug,
            projectUrlPath,
          );
        }
      } catch (emailError) {
        surveysRespondLogger.error({ err: String(emailError) }, "Failed to send survey completion email:");
        // Don't fail the survey submission if email fails
      }
    }

    return NextResponse.json({
      success: true,
      response: updatedResponse,
      message: data.submit ? "Survey submitted successfully!" : "Survey saved",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    surveysRespondLogger.error({ err: formatError(error) }, "Error submitting survey response:");
    return NextResponse.json(
      { error: "Failed to submit survey response" },
      { status: 500 }
    );
  }
}
