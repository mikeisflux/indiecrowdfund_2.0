import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

// POST - Retailer logout
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("retailer_token");

    return NextResponse.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Error logging out retailer:", error);
    return NextResponse.json(
      { error: "Failed to logout" },
      { status: 500 }
    );
  }
}
