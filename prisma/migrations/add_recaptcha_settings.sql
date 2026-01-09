-- Add reCAPTCHA settings to PlatformSettings
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "recaptchaEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "recaptchaSiteKey" TEXT;
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "recaptchaSecretKey" TEXT;
