import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// CORS headers for API responses
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Handle preflight requests
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET - Get active announcement bar (public)
export async function GET() {
  try {
    const now = new Date();

    // Find the first active announcement that's within its date range
    const announcement = await db.announcementBar.findFirst({
      where: {
        isActive: true,
        OR: [
          // No date constraints
          {
            startDate: null,
            endDate: null,
          },
          // Only start date, and we're past it
          {
            startDate: { lte: now },
            endDate: null,
          },
          // Only end date, and we haven't reached it
          {
            startDate: null,
            endDate: { gte: now },
          },
          // Both dates, and we're within range
          {
            startDate: { lte: now },
            endDate: { gte: now },
          },
        ],
      },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        text: true,
        linkUrl: true,
        linkText: true,
        backgroundColor: true,
        textColor: true,
        dismissible: true,
      },
    });

    return NextResponse.json({ announcement }, { headers: corsHeaders });
  } catch (error) {
    console.error("Error fetching announcement bar:", error);
    return NextResponse.json({ announcement: null }, { headers: corsHeaders });
  }
}
