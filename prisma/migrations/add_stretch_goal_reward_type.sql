-- Stretch goals: campaign milestones that attach themselves to every
-- qualifying pledge once the campaign's raised total passes a threshold.
--
-- They reuse the Reward table (type STRETCH_GOAL, threshold in
-- "unlockAtAmount", amount 0) and the PledgeAddon join, so this migration adds
-- one enum value and nothing else. Run add_reward_unlock_at_amount.sql first —
-- a stretch goal without that column has no threshold to compare against.
--
-- No BEGIN/COMMIT: ALTER TYPE ... ADD VALUE cannot be used by statements in
-- the same transaction that added it, and older Postgres refuses it inside a
-- transaction block entirely. Run as-is, on its own.
--
-- IF NOT EXISTS makes it re-runnable.

ALTER TYPE "RewardType" ADD VALUE IF NOT EXISTS 'STRETCH_GOAL';
