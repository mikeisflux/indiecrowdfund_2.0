import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

// Lenient address schema for progress saves (allows empty strings)
const addressSchemaPartial = z.object({
  name: z.string(),
  line1: z.string(),
  line2: z.string().optional().nullable(),
  city: z.string(),
  state: z.string(),
  postalCode: z.string(),
  country: z.string(),
  phone: z.string().optional().nullable(),
});

// Strict address schema for final submission
const addressSchemaStrict = z.object({
  name: z.string().min(1, "Name is required"),
  line1: z.string().min(1, "Address is required"),
  line2: z.string().optional().nullable(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  postalCode: z.string().min(1, "Postal code is required"),
  country: z.string().min(1, "Country is required"),
  phone: z.string().optional().nullable(),
});

const responseSchema = z.object({
  itemResponses: z.record(z.string(), z.object({
    variants: z.record(z.string(), z.string()).optional(),
    customAnswers: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional(),
  })).optional(),
  backerResponses: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional(),
  shippingAddress: addressSchemaPartial.optional().nullable(),
  selectedAddons: z.record(z.string(), z.number().int().min(0)).optional(), // { addonId: quantity }
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
    const pledge = await db.pledge.findUnique({
      where: { id: pledgeId },
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
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

    if (survey.status === "DRAFT") {
      return NextResponse.json(
        { error: "Survey has not been sent yet" },
        { status: 400 }
      );
    }

    // Get or create response
    let response = await db.surveyResponse.findUnique({
      where: { pledgeId },
    });

    if (!response) {
      response = await db.surveyResponse.create({
        data: {
          surveyId: survey.id,
          pledgeId,
          isComplete: false,
        },
      });
    }

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
      orderBy: { amount: "asc" },
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
    console.error("Error fetching survey:", error);
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
    const pledge = await db.pledge.findUnique({
      where: { id: pledgeId },
      include: {
        addons: true,
      },
    });

    if (!pledge) {
      return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
    }

    if (pledge.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

    // Get existing response
    const existingResponse = await db.surveyResponse.findUnique({
      where: { pledgeId },
    });

    if (!existingResponse) {
      return NextResponse.json(
        { error: "Survey response not found" },
        { status: 404 }
      );
    }

    // Check if address is locked
    if (existingResponse.addressLocked || survey.addressesLocked) {
      // Can still update non-address fields, but not address
      const body = await req.json();
      if (body.shippingAddress && JSON.stringify(body.shippingAddress) !== JSON.stringify(existingResponse.shippingAddress)) {
        return NextResponse.json(
          { error: "Address has been locked and cannot be changed" },
          { status: 400 }
        );
      }
    }

    const body = await req.json();
    const data = responseSchema.parse(body);

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
          // Check variants are selected
          for (const variant of itemQ.variants) {
            const selection = data.itemResponses?.[itemQ.id]?.variants?.[variant.id];
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

      // Check address if required
      if (survey.collectAddresses) {
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

    // Note: Addon purchases are handled separately via the add-items payment flow
    // (POST /api/pledges/[pledgeId]/add-items → payment → confirm-add-items)
    // The survey page submits selectedAddons info so we can return it for the frontend payment step

    // Update response
    const updatedResponse = await db.surveyResponse.update({
      where: { pledgeId },
      data: {
        itemResponses: data.itemResponses || existingResponse.itemResponses,
        backerResponses: data.backerResponses || existingResponse.backerResponses,
        shippingAddress: data.shippingAddress !== undefined
          ? data.shippingAddress
          : existingResponse.shippingAddress,
        isComplete: data.submit ? true : existingResponse.isComplete,
        completedAt: data.submit ? new Date() : existingResponse.completedAt,
      },
    });

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
        const pledgeWithDetails = await db.pledge.findUnique({
          where: { id: pledgeId },
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
        console.error("Failed to send survey completion email:", emailError);
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
    console.error("Error submitting survey response:", error);
    return NextResponse.json(
      { error: "Failed to submit survey response" },
      { status: 500 }
    );
  }
}
