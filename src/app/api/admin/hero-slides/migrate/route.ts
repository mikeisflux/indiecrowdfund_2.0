import { NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const adminHeroSlidesMigrateLogger = logger.child({ module: "admin-hero-slides-migrate" });
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// CORS headers for API responses
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Handle preflight requests
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// This endpoint creates the HeroSlide table and seeds the default slide
// DELETE this file after the migration has been run successfully
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

  const user = await db.user.findFirst({
    where: { id: session.user.id, deletedAt: null },
    select: { role: true },
  });

  if (!user || user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

  try {
    // Create the enum type if it doesn't exist
    await db.$executeRawUnsafe(`
      DO $$
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'HeroMediaType') THEN
              CREATE TYPE "HeroMediaType" AS ENUM ('IMAGE', 'YOUTUBE', 'VIDEO');
          END IF;
      END$$;
    `);

    // Create the table if it doesn't exist
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "HeroSlide" (
          "id" TEXT NOT NULL,
          "title" TEXT NOT NULL,
          "subtitle" TEXT,
          "description" TEXT,
          "buttonText" TEXT,
          "buttonLink" TEXT,
          "showPrimaryButton" BOOLEAN NOT NULL DEFAULT true,
          "secondaryButtonText" TEXT,
          "secondaryButtonLink" TEXT,
          "showSecondaryButton" BOOLEAN NOT NULL DEFAULT true,
          "mediaType" "HeroMediaType" NOT NULL DEFAULT 'IMAGE',
          "imageUrl" TEXT,
          "videoUrl" TEXT,
          "videoThumbnail" TEXT,
          "videoAutoplay" BOOLEAN NOT NULL DEFAULT true,
          "videoMuted" BOOLEAN NOT NULL DEFAULT true,
          "videoLoop" BOOLEAN NOT NULL DEFAULT true,
          "textAlignment" TEXT NOT NULL DEFAULT 'center',
          "overlayOpacity" INTEGER NOT NULL DEFAULT 0,
          "textColor" TEXT NOT NULL DEFAULT 'white',
          "showSubtitle" BOOLEAN NOT NULL DEFAULT true,
          "showDescription" BOOLEAN NOT NULL DEFAULT true,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "sortOrder" INTEGER NOT NULL DEFAULT 0,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "HeroSlide_pkey" PRIMARY KEY ("id")
      );
    `);

    // Add new columns if they don't exist (for existing tables)
    const newColumns = [
      { name: "showPrimaryButton", type: "BOOLEAN NOT NULL DEFAULT true" },
      { name: "showSecondaryButton", type: "BOOLEAN NOT NULL DEFAULT true" },
      { name: "videoAutoplay", type: "BOOLEAN NOT NULL DEFAULT true" },
      { name: "videoMuted", type: "BOOLEAN NOT NULL DEFAULT true" },
      { name: "videoLoop", type: "BOOLEAN NOT NULL DEFAULT true" },
      { name: "textColor", type: "TEXT NOT NULL DEFAULT 'white'" },
      { name: "showSubtitle", type: "BOOLEAN NOT NULL DEFAULT true" },
      { name: "showDescription", type: "BOOLEAN NOT NULL DEFAULT true" },
    ];

    for (const col of newColumns) {
      try {
        await db.$executeRawUnsafe(`
          ALTER TABLE "HeroSlide" ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type};
        `);
      } catch {
        // Column might already exist, ignore error
      }
    }

    // Create index if it doesn't exist
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "HeroSlide_isActive_sortOrder_idx" ON "HeroSlide"("isActive", "sortOrder");
    `);

    // Check if there are any slides
    const countResult = await db.$queryRawUnsafe(
      'SELECT COUNT(*) as count FROM "HeroSlide"'
    ) as { count: bigint }[];
    const count = Number(countResult[0]?.count || 0);

    if (count === 0) {
      // Generate a unique ID
      const id = "cl" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

      // Seed the default slide
      await db.$executeRawUnsafe(`
        INSERT INTO "HeroSlide" (
          "id", "title", "subtitle", "description",
          "buttonText", "buttonLink", "showPrimaryButton",
          "secondaryButtonText", "secondaryButtonLink", "showSecondaryButton",
          "mediaType", "textAlignment", "overlayOpacity",
          "textColor", "showSubtitle", "showDescription",
          "videoAutoplay", "videoMuted", "videoLoop",
          "isActive", "sortOrder", "createdAt", "updatedAt"
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, true, $7, $8, true,
          'IMAGE', 'center', 0,
          'white', true, true,
          true, true, true,
          true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `,
        id,
        "Support Who You Love",
        "IndieCrowdfund leads the way!",
        "IndieCrowdfund is the future home to thousands of creative projects in art, design, film, games, music, and more. Back a project or start your own today.",
        "Discover Projects",
        "/crowdfunds",
        "Start a Project",
        "/projects/new"
      );

      return NextResponse.json({
        success: true,
        message: "Table created and default slide seeded",
        slideId: id,
      }, { headers: corsHeaders });
    }

    return NextResponse.json({
      success: true,
      message: "Table already exists with slides",
      count,
    }, { headers: corsHeaders });
  } catch (error) {
    adminHeroSlidesMigrateLogger.error({ err: formatError(error) }, "Migration error:");
    return NextResponse.json(
      { error: "Migration failed", details: String(error) },
      { status: 500, headers: corsHeaders }
    );
  }
}
