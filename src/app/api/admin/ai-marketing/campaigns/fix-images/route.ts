import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminAiMarketingCampaignsFixImagesLogger = logger.child({ module: "admin-ai-marketing-campaigns-fix-images" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

// Helper to check admin role
async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.id) {
    return { error: "Unauthorized", status: 401 };
  }

  const user = await db.user.findFirst({
    where: { id: session.user.id, deletedAt: null },
    select: { role: true },
  });

  if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
    return { error: "Forbidden - Admin access required", status: 403 };
  }

  return { user: session.user };
}

// Extract base64 images from HTML and save them as files
async function processBase64Images(html: string): Promise<{ processedHtml: string; uploadedCount: number }> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://indiecrowdfund.com";
  // Match the same path structure as media upload API: public/uploads/{folder}/images/
  const uploadDir = join(process.cwd(), "public", "uploads", "email-campaigns", "images");

  // Ensure upload directory exists
  await mkdir(uploadDir, { recursive: true });

  // Find all base64 image sources
  const base64Pattern = /src=["'](data:image\/(png|jpg|jpeg|gif|webp);base64,([^"']+))["']/gi;

  let processedHtml = html;
  let uploadedCount = 0;
  let match;

  // Collect all matches first (since we're modifying the string)
  const matches: { fullMatch: string; dataUrl: string; extension: string; base64Data: string }[] = [];
  while ((match = base64Pattern.exec(html)) !== null) {
    matches.push({
      fullMatch: match[0],
      dataUrl: match[1],
      extension: match[2] === "jpeg" ? "jpg" : match[2],
      base64Data: match[3],
    });
  }

  // Process each match
  for (const m of matches) {
    try {
      // Generate unique filename
      const filename = `${randomUUID()}.${m.extension}`;
      const filePath = join(uploadDir, filename);

      // Decode base64 and write file
      const imageBuffer = Buffer.from(m.base64Data, "base64");
      await writeFile(filePath, imageBuffer);

      // Create public URL - matches media upload pattern: /uploads/{folder}/images/{filename}
      const publicUrl = `${baseUrl}/uploads/email-campaigns/images/${filename}`;

      // Replace in HTML
      processedHtml = processedHtml.replace(m.dataUrl, publicUrl);
      uploadedCount++;

      adminAiMarketingCampaignsFixImagesLogger.info(`Uploaded image: ${filename} -> ${publicUrl}`);
    } catch (err) {
      adminAiMarketingCampaignsFixImagesLogger.error({ err: String(err) }, `Failed to process image:`);
    }
  }

  return { processedHtml, uploadedCount };
}

// POST - Fix all campaigns with base64 images
export async function POST(request: Request) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    // Get campaign ID from body (optional - if not provided, fix all)
    let campaignId: string | null = null;
    try {
      const body = await request.json();
      campaignId = body.campaignId || null;
    } catch {
      // No body provided, fix all campaigns
    }

    // Get campaigns with base64 images
    const campaigns = await db.emailCampaign.findMany({
      where: campaignId
        ? { id: campaignId }
        : { htmlContent: { contains: "data:image" } },
      select: {
        id: true,
        name: true,
        htmlContent: true,
      },
    });

    adminAiMarketingCampaignsFixImagesLogger.info(`Found ${campaigns.length} campaigns with base64 images`);

    const results: { id: string; name: string; imagesFixed: number }[] = [];

    for (const campaign of campaigns) {
      const { processedHtml, uploadedCount } = await processBase64Images(campaign.htmlContent);

      if (uploadedCount > 0) {
        // Update campaign with new HTML
        await db.emailCampaign.update({
          where: { id: campaign.id },
          data: { htmlContent: processedHtml },
        });

        results.push({
          id: campaign.id,
          name: campaign.name,
          imagesFixed: uploadedCount,
        });

        adminAiMarketingCampaignsFixImagesLogger.info(`Fixed campaign "${campaign.name}": ${uploadedCount} images uploaded`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Fixed ${results.length} campaigns`,
      campaigns: results,
      totalImagesUploaded: results.reduce((sum, r) => sum + r.imagesFixed, 0),
    });
  } catch (error) {
    adminAiMarketingCampaignsFixImagesLogger.error({ err: String(error) }, "Error fixing campaign images:");
    return NextResponse.json(
      { error: "Failed to fix campaign images" },
      { status: 500 }
    );
  }
}

// GET - Check which campaigns have base64 images
export async function GET() {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const campaigns = await db.emailCampaign.findMany({
      where: { htmlContent: { contains: "data:image" } },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      campaignsWithBase64Images: campaigns.length,
      campaigns: campaigns.map((c: { id: string; name: string; status: string; createdAt: Date }) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        createdAt: c.createdAt,
      })),
    });
  } catch (error) {
    adminAiMarketingCampaignsFixImagesLogger.error({ err: String(error) }, "Error checking campaigns:");
    return NextResponse.json(
      { error: "Failed to check campaigns" },
      { status: 500 }
    );
  }
}
