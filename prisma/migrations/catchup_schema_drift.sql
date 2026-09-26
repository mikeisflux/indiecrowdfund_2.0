-- Catch-up migration: every schema object that existed in prisma/schema
-- with NO PostgreSQL migration anywhere in prisma/migrations. Production
-- received all of these via ad-hoc psql over the past months, so on prod
-- this file is a pure no-op — every statement is guarded. Its purpose is
-- to make the migrations directory actually reconstruct the database
-- (staging, disaster recovery, fresh environments), closing the
-- schema-vs-migrations drift found by the round-3 audit (H17-H19, M25).
-- Generated from `prisma migrate diff --from-empty --to-schema` output,
-- then wrapped in IF NOT EXISTS / pg_catalog guards.


-- ── Enum types used by the objects below ──

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ChangelogCategory') THEN
    CREATE TYPE "ChangelogCategory" AS ENUM ('FEATURE', 'BUGFIX', 'IMPROVEMENT', 'SECURITY', 'PERFORMANCE', 'UI_UX', 'API', 'DOCUMENTATION', 'OTHER');
  END IF;
END $$;
ALTER TYPE "ChangelogCategory" ADD VALUE IF NOT EXISTS 'FEATURE';
ALTER TYPE "ChangelogCategory" ADD VALUE IF NOT EXISTS 'BUGFIX';
ALTER TYPE "ChangelogCategory" ADD VALUE IF NOT EXISTS 'IMPROVEMENT';
ALTER TYPE "ChangelogCategory" ADD VALUE IF NOT EXISTS 'SECURITY';
ALTER TYPE "ChangelogCategory" ADD VALUE IF NOT EXISTS 'PERFORMANCE';
ALTER TYPE "ChangelogCategory" ADD VALUE IF NOT EXISTS 'UI_UX';
ALTER TYPE "ChangelogCategory" ADD VALUE IF NOT EXISTS 'API';
ALTER TYPE "ChangelogCategory" ADD VALUE IF NOT EXISTS 'DOCUMENTATION';
ALTER TYPE "ChangelogCategory" ADD VALUE IF NOT EXISTS 'OTHER';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ChatMessageType') THEN
    CREATE TYPE "ChatMessageType" AS ENUM ('TEXT', 'EMOJI', 'STICKER', 'GIF');
  END IF;
END $$;
ALTER TYPE "ChatMessageType" ADD VALUE IF NOT EXISTS 'TEXT';
ALTER TYPE "ChatMessageType" ADD VALUE IF NOT EXISTS 'EMOJI';
ALTER TYPE "ChatMessageType" ADD VALUE IF NOT EXISTS 'STICKER';
ALTER TYPE "ChatMessageType" ADD VALUE IF NOT EXISTS 'GIF';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DataDeletionStatus') THEN
    CREATE TYPE "DataDeletionStatus" AS ENUM ('PENDING', 'SCHEDULED', 'EXECUTING', 'COMPLETED', 'CANCELLED');
  END IF;
END $$;
ALTER TYPE "DataDeletionStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "DataDeletionStatus" ADD VALUE IF NOT EXISTS 'SCHEDULED';
ALTER TYPE "DataDeletionStatus" ADD VALUE IF NOT EXISTS 'EXECUTING';
ALTER TYPE "DataDeletionStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';
ALTER TYPE "DataDeletionStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DataExportStatus') THEN
    CREATE TYPE "DataExportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED');
  END IF;
END $$;
ALTER TYPE "DataExportStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "DataExportStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE "DataExportStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';
ALTER TYPE "DataExportStatus" ADD VALUE IF NOT EXISTS 'FAILED';
ALTER TYPE "DataExportStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EmailBlocklistType') THEN
    CREATE TYPE "EmailBlocklistType" AS ENUM ('EMAIL', 'DOMAIN', 'IP', 'PATTERN');
  END IF;
END $$;
ALTER TYPE "EmailBlocklistType" ADD VALUE IF NOT EXISTS 'EMAIL';
ALTER TYPE "EmailBlocklistType" ADD VALUE IF NOT EXISTS 'DOMAIN';
ALTER TYPE "EmailBlocklistType" ADD VALUE IF NOT EXISTS 'IP';
ALTER TYPE "EmailBlocklistType" ADD VALUE IF NOT EXISTS 'PATTERN';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ErrorLevel') THEN
    CREATE TYPE "ErrorLevel" AS ENUM ('DEBUG', 'INFO', 'WARNING', 'ERROR', 'FATAL');
  END IF;
END $$;
ALTER TYPE "ErrorLevel" ADD VALUE IF NOT EXISTS 'DEBUG';
ALTER TYPE "ErrorLevel" ADD VALUE IF NOT EXISTS 'INFO';
ALTER TYPE "ErrorLevel" ADD VALUE IF NOT EXISTS 'WARNING';
ALTER TYPE "ErrorLevel" ADD VALUE IF NOT EXISTS 'ERROR';
ALTER TYPE "ErrorLevel" ADD VALUE IF NOT EXISTS 'FATAL';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ErrorSource') THEN
    CREATE TYPE "ErrorSource" AS ENUM ('CLIENT', 'SERVER', 'EDGE', 'API', 'MIDDLEWARE', 'CRON');
  END IF;
END $$;
ALTER TYPE "ErrorSource" ADD VALUE IF NOT EXISTS 'CLIENT';
ALTER TYPE "ErrorSource" ADD VALUE IF NOT EXISTS 'SERVER';
ALTER TYPE "ErrorSource" ADD VALUE IF NOT EXISTS 'EDGE';
ALTER TYPE "ErrorSource" ADD VALUE IF NOT EXISTS 'API';
ALTER TYPE "ErrorSource" ADD VALUE IF NOT EXISTS 'MIDDLEWARE';
ALTER TYPE "ErrorSource" ADD VALUE IF NOT EXISTS 'CRON';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ErrorStatus') THEN
    CREATE TYPE "ErrorStatus" AS ENUM ('UNRESOLVED', 'IN_PROGRESS', 'RESOLVED', 'IGNORED');
  END IF;
END $$;
ALTER TYPE "ErrorStatus" ADD VALUE IF NOT EXISTS 'UNRESOLVED';
ALTER TYPE "ErrorStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS';
ALTER TYPE "ErrorStatus" ADD VALUE IF NOT EXISTS 'RESOLVED';
ALTER TYPE "ErrorStatus" ADD VALUE IF NOT EXISTS 'IGNORED';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FulfillmentIntegrationStatus') THEN
    CREATE TYPE "FulfillmentIntegrationStatus" AS ENUM ('PENDING', 'CONNECTED', 'ERROR', 'DISCONNECTED');
  END IF;
END $$;
ALTER TYPE "FulfillmentIntegrationStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "FulfillmentIntegrationStatus" ADD VALUE IF NOT EXISTS 'CONNECTED';
ALTER TYPE "FulfillmentIntegrationStatus" ADD VALUE IF NOT EXISTS 'ERROR';
ALTER TYPE "FulfillmentIntegrationStatus" ADD VALUE IF NOT EXISTS 'DISCONNECTED';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FulfillmentProvider') THEN
    CREATE TYPE "FulfillmentProvider" AS ENUM ('SHOPIFY', 'SHIPSTATION', 'SHIPPO', 'EASYPOST', 'STAMPS_COM', 'MANUAL');
  END IF;
END $$;
ALTER TYPE "FulfillmentProvider" ADD VALUE IF NOT EXISTS 'SHOPIFY';
ALTER TYPE "FulfillmentProvider" ADD VALUE IF NOT EXISTS 'SHIPSTATION';
ALTER TYPE "FulfillmentProvider" ADD VALUE IF NOT EXISTS 'SHIPPO';
ALTER TYPE "FulfillmentProvider" ADD VALUE IF NOT EXISTS 'EASYPOST';
ALTER TYPE "FulfillmentProvider" ADD VALUE IF NOT EXISTS 'STAMPS_COM';
ALTER TYPE "FulfillmentProvider" ADD VALUE IF NOT EXISTS 'MANUAL';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FulfillmentStatus') THEN
    CREATE TYPE "FulfillmentStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'SHIPPED', 'DELIVERED', 'FAILED');
  END IF;
END $$;
ALTER TYPE "FulfillmentStatus" ADD VALUE IF NOT EXISTS 'NOT_STARTED';
ALTER TYPE "FulfillmentStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS';
ALTER TYPE "FulfillmentStatus" ADD VALUE IF NOT EXISTS 'SHIPPED';
ALTER TYPE "FulfillmentStatus" ADD VALUE IF NOT EXISTS 'DELIVERED';
ALTER TYPE "FulfillmentStatus" ADD VALUE IF NOT EXISTS 'FAILED';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'HeroMediaType') THEN
    CREATE TYPE "HeroMediaType" AS ENUM ('IMAGE', 'YOUTUBE', 'VIDEO');
  END IF;
END $$;
ALTER TYPE "HeroMediaType" ADD VALUE IF NOT EXISTS 'IMAGE';
ALTER TYPE "HeroMediaType" ADD VALUE IF NOT EXISTS 'YOUTUBE';
ALTER TYPE "HeroMediaType" ADD VALUE IF NOT EXISTS 'VIDEO';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MarketplaceBookStatus') THEN
    CREATE TYPE "MarketplaceBookStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'LIVE', 'DEACTIVATED', 'ARCHIVED');
  END IF;
END $$;
ALTER TYPE "MarketplaceBookStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "MarketplaceBookStatus" ADD VALUE IF NOT EXISTS 'SUBMITTED';
ALTER TYPE "MarketplaceBookStatus" ADD VALUE IF NOT EXISTS 'PENDING_REVIEW';
ALTER TYPE "MarketplaceBookStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE "MarketplaceBookStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "MarketplaceBookStatus" ADD VALUE IF NOT EXISTS 'LIVE';
ALTER TYPE "MarketplaceBookStatus" ADD VALUE IF NOT EXISTS 'DEACTIVATED';
ALTER TYPE "MarketplaceBookStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrderLockStatus') THEN
    CREATE TYPE "OrderLockStatus" AS ENUM ('UNLOCKED', 'LOCK_REQUESTED', 'LOCKED', 'DECLINED');
  END IF;
END $$;
ALTER TYPE "OrderLockStatus" ADD VALUE IF NOT EXISTS 'UNLOCKED';
ALTER TYPE "OrderLockStatus" ADD VALUE IF NOT EXISTS 'LOCK_REQUESTED';
ALTER TYPE "OrderLockStatus" ADD VALUE IF NOT EXISTS 'LOCKED';
ALTER TYPE "OrderLockStatus" ADD VALUE IF NOT EXISTS 'DECLINED';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PayPalPayoutStatus') THEN
    CREATE TYPE "PayPalPayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');
  END IF;
END $$;
ALTER TYPE "PayPalPayoutStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "PayPalPayoutStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE "PayPalPayoutStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';
ALTER TYPE "PayPalPayoutStatus" ADD VALUE IF NOT EXISTS 'FAILED';
ALTER TYPE "PayPalPayoutStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentProcessor') THEN
    CREATE TYPE "PaymentProcessor" AS ENUM ('STRIPE', 'DIVINITYCOIN', 'PAYPAL', 'PAYPAL_CONNECT', 'WHOP', 'NMI');
  END IF;
END $$;
ALTER TYPE "PaymentProcessor" ADD VALUE IF NOT EXISTS 'STRIPE';
ALTER TYPE "PaymentProcessor" ADD VALUE IF NOT EXISTS 'DIVINITYCOIN';
ALTER TYPE "PaymentProcessor" ADD VALUE IF NOT EXISTS 'PAYPAL';
ALTER TYPE "PaymentProcessor" ADD VALUE IF NOT EXISTS 'PAYPAL_CONNECT';
ALTER TYPE "PaymentProcessor" ADD VALUE IF NOT EXISTS 'WHOP';
ALTER TYPE "PaymentProcessor" ADD VALUE IF NOT EXISTS 'NMI';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PledgeStatus') THEN
    CREATE TYPE "PledgeStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'CANCELLED', 'CHARGEBACK');
  END IF;
END $$;
ALTER TYPE "PledgeStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "PledgeStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';
ALTER TYPE "PledgeStatus" ADD VALUE IF NOT EXISTS 'FAILED';
ALTER TYPE "PledgeStatus" ADD VALUE IF NOT EXISTS 'REFUNDED';
ALTER TYPE "PledgeStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "PledgeStatus" ADD VALUE IF NOT EXISTS 'CHARGEBACK';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ShopifyOrderStatus') THEN
    CREATE TYPE "ShopifyOrderStatus" AS ENUM ('PENDING', 'PUSHED', 'PROCESSING', 'FULFILLED', 'SHIPPED', 'DELIVERED', 'FAILED', 'CANCELLED');
  END IF;
END $$;
ALTER TYPE "ShopifyOrderStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "ShopifyOrderStatus" ADD VALUE IF NOT EXISTS 'PUSHED';
ALTER TYPE "ShopifyOrderStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE "ShopifyOrderStatus" ADD VALUE IF NOT EXISTS 'FULFILLED';
ALTER TYPE "ShopifyOrderStatus" ADD VALUE IF NOT EXISTS 'SHIPPED';
ALTER TYPE "ShopifyOrderStatus" ADD VALUE IF NOT EXISTS 'DELIVERED';
ALTER TYPE "ShopifyOrderStatus" ADD VALUE IF NOT EXISTS 'FAILED';
ALTER TYPE "ShopifyOrderStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SkuMappingSourceType') THEN
    CREATE TYPE "SkuMappingSourceType" AS ENUM ('REWARD', 'ADDON', 'PROJECT_ITEM', 'MODIFIER_COMBO');
  END IF;
END $$;
ALTER TYPE "SkuMappingSourceType" ADD VALUE IF NOT EXISTS 'REWARD';
ALTER TYPE "SkuMappingSourceType" ADD VALUE IF NOT EXISTS 'ADDON';
ALTER TYPE "SkuMappingSourceType" ADD VALUE IF NOT EXISTS 'PROJECT_ITEM';
ALTER TYPE "SkuMappingSourceType" ADD VALUE IF NOT EXISTS 'MODIFIER_COMBO';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SurveyQuestionType') THEN
    CREATE TYPE "SurveyQuestionType" AS ENUM ('OPEN_TEXT', 'SINGLE_SELECT', 'MULTIPLE_SELECT');
  END IF;
END $$;
ALTER TYPE "SurveyQuestionType" ADD VALUE IF NOT EXISTS 'OPEN_TEXT';
ALTER TYPE "SurveyQuestionType" ADD VALUE IF NOT EXISTS 'SINGLE_SELECT';
ALTER TYPE "SurveyQuestionType" ADD VALUE IF NOT EXISTS 'MULTIPLE_SELECT';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SurveyTargetType') THEN
    CREATE TYPE "SurveyTargetType" AS ENUM ('ALL_BACKERS', 'SPECIFIC_REWARDS');
  END IF;
END $$;
ALTER TYPE "SurveyTargetType" ADD VALUE IF NOT EXISTS 'ALL_BACKERS';
ALTER TYPE "SurveyTargetType" ADD VALUE IF NOT EXISTS 'SPECIFIC_REWARDS';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') THEN
    CREATE TYPE "UserRole" AS ENUM ('USER', 'CREATOR', 'COOL_KIDS', 'ADMIN', 'SUPER_ADMIN');
  END IF;
END $$;
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'USER';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'CREATOR';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'COOL_KIDS';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'ADMIN';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';


-- ── Values added to existing enums ──

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SURVEY_UPDATE_REQUESTED';

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MARKETPLACE_BOOK_APPROVED';

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MARKETPLACE_BOOK_REJECTED';

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MARKETPLACE_PURCHASE';

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MARKETPLACE_SALE';

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PLEDGE_CANCELLED';

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PLEDGE_REFUNDED';

ALTER TYPE "EmailType" ADD VALUE IF NOT EXISTS 'PLEDGE_MODIFICATION';

ALTER TYPE "EmailType" ADD VALUE IF NOT EXISTS 'PLEDGE_CANCELLATION';

ALTER TYPE "EmailType" ADD VALUE IF NOT EXISTS 'PLEDGE_REFUND';

ALTER TYPE "MarketplaceBookStatus" ADD VALUE IF NOT EXISTS 'PENDING_REVIEW';

ALTER TYPE "MarketplaceBookStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';


-- ── Missing tables ──

CREATE TABLE IF NOT EXISTS "EmailBlocklist" (
    "id" TEXT NOT NULL,
    "type" "EmailBlocklistType" NOT NULL,
    "value" TEXT NOT NULL,
    "reason" TEXT,
    "source" TEXT,
    "blockedCount" INTEGER NOT NULL DEFAULT 0,
    "lastBlockedAt" TIMESTAMP(3),
    "providerRouteId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailBlocklist_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FulfillmentIntegration" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "provider" "FulfillmentProvider" NOT NULL,
    "credentials" JSONB NOT NULL,
    "status" "FulfillmentIntegrationStatus" NOT NULL DEFAULT 'PENDING',
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "ordersPushed" INTEGER NOT NULL DEFAULT 0,
    "ordersShipped" INTEGER NOT NULL DEFAULT 0,
    "ordersFailed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FulfillmentIntegration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ShopifyFulfillmentOrder" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "pledgeId" TEXT NOT NULL,
    "shopifyOrderId" TEXT NOT NULL,
    "shopifyFulfillmentId" TEXT,
    "orderNumber" TEXT,
    "status" "ShopifyOrderStatus" NOT NULL DEFAULT 'PENDING',
    "trackingNumber" TEXT,
    "trackingCompany" TEXT,
    "trackingUrl" TEXT,
    "pushedAt" TIMESTAMP(3),
    "fulfilledAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "lastError" TEXT,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopifyFulfillmentOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ShopifySkuMapping" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceType" "SkuMappingSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "shopifySku" TEXT NOT NULL,
    "shopifyProductId" TEXT,
    "shopifyVariantId" TEXT,
    "shopifyProductName" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopifySkuMapping_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ChangelogEntry" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "ChangelogCategory" NOT NULL,
    "version" TEXT,
    "commitHash" TEXT,
    "branch" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "authorId" TEXT,

    CONSTRAINT "ChangelogEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "IPBlocklist" (
    "id" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "userId" TEXT,
    "reason" TEXT,
    "bannedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "IPBlocklist_pkey" PRIMARY KEY ("id")
);

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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HeroSlide_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AnnouncementBar" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "linkUrl" TEXT,
    "linkText" TEXT,
    "backgroundColor" TEXT NOT NULL DEFAULT '#2563eb',
    "textColor" TEXT NOT NULL DEFAULT '#ffffff',
    "dismissible" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnnouncementBar_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProcessedWebhookEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'stripe',
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ChatMessage" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "ChatMessageType" NOT NULL DEFAULT 'TEXT',
    "stickerData" JSONB,
    "roomId" TEXT,
    "userId" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ChatPresence" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roomId" TEXT,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatPresence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ConsentBanner" (
    "id" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "showFrequency" TEXT NOT NULL DEFAULT 'once_per_login',
    "content" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsentBanner_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SeoPageMeta" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "ogTitle" TEXT,
    "ogDescription" TEXT,
    "ogImage" TEXT,
    "twitterTitle" TEXT,
    "twitterDesc" TEXT,
    "canonicalUrl" TEXT,
    "noIndex" BOOLEAN NOT NULL DEFAULT false,
    "noFollow" BOOLEAN NOT NULL DEFAULT false,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "jsonLd" TEXT,
    "lastAuditScore" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoPageMeta_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SeoAudit" (
    "id" TEXT NOT NULL,
    "runType" TEXT NOT NULL DEFAULT 'manual',
    "status" TEXT NOT NULL DEFAULT 'running',
    "totalPages" INTEGER NOT NULL DEFAULT 0,
    "pagesAudited" INTEGER NOT NULL DEFAULT 0,
    "overallScore" INTEGER,
    "issuesFound" INTEGER NOT NULL DEFAULT 0,
    "criticalIssues" INTEGER NOT NULL DEFAULT 0,
    "warnings" INTEGER NOT NULL DEFAULT 0,
    "passed" INTEGER NOT NULL DEFAULT 0,
    "results" JSONB,
    "summary" TEXT,
    "duration" INTEGER,
    "triggeredBy" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoAudit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SeoKeyword" (
    "id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "category" TEXT,
    "targetPages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "currentRank" INTEGER,
    "previousRank" INTEGER,
    "searchVolume" INTEGER,
    "difficulty" INTEGER,
    "isTracked" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoKeyword_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SeoCronLog" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "auditId" TEXT,
    "pagesProcessed" INTEGER NOT NULL DEFAULT 0,
    "issuesFound" INTEGER NOT NULL DEFAULT 0,
    "autoFixed" INTEGER NOT NULL DEFAULT 0,
    "errors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "duration" INTEGER,
    "output" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoCronLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SeoRedirect" (
    "id" TEXT NOT NULL,
    "fromPath" TEXT NOT NULL,
    "toPath" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL DEFAULT 301,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "lastHitAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoRedirect_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ErrorGroup" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'Error',
    "level" "ErrorLevel" NOT NULL DEFAULT 'ERROR',
    "source" "ErrorSource" NOT NULL DEFAULT 'SERVER',
    "endpoint" TEXT,
    "status" "ErrorStatus" NOT NULL DEFAULT 'UNRESOLVED',
    "assignedTo" TEXT,
    "eventCount" INTEGER NOT NULL DEFAULT 1,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latestMessage" TEXT NOT NULL,
    "latestStack" TEXT,
    "latestMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ErrorGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ErrorOccurrence" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "url" TEXT,
    "method" TEXT,
    "statusCode" INTEGER,
    "userId" TEXT,
    "userAgent" TEXT,
    "ip" TEXT,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErrorOccurrence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DataExportRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "DataExportStatus" NOT NULL DEFAULT 'PENDING',
    "format" TEXT NOT NULL DEFAULT 'json',
    "downloadUrl" TEXT,
    "expiresAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataExportRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DataDeletionRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "status" "DataDeletionStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "executedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "auditLog" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataDeletionRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CcpaOptOut" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "ipAddress" TEXT,
    "optOutType" TEXT NOT NULL DEFAULT 'analytics',
    "optedOutAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reinstatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CcpaOptOut_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BackerReview" (
    "id" TEXT NOT NULL,
    "pledgeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "markedReceived" BOOLEAN NOT NULL DEFAULT false,
    "markedReceivedAt" TIMESTAMP(3),
    "overallRating" INTEGER,
    "deliveryRating" INTEGER,
    "qualityRating" INTEGER,
    "communicationRating" INTEGER,
    "reviewTitle" VARCHAR(200),
    "reviewBody" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackerReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "UserMarketingScore" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversionProbability" DOUBLE PRECISION,
    "churnRisk" DOUBLE PRECISION,
    "predictedLtv" DOUBLE PRECISION,
    "nextAction" TEXT,
    "predictionConfidence" DOUBLE PRECISION,
    "predictionsCalculatedAt" TIMESTAMP(3),
    "optimalSendHour" INTEGER,
    "optimalSendDay" INTEGER,
    "sendTimezone" TEXT,
    "sendTimeConfidence" DOUBLE PRECISION,
    "sendTimeCalculatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserMarketingScore_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PayPalBankAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bankNameEncrypted" TEXT NOT NULL,
    "accountHolderEncrypted" TEXT NOT NULL,
    "accountNumberEncrypted" TEXT NOT NULL,
    "routingNumberEncrypted" TEXT NOT NULL,
    "bankCountry" TEXT NOT NULL DEFAULT 'US',
    "payoutPhoneEncrypted" TEXT,
    "billingLine1Encrypted" TEXT,
    "billingLine2Encrypted" TEXT,
    "billingCityEncrypted" TEXT,
    "billingStateEncrypted" TEXT,
    "billingZipEncrypted" TEXT,
    "billingCountryEncrypted" TEXT,
    "bankNameDisplay" TEXT,
    "accountLastFour" TEXT,
    "accountType" TEXT NOT NULL DEFAULT 'checking',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verificationMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayPalBankAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CreatorChargebackCard" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "nmiCustomerVaultId" TEXT,
    "cardNumberEncrypted" TEXT,
    "expMonthEncrypted" TEXT,
    "expYearEncrypted" TEXT,
    "cvcEncrypted" TEXT,
    "billingNameEncrypted" TEXT,
    "billingLine1Encrypted" TEXT,
    "billingLine2Encrypted" TEXT,
    "billingCityEncrypted" TEXT,
    "billingStateEncrypted" TEXT,
    "billingZipEncrypted" TEXT,
    "billingCountryEncrypted" TEXT,
    "cardLastFour" TEXT NOT NULL,
    "cardBrand" TEXT,
    "expMonth" INTEGER NOT NULL,
    "expYear" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorChargebackCard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MarketplaceAlbum" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "coverImageUrl" TEXT,
    "category" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "albumType" TEXT NOT NULL DEFAULT 'album',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "totalTracks" INTEGER NOT NULL DEFAULT 0,
    "totalDuration" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "companyId" TEXT,

    CONSTRAINT "MarketplaceAlbum_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SubscriberSegment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rules" JSONB NOT NULL,
    "cachedCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriberSegment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FeatureFlag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);


-- ── Missing columns on existing tables ──

ALTER TABLE "Pledge" ADD COLUMN IF NOT EXISTS "reviewSubmittedAt" TIMESTAMP(3);

ALTER TABLE "Pledge" ADD COLUMN IF NOT EXISTS "ratingReminderCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "shopifyApiKey" TEXT;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "shopifyApiSecret" TEXT;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "shopifyAccessToken" TEXT;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "shopifyShopDomain" TEXT;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "shipstationApiKey" TEXT;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "shipstationApiSecret" TEXT;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "shippoApiToken" TEXT;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "easypostApiKey" TEXT;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "stampsIntegrationId" TEXT;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "stampsUsername" TEXT;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "stampsPassword" TEXT;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "chatBannedAt" TIMESTAMP(3);

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "chatBannedById" TEXT;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "chatBanReason" TEXT;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastKnownIP" TEXT;

ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "stripeConnectWebhookSecret" TEXT;

ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "divinityCoinStripePublishableKey" TEXT;

ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "mailgunWebhookSigningKey" TEXT;

ALTER TABLE "ProjectItem" ADD COLUMN IF NOT EXISTS "inStock" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "SurveyBackerQuestion" ADD COLUMN IF NOT EXISTS "displayType" TEXT;

ALTER TABLE "PayPalPayout" ADD COLUMN IF NOT EXISTS "paypalBankAccountId" TEXT;

ALTER TABLE "MarketplaceBook" ADD COLUMN IF NOT EXISTS "audioFileUrl" TEXT;

ALTER TABLE "MarketplaceBook" ADD COLUMN IF NOT EXISTS "audioFileName" TEXT;

ALTER TABLE "MarketplaceBook" ADD COLUMN IF NOT EXISTS "audioFileSize" INTEGER;

ALTER TABLE "MarketplaceBook" ADD COLUMN IF NOT EXISTS "audioDuration" INTEGER;

ALTER TABLE "MarketplaceBook" ADD COLUMN IF NOT EXISTS "audioStreamUrl" TEXT;

ALTER TABLE "MarketplaceBook" ADD COLUMN IF NOT EXISTS "videoFileUrl" TEXT;

ALTER TABLE "MarketplaceBook" ADD COLUMN IF NOT EXISTS "videoFileName" TEXT;

ALTER TABLE "MarketplaceBook" ADD COLUMN IF NOT EXISTS "videoFileSize" BIGINT;

ALTER TABLE "MarketplaceBook" ADD COLUMN IF NOT EXISTS "videoDuration" INTEGER;

ALTER TABLE "MarketplaceBook" ADD COLUMN IF NOT EXISTS "videoStreamUrl" TEXT;

ALTER TABLE "MarketplaceBook" ADD COLUMN IF NOT EXISTS "videoResolution" TEXT;

ALTER TABLE "MarketplaceBook" ADD COLUMN IF NOT EXISTS "albumId" TEXT;

ALTER TABLE "MarketplaceBook" ADD COLUMN IF NOT EXISTS "trackNumber" INTEGER;

ALTER TABLE "MarketplaceBook" ADD COLUMN IF NOT EXISTS "mediaCategory" TEXT NOT NULL DEFAULT 'comics';


-- ── Indexes on the tables above ──

CREATE UNIQUE INDEX IF NOT EXISTS "UserMarketingScore_userId_key" ON "UserMarketingScore"("userId");

CREATE INDEX IF NOT EXISTS "UserMarketingScore_churnRisk_idx" ON "UserMarketingScore"("churnRisk");

CREATE INDEX IF NOT EXISTS "UserMarketingScore_conversionProbability_idx" ON "UserMarketingScore"("conversionProbability");

CREATE INDEX IF NOT EXISTS "UserMarketingScore_optimalSendHour_idx" ON "UserMarketingScore"("optimalSendHour");

CREATE INDEX IF NOT EXISTS "EmailBlocklist_type_idx" ON "EmailBlocklist"("type");

CREATE INDEX IF NOT EXISTS "EmailBlocklist_isActive_idx" ON "EmailBlocklist"("isActive");

CREATE INDEX IF NOT EXISTS "EmailBlocklist_value_idx" ON "EmailBlocklist"("value");

CREATE UNIQUE INDEX IF NOT EXISTS "EmailBlocklist_type_value_key" ON "EmailBlocklist"("type", "value");

CREATE INDEX IF NOT EXISTS "SubscriberSegment_createdAt_idx" ON "SubscriberSegment"("createdAt");

CREATE INDEX IF NOT EXISTS "FulfillmentIntegration_projectId_idx" ON "FulfillmentIntegration"("projectId");

CREATE INDEX IF NOT EXISTS "FulfillmentIntegration_provider_idx" ON "FulfillmentIntegration"("provider");

CREATE INDEX IF NOT EXISTS "FulfillmentIntegration_status_idx" ON "FulfillmentIntegration"("status");

CREATE UNIQUE INDEX IF NOT EXISTS "FulfillmentIntegration_projectId_provider_key" ON "FulfillmentIntegration"("projectId", "provider");

CREATE INDEX IF NOT EXISTS "ShopifyFulfillmentOrder_projectId_idx" ON "ShopifyFulfillmentOrder"("projectId");

CREATE INDEX IF NOT EXISTS "ShopifyFulfillmentOrder_pledgeId_idx" ON "ShopifyFulfillmentOrder"("pledgeId");

CREATE INDEX IF NOT EXISTS "ShopifyFulfillmentOrder_status_idx" ON "ShopifyFulfillmentOrder"("status");

CREATE UNIQUE INDEX IF NOT EXISTS "ShopifyFulfillmentOrder_projectId_pledgeId_key" ON "ShopifyFulfillmentOrder"("projectId", "pledgeId");

CREATE UNIQUE INDEX IF NOT EXISTS "ShopifyFulfillmentOrder_shopifyOrderId_key" ON "ShopifyFulfillmentOrder"("shopifyOrderId");

CREATE INDEX IF NOT EXISTS "ShopifySkuMapping_projectId_idx" ON "ShopifySkuMapping"("projectId");

CREATE INDEX IF NOT EXISTS "ShopifySkuMapping_shopifySku_idx" ON "ShopifySkuMapping"("shopifySku");

CREATE INDEX IF NOT EXISTS "ShopifySkuMapping_projectId_sourceType_sourceId_idx" ON "ShopifySkuMapping"("projectId", "sourceType", "sourceId");

CREATE UNIQUE INDEX IF NOT EXISTS "ShopifySkuMapping_projectId_sourceType_sourceId_shopifySku_key" ON "ShopifySkuMapping"("projectId", "sourceType", "sourceId", "shopifySku");

CREATE INDEX IF NOT EXISTS "MarketplaceAlbum_creatorId_idx" ON "MarketplaceAlbum"("creatorId");

CREATE INDEX IF NOT EXISTS "MarketplaceAlbum_isPublished_idx" ON "MarketplaceAlbum"("isPublished");

CREATE INDEX IF NOT EXISTS "MarketplaceAlbum_deletedAt_idx" ON "MarketplaceAlbum"("deletedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "MarketplaceAlbum_creatorId_slug_key" ON "MarketplaceAlbum"("creatorId", "slug");

CREATE UNIQUE INDEX IF NOT EXISTS "ErrorGroup_fingerprint_key" ON "ErrorGroup"("fingerprint");

CREATE INDEX IF NOT EXISTS "ErrorGroup_status_lastSeen_idx" ON "ErrorGroup"("status", "lastSeen");

CREATE INDEX IF NOT EXISTS "ErrorGroup_level_status_idx" ON "ErrorGroup"("level", "status");

CREATE INDEX IF NOT EXISTS "ErrorGroup_source_idx" ON "ErrorGroup"("source");

CREATE INDEX IF NOT EXISTS "ErrorGroup_lastSeen_idx" ON "ErrorGroup"("lastSeen");

CREATE INDEX IF NOT EXISTS "ErrorGroup_eventCount_idx" ON "ErrorGroup"("eventCount");

CREATE INDEX IF NOT EXISTS "ErrorOccurrence_groupId_timestamp_idx" ON "ErrorOccurrence"("groupId", "timestamp");

CREATE INDEX IF NOT EXISTS "ErrorOccurrence_timestamp_idx" ON "ErrorOccurrence"("timestamp");

CREATE INDEX IF NOT EXISTS "ChangelogEntry_category_idx" ON "ChangelogEntry"("category");

CREATE INDEX IF NOT EXISTS "ChangelogEntry_isPublished_idx" ON "ChangelogEntry"("isPublished");

CREATE INDEX IF NOT EXISTS "ChangelogEntry_publishedAt_idx" ON "ChangelogEntry"("publishedAt");

CREATE INDEX IF NOT EXISTS "HeroSlide_isActive_sortOrder_idx" ON "HeroSlide"("isActive", "sortOrder");

CREATE INDEX IF NOT EXISTS "AnnouncementBar_isActive_sortOrder_idx" ON "AnnouncementBar"("isActive", "sortOrder");

CREATE UNIQUE INDEX IF NOT EXISTS "ProcessedWebhookEvent_eventId_key" ON "ProcessedWebhookEvent"("eventId");

CREATE INDEX IF NOT EXISTS "ProcessedWebhookEvent_eventId_idx" ON "ProcessedWebhookEvent"("eventId");

CREATE INDEX IF NOT EXISTS "ProcessedWebhookEvent_processedAt_idx" ON "ProcessedWebhookEvent"("processedAt");

CREATE INDEX IF NOT EXISTS "ChatMessage_userId_idx" ON "ChatMessage"("userId");

CREATE INDEX IF NOT EXISTS "ChatMessage_createdAt_idx" ON "ChatMessage"("createdAt");

CREATE INDEX IF NOT EXISTS "ChatMessage_deletedAt_createdAt_idx" ON "ChatMessage"("deletedAt", "createdAt");

CREATE INDEX IF NOT EXISTS "ChatMessage_roomId_createdAt_idx" ON "ChatMessage"("roomId", "createdAt");

CREATE INDEX IF NOT EXISTS "ChatPresence_lastActiveAt_idx" ON "ChatPresence"("lastActiveAt");

CREATE INDEX IF NOT EXISTS "ChatPresence_roomId_lastActiveAt_idx" ON "ChatPresence"("roomId", "lastActiveAt");

CREATE UNIQUE INDEX IF NOT EXISTS "ChatPresence_userId_roomId_key" ON "ChatPresence"("userId", "roomId");

CREATE UNIQUE INDEX IF NOT EXISTS "CreatorChargebackCard_projectId_key" ON "CreatorChargebackCard"("projectId");

CREATE UNIQUE INDEX IF NOT EXISTS "CreatorChargebackCard_nmiCustomerVaultId_key" ON "CreatorChargebackCard"("nmiCustomerVaultId");

CREATE INDEX IF NOT EXISTS "CreatorChargebackCard_projectId_idx" ON "CreatorChargebackCard"("projectId");

CREATE UNIQUE INDEX IF NOT EXISTS "PayPalBankAccount_userId_key" ON "PayPalBankAccount"("userId");

CREATE INDEX IF NOT EXISTS "PayPalBankAccount_userId_idx" ON "PayPalBankAccount"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "FeatureFlag_name_key" ON "FeatureFlag"("name");

CREATE INDEX IF NOT EXISTS "FeatureFlag_name_idx" ON "FeatureFlag"("name");

CREATE INDEX IF NOT EXISTS "DataExportRequest_userId_idx" ON "DataExportRequest"("userId");

CREATE INDEX IF NOT EXISTS "DataExportRequest_status_idx" ON "DataExportRequest"("status");

CREATE INDEX IF NOT EXISTS "DataDeletionRequest_userId_idx" ON "DataDeletionRequest"("userId");

CREATE INDEX IF NOT EXISTS "DataDeletionRequest_status_idx" ON "DataDeletionRequest"("status");

CREATE INDEX IF NOT EXISTS "DataDeletionRequest_scheduledFor_idx" ON "DataDeletionRequest"("scheduledFor");

CREATE INDEX IF NOT EXISTS "CcpaOptOut_userId_idx" ON "CcpaOptOut"("userId");

CREATE INDEX IF NOT EXISTS "CcpaOptOut_email_idx" ON "CcpaOptOut"("email");

CREATE INDEX IF NOT EXISTS "CcpaOptOut_ipAddress_idx" ON "CcpaOptOut"("ipAddress");

CREATE UNIQUE INDEX IF NOT EXISTS "BackerReview_pledgeId_key" ON "BackerReview"("pledgeId");

CREATE INDEX IF NOT EXISTS "BackerReview_creatorId_idx" ON "BackerReview"("creatorId");

CREATE INDEX IF NOT EXISTS "BackerReview_projectId_idx" ON "BackerReview"("projectId");

CREATE INDEX IF NOT EXISTS "BackerReview_userId_idx" ON "BackerReview"("userId");

CREATE INDEX IF NOT EXISTS "BackerReview_isPublished_isHidden_idx" ON "BackerReview"("isPublished", "isHidden");

CREATE UNIQUE INDEX IF NOT EXISTS "SeoPageMeta_path_key" ON "SeoPageMeta"("path");

CREATE INDEX IF NOT EXISTS "SeoPageMeta_path_idx" ON "SeoPageMeta"("path");

CREATE INDEX IF NOT EXISTS "SeoPageMeta_lastAuditScore_idx" ON "SeoPageMeta"("lastAuditScore");

CREATE INDEX IF NOT EXISTS "SeoAudit_createdAt_idx" ON "SeoAudit"("createdAt");

CREATE INDEX IF NOT EXISTS "SeoAudit_status_idx" ON "SeoAudit"("status");

CREATE UNIQUE INDEX IF NOT EXISTS "SeoKeyword_keyword_key" ON "SeoKeyword"("keyword");

CREATE INDEX IF NOT EXISTS "SeoKeyword_keyword_idx" ON "SeoKeyword"("keyword");

CREATE INDEX IF NOT EXISTS "SeoKeyword_isTracked_idx" ON "SeoKeyword"("isTracked");

CREATE INDEX IF NOT EXISTS "SeoKeyword_category_idx" ON "SeoKeyword"("category");

CREATE INDEX IF NOT EXISTS "SeoCronLog_createdAt_idx" ON "SeoCronLog"("createdAt");

CREATE INDEX IF NOT EXISTS "SeoCronLog_status_idx" ON "SeoCronLog"("status");

CREATE UNIQUE INDEX IF NOT EXISTS "SeoRedirect_fromPath_key" ON "SeoRedirect"("fromPath");

CREATE INDEX IF NOT EXISTS "SeoRedirect_fromPath_idx" ON "SeoRedirect"("fromPath");

CREATE INDEX IF NOT EXISTS "SeoRedirect_isActive_idx" ON "SeoRedirect"("isActive");

CREATE INDEX IF NOT EXISTS "IPBlocklist_ipAddress_idx" ON "IPBlocklist"("ipAddress");

CREATE INDEX IF NOT EXISTS "IPBlocklist_expiresAt_idx" ON "IPBlocklist"("expiresAt");

CREATE UNIQUE INDEX IF NOT EXISTS "IPBlocklist_ipAddress_key" ON "IPBlocklist"("ipAddress");


-- ── Foreign keys (guarded: added only when absent, and only when both tables exist) ──

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserMarketingScore_userId_fkey') THEN
    ALTER TABLE "UserMarketingScore" ADD CONSTRAINT "UserMarketingScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FulfillmentIntegration_projectId_fkey') THEN
    ALTER TABLE "FulfillmentIntegration" ADD CONSTRAINT "FulfillmentIntegration_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MarketplaceAlbum_creatorId_fkey') THEN
    ALTER TABLE "MarketplaceAlbum" ADD CONSTRAINT "MarketplaceAlbum_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MarketplaceAlbum_companyId_fkey') THEN
    ALTER TABLE "MarketplaceAlbum" ADD CONSTRAINT "MarketplaceAlbum_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "CompanyProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ErrorOccurrence_groupId_fkey') THEN
    ALTER TABLE "ErrorOccurrence" ADD CONSTRAINT "ErrorOccurrence_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ErrorGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChangelogEntry_authorId_fkey') THEN
    ALTER TABLE "ChangelogEntry" ADD CONSTRAINT "ChangelogEntry_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChatMessage_roomId_fkey') THEN
    ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChatMessage_userId_fkey') THEN
    ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChatPresence_userId_fkey') THEN
    ALTER TABLE "ChatPresence" ADD CONSTRAINT "ChatPresence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChatPresence_roomId_fkey') THEN
    ALTER TABLE "ChatPresence" ADD CONSTRAINT "ChatPresence_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CreatorChargebackCard_projectId_fkey') THEN
    ALTER TABLE "CreatorChargebackCard" ADD CONSTRAINT "CreatorChargebackCard_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PayPalBankAccount_userId_fkey') THEN
    ALTER TABLE "PayPalBankAccount" ADD CONSTRAINT "PayPalBankAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BackerReview_pledgeId_fkey') THEN
    ALTER TABLE "BackerReview" ADD CONSTRAINT "BackerReview_pledgeId_fkey" FOREIGN KEY ("pledgeId") REFERENCES "Pledge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BackerReview_userId_fkey') THEN
    ALTER TABLE "BackerReview" ADD CONSTRAINT "BackerReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BackerReview_projectId_fkey') THEN
    ALTER TABLE "BackerReview" ADD CONSTRAINT "BackerReview_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BackerReview_creatorId_fkey') THEN
    ALTER TABLE "BackerReview" ADD CONSTRAINT "BackerReview_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PayPalPayout_paypalBankAccountId_fkey') THEN
    ALTER TABLE "PayPalPayout" ADD CONSTRAINT "PayPalPayout_paypalBankAccountId_fkey" FOREIGN KEY ("paypalBankAccountId") REFERENCES "PayPalBankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
