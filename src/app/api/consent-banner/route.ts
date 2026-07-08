import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Public GET — returns active consent banner for frontend display
export async function GET() {
  try {
    const banner = await db.consentBanner.findFirst({
      where: { isActive: true },
    });

    if (!banner) {
      return NextResponse.json({ banner: null });
    }

    return NextResponse.json({
      banner: {
        id: banner.id,
        showFrequency: banner.showFrequency,
        content: banner.content,
      },
    });
  } catch {
    return NextResponse.json({ banner: null });
  }
}
