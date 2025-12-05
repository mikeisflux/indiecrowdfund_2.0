import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { issueCreatorCard, listCards, freezeCard, unfreezeCard } from "@/lib/payments/wise";
import { db } from "@/lib/db";

// Issue a new card for creator
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { cardType = "VIRTUAL", currency = "USD" } = body;

    if (!["VIRTUAL", "PHYSICAL"].includes(cardType)) {
      return NextResponse.json(
        { error: "Invalid card type. Must be VIRTUAL or PHYSICAL" },
        { status: 400 }
      );
    }

    const card = await issueCreatorCard({
      userId: session.userId,
      cardType,
      currency,
    });

    return NextResponse.json({
      success: true,
      card: {
        id: card.id,
        type: card.type,
        status: card.status,
        lastFour: card.lastFour,
        currency: card.currency,
        expiryDate: card.expiryDate,
      },
    });
  } catch (error) {
    console.error("Card issuance error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Card issuance failed" },
      { status: 500 }
    );
  }
}

// Get creator's cards
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const wiseConfig = await db.wiseConfig.findUnique({
      where: { userId: session.userId },
    });

    if (!wiseConfig?.wiseProfileId) {
      return NextResponse.json({ cards: [] });
    }

    const cards = await listCards(parseInt(wiseConfig.wiseProfileId));

    return NextResponse.json({
      cards: cards.map((card) => ({
        id: card.id,
        type: card.type,
        status: card.status,
        lastFour: card.lastFour,
        currency: card.currency,
        expiryDate: card.expiryDate,
      })),
    });
  } catch (error) {
    console.error("Error fetching cards:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch cards" },
      { status: 500 }
    );
  }
}

// Freeze/Unfreeze card
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { cardId, action } = body;

    if (!cardId || !["freeze", "unfreeze"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid request" },
        { status: 400 }
      );
    }

    const wiseConfig = await db.wiseConfig.findUnique({
      where: { userId: session.userId },
    });

    if (!wiseConfig?.wiseProfileId) {
      return NextResponse.json(
        { error: "Wise account not connected" },
        { status: 400 }
      );
    }

    const profileId = parseInt(wiseConfig.wiseProfileId);

    const card = action === "freeze"
      ? await freezeCard(profileId, cardId)
      : await unfreezeCard(profileId, cardId);

    // Update local record
    if (wiseConfig.wiseCardId === cardId) {
      await db.wiseConfig.update({
        where: { userId: session.userId },
        data: { cardStatus: card.status },
      });
    }

    return NextResponse.json({
      success: true,
      card: {
        id: card.id,
        status: card.status,
      },
    });
  } catch (error) {
    console.error("Card action error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Card action failed" },
      { status: 500 }
    );
  }
}
