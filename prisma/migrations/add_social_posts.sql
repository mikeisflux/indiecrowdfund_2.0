-- AI Publicist queue (prisma/schema/social-post.prisma).
-- Catalog-only migration: run this one-shot on the production server,
-- then deploy the app build that includes the SocialPost model.
--
--   psql -h localhost -U indieuser -d indiecrowdfund -f prisma/migrations/add_social_posts.sql

CREATE TABLE IF NOT EXISTS "SocialPost" (
    "id"         TEXT NOT NULL,
    "platform"   TEXT NOT NULL DEFAULT 'twitter',
    "postType"   TEXT NOT NULL,
    "dedupeKey"  TEXT NOT NULL,
    "projectId"  TEXT,
    "content"    TEXT NOT NULL,
    "imageUrl"   TEXT,
    "status"     TEXT NOT NULL DEFAULT 'PENDING',
    "error"      TEXT,
    "externalId" TEXT,
    "postedAt"   TIMESTAMP(3),
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SocialPost_dedupeKey_key" ON "SocialPost"("dedupeKey");
CREATE INDEX IF NOT EXISTS "SocialPost_status_createdAt_idx" ON "SocialPost"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "SocialPost_projectId_idx" ON "SocialPost"("projectId");
