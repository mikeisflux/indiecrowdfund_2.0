-- Creator-defined package groups on the IndieKit Packages tab (the
-- Create Group dialog previously faked success and stored nothing).
CREATE TABLE IF NOT EXISTS "CustomPackageGroup" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'domestic',
    "pledgeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomPackageGroup_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CustomPackageGroup_projectId_idx"
    ON "CustomPackageGroup"("projectId");

-- Export history entries for Reports > Export ("Recent Exports" was a
-- placeholder that could never populate).
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'DATA_EXPORTED';
