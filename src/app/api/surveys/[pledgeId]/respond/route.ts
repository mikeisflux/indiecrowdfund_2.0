import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const addressSchema = z.object({
  name: z.string().min(1),
  line1: z.string().min(1),
  line2: z.string().optional().nullable(),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().min(1),
  country: z.string().min(1),
  phone: z.string().optional().nullable(),
});

const responseSchema = z.object({
  itemResponses: z.record(z.string(), z.object({
    variants: z.record(z.string(), z.string()).optional(),
    customAnswers: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional(),
  })).optional(),
  backerResponses: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional(),
  shippingAddress: addressSchema.optional().nullable(),
  submit: z.boolean().default(false), // If true, mark as complete
});

// GET - Get survey for a pledge (backer view)
export async function GET(
  req: NextRequest,
  { params }: { params: { pledgeId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pledgeId = params.pledgeId;

    // Get pledge and verify ownership
    const pledge = await db.pledge.findUnique({
      where: { id: pledgeId },
      include: {
        project: {
          select: { id: true, title: true, imageUrl: true },
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
        projectTitle: pledge.project.title,
        projectImage: pledge.project.imageUrl,
        rewardTitle: pledge.reward.title,
        addons: pledge.addons.map((a: { addon: { id: string; title: string } }) => ({
          id: a.addon.id,
          title: a.addon.title,
        })),
      },
      itemQuestions: [...relevantItemQuestions, ...addonItemQuestions],
      backerQuestions: relevantBackerQuestions,
      response: {
        itemResponses: response.itemResponses,
        backerResponses: response.backerResponses,
        shippingAddress: response.shippingAddress,
        isComplete: response.isComplete,
        addressLocked: response.addressLocked,
      },
    });
  } catch (error) {
    console.error("Error fetching survey:", error);
    return NextResponse.json(
      { error: "Failed to fetch survey" },
      { status: 500 }
    );
  }
}

// POST - Submit/update survey response
export async function POST(
  req: NextRequest,
  { params }: { params: { pledgeId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pledgeId = params.pledgeId;

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
      const addonIds = pledge.addons.map((a) => a.addonId);

      // Check required backer questions
      for (const question of survey.backerQuestions) {
        // Check if this question applies to this backer
        const applies =
          question.targetType === "ALL_BACKERS" ||
          (question.targetType === "SPECIFIC_REWARDS" &&
            (question.targetRewardIds.includes(pledge.rewardId) ||
              question.targetRewardIds.some((id) => addonIds.includes(id))));

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
      if (survey.collectAddresses && !data.shippingAddress && !existingResponse.shippingAddress) {
        return NextResponse.json(
          { error: "Shipping address is required" },
          { status: 400 }
        );
      }
    }

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
    }

    return NextResponse.json({
      success: true,
      response: updatedResponse,
      message: data.submit ? "Survey submitted successfully!" : "Survey saved",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error submitting survey response:", error);
    return NextResponse.json(
      { error: "Failed to submit survey response" },
      { status: 500 }
    );
  }
}
