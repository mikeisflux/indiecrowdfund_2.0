-- Pre-order store: a creator can keep taking orders after their campaign
-- ends (Late Backers > Pre-Order Store). Gated server-side to campaigns
-- that can actually settle those charges (KIA, or funded AoN).
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "preOrdersEnabled" BOOLEAN NOT NULL DEFAULT false;
