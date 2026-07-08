import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Public GET — returns active promo popup slides for frontend display
export async function GET() {
  try {
    const popup = await db.promoPopup.findFirst({
      where: { isActive: true },
    });

    if (!popup) {
      return NextResponse.json({ popup: null });
    }

    return NextResponse.json({
      popup: {
        id: popup.id,
        showFrequency: popup.showFrequency,
        slides: popup.slides,
      },
    });
  } catch {
    return NextResponse.json({ popup: null });
  }
}
