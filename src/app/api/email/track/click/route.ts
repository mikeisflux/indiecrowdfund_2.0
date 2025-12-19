import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET - Track email link click and redirect
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("c");
    const url = searchParams.get("url"); // Base64 encoded URL
    const emailId = searchParams.get("e"); // Base64 encoded email

    if (!url) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    const decodedUrl = Buffer.from(url, "base64").toString("utf-8");

    if (campaignId) {
      // Update campaign click count
      await db.emailCampaign.update({
        where: { id: campaignId },
        data: { clickCount: { increment: 1 } },
      });

      if (emailId) {
        const email = Buffer.from(emailId, "base64").toString("utf-8");
        console.log(`Email link clicked: campaign=${campaignId}, email=${email}, url=${decodedUrl}`);
      }
    }

    // Redirect to the actual URL
    return NextResponse.redirect(decodedUrl);
  } catch (error) {
    console.error("Error tracking email click:", error);
    // Redirect to homepage on error
    return NextResponse.redirect(new URL("/", request.url));
  }
}
