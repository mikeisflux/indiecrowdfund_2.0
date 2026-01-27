import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// This endpoint creates the HeroSlide table and seeds the default slide
// DELETE this file after the migration has been run successfully
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (!user || user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
          "secondaryButtonText" TEXT,
          "secondaryButtonLink" TEXT,
          "mediaType" "HeroMediaType" NOT NULL DEFAULT 'IMAGE',
          "imageUrl" TEXT,
          "videoUrl" TEXT,
          "videoThumbnail" TEXT,
          "textAlignment" TEXT NOT NULL DEFAULT 'center',
          "overlayOpacity" INTEGER NOT NULL DEFAULT 0,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "sortOrder" INTEGER NOT NULL DEFAULT 0,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "HeroSlide_pkey" PRIMARY KEY ("id")
      );
    `);

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
          "buttonText", "buttonLink",
          "secondaryButtonText", "secondaryButtonLink",
          "mediaType", "textAlignment", "overlayOpacity",
          "isActive", "sortOrder", "createdAt", "updatedAt"
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          'IMAGE', 'center', 0,
          true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `,
        id,
        "Support Who You Love",
        "IndieCrowdfund leads the way!",
        "IndieCrowdfund is the future home to thousands of creative projects in art, design, film, games, music, and more. Back a project or start your own today.",
        "Discover Projects",
        "/discover",
        "Start a Project",
        "/projects/new"
      );

      return NextResponse.json({
        success: true,
        message: "Table created and default slide seeded",
        slideId: id,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Table already exists with slides",
      count,
    });
  } catch (error) {
    console.error("Migration error:", error);
    return NextResponse.json(
      { error: "Migration failed", details: String(error) },
      { status: 500 }
    );
  }
}
