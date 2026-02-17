-- Promotional Popup table for site feature tour
CREATE TABLE IF NOT EXISTS "PromoPopup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "showFrequency" TEXT NOT NULL DEFAULT 'once_per_session',
    "slides" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
