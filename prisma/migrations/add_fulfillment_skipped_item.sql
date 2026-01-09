-- CreateTable for FulfillmentSkippedItem
-- Track items that are skipped from fulfillment (not mapped to SKU)
CREATE TABLE IF NOT EXISTS `FulfillmentSkippedItem` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `sourceType` ENUM('REWARD', 'ADDON', 'PROJECT_ITEM') NOT NULL,
    `sourceId` VARCHAR(191) NOT NULL,
    `sourceName` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `FulfillmentSkippedItem_projectId_sourceType_sourceId_key`(`projectId`, `sourceType`, `sourceId`),
    INDEX `FulfillmentSkippedItem_projectId_idx`(`projectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
