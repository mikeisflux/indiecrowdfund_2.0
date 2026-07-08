-- Drop the per-pledge Printing Comics columns added by the earlier
-- migration — we got the model wrong (printing is project-level, not
-- per-pledge). Idempotent so environments that didn't run the old
-- one are fine.
ALTER TABLE "Pledge" DROP COLUMN IF EXISTS "printingComicsOrderId";
ALTER TABLE "Pledge" DROP COLUMN IF EXISTS "printingComicsOrderNumber";
ALTER TABLE "Pledge" DROP COLUMN IF EXISTS "printingComicsStatus";
ALTER TABLE "Pledge" DROP COLUMN IF EXISTS "printingComicsTrackingNumber";
ALTER TABLE "Pledge" DROP COLUMN IF EXISTS "printingComicsLastSyncedAt";
DROP INDEX IF EXISTS "Pledge_printingComicsOrderId_key";

-- Project-level print order: the creator submits one to Printing
-- Comics for a campaign, the printer prints + ships to the CREATOR,
-- who fulfills backers themselves. Multiple orders per project are
-- supported (initial run, reprints, variant covers, restocks).
CREATE TABLE IF NOT EXISTS "ProjectPrintOrder" (
  "id"                          TEXT          PRIMARY KEY,
  "projectId"                   TEXT          NOT NULL,
  "submittedById"               TEXT          NOT NULL,

  "printingComicsOrderId"       TEXT,
  "printingComicsOrderNumber"   TEXT,
  "status"                      TEXT          NOT NULL DEFAULT 'DRAFT',
  "trackingNumber"              TEXT,
  "shippingMethod"              TEXT,
  "lastSyncedAt"                TIMESTAMP(3),

  "productSlug"                 TEXT          NOT NULL,
  "quantity"                    INTEGER       NOT NULL,
  "options"                     JSONB         NOT NULL,
  "files"                       JSONB         NOT NULL,

  "shippingAddress"             JSONB         NOT NULL,
  "email"                       TEXT          NOT NULL,

  "subtotalCents"               INTEGER,
  "shippingCents"               INTEGER,
  "taxCents"                    INTEGER,
  "discountCents"               INTEGER,
  "totalCents"                  INTEGER,
  "currency"                    TEXT          DEFAULT 'USD',

  "notes"                       TEXT,

  "createdAt"                   TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                   TIMESTAMP(3)  NOT NULL,

  CONSTRAINT "ProjectPrintOrder_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE,
  CONSTRAINT "ProjectPrintOrder_submittedById_fkey"
    FOREIGN KEY ("submittedById") REFERENCES "User" ("id") ON DELETE NO ACTION
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProjectPrintOrder_printingComicsOrderId_key"
  ON "ProjectPrintOrder" ("printingComicsOrderId");
CREATE INDEX IF NOT EXISTS "ProjectPrintOrder_projectId_idx"
  ON "ProjectPrintOrder" ("projectId");
CREATE INDEX IF NOT EXISTS "ProjectPrintOrder_submittedById_idx"
  ON "ProjectPrintOrder" ("submittedById");
CREATE INDEX IF NOT EXISTS "ProjectPrintOrder_status_idx"
  ON "ProjectPrintOrder" ("status");
