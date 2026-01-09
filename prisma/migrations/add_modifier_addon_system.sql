-- Add modifier addon fields to Reward
ALTER TABLE `Reward` ADD COLUMN `isModifier` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `Reward` ADD COLUMN `modifiesRewardIds` JSON;

-- Add modifier assignment flag to Pledge
ALTER TABLE `Pledge` ADD COLUMN `needsModifierAssignment` BOOLEAN NOT NULL DEFAULT false;

-- Create index for finding pledges needing modifier assignment
CREATE INDEX `Pledge_needsModifierAssignment_idx` ON `Pledge`(`needsModifierAssignment`);

-- Create PledgeModifierAssignment table
CREATE TABLE IF NOT EXISTS `PledgeModifierAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `pledgeId` VARCHAR(191) NOT NULL,
    `rewardId` VARCHAR(191) NOT NULL,
    `modifierAddonId` VARCHAR(191) NOT NULL,
    `isAutoAssigned` BOOLEAN NOT NULL DEFAULT false,
    `assignedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PledgeModifierAssignment_pledgeId_modifierAddonId_key`(`pledgeId`, `modifierAddonId`),
    INDEX `PledgeModifierAssignment_pledgeId_idx`(`pledgeId`),
    INDEX `PledgeModifierAssignment_rewardId_idx`(`rewardId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Add foreign key for PledgeModifierAssignment
ALTER TABLE `PledgeModifierAssignment` ADD CONSTRAINT `PledgeModifierAssignment_pledgeId_fkey` FOREIGN KEY (`pledgeId`) REFERENCES `Pledge`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Create ModifierSkuMapping table
CREATE TABLE IF NOT EXISTS `ModifierSkuMapping` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `baseRewardId` VARCHAR(191) NOT NULL,
    `modifierAddonId` VARCHAR(191) NOT NULL,
    `shopifySku` VARCHAR(191) NOT NULL,
    `shopifyProductId` VARCHAR(191) NULL,
    `shopifyVariantId` VARCHAR(191) NULL,
    `shopifyProductName` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ModifierSkuMapping_projectId_baseRewardId_modifierAddonId_key`(`projectId`, `baseRewardId`, `modifierAddonId`),
    INDEX `ModifierSkuMapping_projectId_idx`(`projectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
