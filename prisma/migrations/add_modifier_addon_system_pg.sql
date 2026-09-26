-- PostgreSQL replacement for add_modifier_addon_system.sql, which was
-- written in MySQL dialect (backticks, inline ENUM, VARCHAR(191)) and can
-- never execute under psql. Production got these objects via ad-hoc SQL;
-- this file makes them replayable. Fully idempotent.

-- Reward: modifier addon fields
ALTER TABLE "Reward" ADD COLUMN IF NOT EXISTS "isModifier" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Reward" ADD COLUMN IF NOT EXISTS "modifiesRewardIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Pledge: ambiguous-assignment flag + lookup index
ALTER TABLE "Pledge" ADD COLUMN IF NOT EXISTS "needsModifierAssignment" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "Pledge_needsModifierAssignment_idx" ON "Pledge" ("needsModifierAssignment");

-- Which modifier addon applies to which base reward, per pledge
CREATE TABLE IF NOT EXISTS "PledgeModifierAssignment" (
    "id" TEXT NOT NULL,
    "pledgeId" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "modifierAddonId" TEXT NOT NULL,
    "isAutoAssigned" BOOLEAN NOT NULL DEFAULT false,
    "assignedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PledgeModifierAssignment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PledgeModifierAssignment_pledgeId_modifierAddonId_key"
    ON "PledgeModifierAssignment" ("pledgeId", "modifierAddonId");
CREATE INDEX IF NOT EXISTS "PledgeModifierAssignment_pledgeId_idx" ON "PledgeModifierAssignment" ("pledgeId");
CREATE INDEX IF NOT EXISTS "PledgeModifierAssignment_rewardId_idx" ON "PledgeModifierAssignment" ("rewardId");
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PledgeModifierAssignment_pledgeId_fkey'
  ) THEN
    ALTER TABLE "PledgeModifierAssignment"
      ADD CONSTRAINT "PledgeModifierAssignment_pledgeId_fkey"
      FOREIGN KEY ("pledgeId") REFERENCES "Pledge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Reward + modifier combination -> fulfillment SKU
CREATE TABLE IF NOT EXISTS "ModifierSkuMapping" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "baseRewardId" TEXT NOT NULL,
    "modifierAddonId" TEXT NOT NULL,
    "shopifySku" TEXT NOT NULL,
    "shopifyProductId" TEXT,
    "shopifyVariantId" TEXT,
    "shopifyProductName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ModifierSkuMapping_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ModifierSkuMapping_projectId_baseRewardId_modifierAddonId_key"
    ON "ModifierSkuMapping" ("projectId", "baseRewardId", "modifierAddonId");
CREATE INDEX IF NOT EXISTS "ModifierSkuMapping_projectId_idx" ON "ModifierSkuMapping" ("projectId");
