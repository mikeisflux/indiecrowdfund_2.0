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

// GET - Get all active announcement bars (public)
export async function GET() {
  try {
    const now = new Date();

    // Find all active announcements that are within their date range
    const announcements = await db.announcementBar.findMany({
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

    return NextResponse.json({ announcements }, { headers: corsHeaders });
  } catch (error) {
    console.error("Error fetching announcement bars:", error);
    return NextResponse.json({ announcements: [] }, { headers: corsHeaders });
  }
}
