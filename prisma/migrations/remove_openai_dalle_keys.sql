-- Remove OpenAI and DALL-E API key columns from PlatformSettings
-- All AI features now use Anthropic Claude exclusively

ALTER TABLE "PlatformSettings" DROP COLUMN IF EXISTS "openaiApiKey";
ALTER TABLE "PlatformSettings" DROP COLUMN IF EXISTS "dalleApiKey";
ALTER TABLE "PlatformSettings" ALTER COLUMN "aiProvider" SET DEFAULT 'anthropic';
