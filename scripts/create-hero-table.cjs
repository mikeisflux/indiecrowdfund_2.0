const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    // Try to create the table using raw SQL
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'HeroMediaType') THEN
              CREATE TYPE "HeroMediaType" AS ENUM ('IMAGE', 'YOUTUBE', 'VIDEO');
          END IF;
      END$$;
    `);
    
    await prisma.$executeRawUnsafe(`
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

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "HeroSlide_isActive_sortOrder_idx" ON "HeroSlide"("isActive", "sortOrder");
    `);
    
    console.log('HeroSlide table created successfully!');
    
    // Now seed the default slide
    const existingSlides = await prisma.$queryRawUnsafe('SELECT COUNT(*) as count FROM "HeroSlide"');
    console.log('Existing slides:', existingSlides);
    
    if (existingSlides[0].count === '0' || existingSlides[0].count === 0n) {
      const id = 'cldefault' + Math.random().toString(36).substring(2, 15);
      await prisma.$executeRawUnsafe(`
        INSERT INTO "HeroSlide" ("id", "title", "subtitle", "description", "buttonText", "buttonLink", "secondaryButtonText", "secondaryButtonLink", "mediaType", "textAlignment", "overlayOpacity", "isActive", "sortOrder", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'IMAGE', 'center', 0, true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, 
        id,
        'Support Who You Love',
        'IndieCrowdfund leads the way!',
        'IndieCrowdfund is the future home to thousands of creative projects in art, design, film, games, music, and more. Back a project or start your own today.',
        'Discover Projects',
        '/discover',
        'Start a Project',
        '/projects/new'
      );
      console.log('Default slide created!');
    } else {
      console.log('Slides already exist, skipping seed.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
