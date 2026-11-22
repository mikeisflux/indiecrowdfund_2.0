-- Upgrades apply to an ITEM, not just a reward. A bundle reward ("The Rebel
-- Box") holds several ProjectItems; the backer upgrades one of them, so the
-- assignment records which. Upgraded editions become ProjectItems of their
-- own ("SW3-22-F"), created on first use, so the production order can show
-- and track them like any other item.
ALTER TABLE "PledgeModifierAssignment" ADD COLUMN IF NOT EXISTS "projectItemId" TEXT;
ALTER TABLE "ProjectItem" ADD COLUMN IF NOT EXISTS "upgradeOfItemId" TEXT;
ALTER TABLE "ProjectItem" ADD COLUMN IF NOT EXISTS "upgradeModifierId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectItem_projectId_upgradeOfItemId_upgradeModifierId_key"
  ON "ProjectItem" ("projectId", "upgradeOfItemId", "upgradeModifierId");
