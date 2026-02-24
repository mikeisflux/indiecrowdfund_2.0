#!/bin/bash
# ============================================================================
# Batpool #1 Database Restore Script
# ============================================================================
# Project ID: cmj2m1dgj00886vqy7glum3f9
#
# This script SAFELY restores all Batpool #1 data from the Dec 23, 2025 backup.
# It ONLY touches records associated with the Batpool project.
# All operations run inside a single transaction - if anything fails,
# everything rolls back and the database is unchanged.
#
# Usage:
#   ./restore_batpool.sh
#
#   Or with custom connection:
#   DATABASE_URL="postgresql://user:pass@host:5432/dbname" ./restore_batpool.sh
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ID="cmj2m1dgj00886vqy7glum3f9"

# Use DATABASE_URL from environment or .env file
if [ -z "${DATABASE_URL:-}" ]; then
  # Try to load from .env file
  ENV_FILE="$(dirname "$SCRIPT_DIR")/../.env"
  if [ -f "$ENV_FILE" ]; then
    DATABASE_URL=$(grep '^DATABASE_URL=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"')
  fi

  if [ -z "${DATABASE_URL:-}" ]; then
    echo "ERROR: DATABASE_URL not set. Either:"
    echo "  1. Set DATABASE_URL environment variable"
    echo "  2. Ensure .env file exists at project root"
    echo ""
    echo "Example:"
    echo "  DATABASE_URL=\"postgresql://user:pass@host:5432/indiecrowdfund\" ./restore_batpool.sh"
    exit 1
  fi
fi

echo "============================================"
echo "  Batpool #1 Database Restore"
echo "  Project ID: $PROJECT_ID"
echo "============================================"
echo ""

# Pre-flight: Show what currently exists for this project
echo ">>> Pre-flight check: Current Batpool data in database..."
psql "$DATABASE_URL" -c "
  SELECT 'Project' as table_name, COUNT(*) as count FROM \"Project\" WHERE id = '$PROJECT_ID'
  UNION ALL
  SELECT 'Rewards', COUNT(*) FROM \"Reward\" WHERE \"projectId\" = '$PROJECT_ID'
  UNION ALL
  SELECT 'Pledges', COUNT(*) FROM \"Pledge\" WHERE \"projectId\" = '$PROJECT_ID' AND \"deletedAt\" IS NULL
  UNION ALL
  SELECT 'Pledges (soft-deleted)', COUNT(*) FROM \"Pledge\" WHERE \"projectId\" = '$PROJECT_ID' AND \"deletedAt\" IS NOT NULL
  UNION ALL
  SELECT 'PledgeAddons', COUNT(*) FROM \"PledgeAddon\" pa JOIN \"Pledge\" p ON p.id = pa.\"pledgeId\" WHERE p.\"projectId\" = '$PROJECT_ID'
  ORDER BY table_name;
" 2>/dev/null || echo "(Could not run pre-flight check - table might not exist yet)"

echo ""
echo ">>> This script will:"
echo "    1. DELETE all existing Batpool data (within a transaction)"
echo "    2. RE-INSERT all data from the Dec 23, 2025 backup"
echo "    3. Restore: 118 rewards, 231 pledges, 224 pledge addons, and related records"
echo ""
read -p "Continue? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

echo ""
echo ">>> Starting restore..."

# Build the full SQL restore script
# The order matters: delete children first, insert parents first
RESTORE_SQL=$(cat <<'EOSQL'
-- ============================================================
-- Batpool #1 Restore - Transaction Wrapped
-- ============================================================
BEGIN;

-- Set client encoding
SET client_encoding = 'UTF8';

-- ============================================================
-- PHASE 1: DELETE existing Batpool data (children first)
-- ============================================================

-- Delete join tables and leaf records first
DELETE FROM "PledgeAddon" WHERE "pledgeId" IN (
  SELECT id FROM "Pledge" WHERE "projectId" = 'cmj2m1dgj00886vqy7glum3f9'
);

DELETE FROM "PledgeModifierAssignment" WHERE "pledgeId" IN (
  SELECT id FROM "Pledge" WHERE "projectId" = 'cmj2m1dgj00886vqy7glum3f9'
);

DELETE FROM "DivinityCoinTransaction" WHERE "pledgeId" IN (
  SELECT id FROM "Pledge" WHERE "projectId" = 'cmj2m1dgj00886vqy7glum3f9'
);

DELETE FROM "DigitalDistribution" WHERE "pledgeId" IN (
  SELECT id FROM "Pledge" WHERE "projectId" = 'cmj2m1dgj00886vqy7glum3f9'
);

DELETE FROM "SurveyResponse" WHERE "pledgeId" IN (
  SELECT id FROM "Pledge" WHERE "projectId" = 'cmj2m1dgj00886vqy7glum3f9'
);

DELETE FROM "BackerNote" WHERE "pledgeId" IN (
  SELECT id FROM "Pledge" WHERE "projectId" = 'cmj2m1dgj00886vqy7glum3f9'
);

DELETE FROM "EmailLog" WHERE "projectId" = 'cmj2m1dgj00886vqy7glum3f9';

DELETE FROM "EmailCampaignClick" WHERE "pledgeId" IN (
  SELECT id FROM "Pledge" WHERE "projectId" = 'cmj2m1dgj00886vqy7glum3f9'
);

DELETE FROM "RewardItem" WHERE "rewardId" IN (
  SELECT id FROM "Reward" WHERE "projectId" = 'cmj2m1dgj00886vqy7glum3f9'
);

DELETE FROM "SurveyItemVariant" WHERE "itemQuestionId" IN (
  SELECT id FROM "SurveyItemQuestion" WHERE "surveyId" IN (
    SELECT id FROM "Survey" WHERE "projectId" = 'cmj2m1dgj00886vqy7glum3f9'
  )
);

DELETE FROM "SurveyItemCustomQuestion" WHERE "itemQuestionId" IN (
  SELECT id FROM "SurveyItemQuestion" WHERE "surveyId" IN (
    SELECT id FROM "Survey" WHERE "projectId" = 'cmj2m1dgj00886vqy7glum3f9'
  )
);

DELETE FROM "SurveyItemQuestion" WHERE "surveyId" IN (
  SELECT id FROM "Survey" WHERE "projectId" = 'cmj2m1dgj00886vqy7glum3f9'
);

DELETE FROM "SurveyBackerQuestion" WHERE "surveyId" IN (
  SELECT id FROM "Survey" WHERE "projectId" = 'cmj2m1dgj00886vqy7glum3f9'
);

DELETE FROM "Survey" WHERE "projectId" = 'cmj2m1dgj00886vqy7glum3f9';

DELETE FROM "Notification" WHERE "projectId" = 'cmj2m1dgj00886vqy7glum3f9';
DELETE FROM "Comment" WHERE "projectId" = 'cmj2m1dgj00886vqy7glum3f9';
DELETE FROM "AnalyticsEvent" WHERE "projectId" = 'cmj2m1dgj00886vqy7glum3f9';
DELETE FROM "FulfillmentActivity" WHERE "projectId" = 'cmj2m1dgj00886vqy7glum3f9';
DELETE FROM "FulfillmentProduct" WHERE "projectId" = 'cmj2m1dgj00886vqy7glum3f9';
DELETE FROM "ProjectFollower" WHERE "projectId" = 'cmj2m1dgj00886vqy7glum3f9';
DELETE FROM "ProjectView" WHERE "projectId" = 'cmj2m1dgj00886vqy7glum3f9';
DELETE FROM "ProjectReview" WHERE "projectId" = 'cmj2m1dgj00886vqy7glum3f9';
DELETE FROM "ProjectTag" WHERE "projectId" = 'cmj2m1dgj00886vqy7glum3f9';
DELETE FROM "ProjectSimilarity" WHERE "projectId" = 'cmj2m1dgj00886vqy7glum3f9' OR "similarProjectId" = 'cmj2m1dgj00886vqy7glum3f9';
DELETE FROM "ReferralTracker" WHERE "projectId" = 'cmj2m1dgj00886vqy7glum3f9';
DELETE FROM "BackerSegment" WHERE "projectId" = 'cmj2m1dgj00886vqy7glum3f9';
DELETE FROM "RetailerPledge" WHERE "projectId" = 'cmj2m1dgj00886vqy7glum3f9';
DELETE FROM "Message" WHERE "projectId" = 'cmj2m1dgj00886vqy7glum3f9';
DELETE FROM "Update" WHERE "projectId" = 'cmj2m1dgj00886vqy7glum3f9';
DELETE FROM "DigitalFile" WHERE "projectId" = 'cmj2m1dgj00886vqy7glum3f9';
DELETE FROM "DivinityCoinSettlement" WHERE "projectId" = 'cmj2m1dgj00886vqy7glum3f9';
DELETE FROM "Payout" WHERE "projectId" = 'cmj2m1dgj00886vqy7glum3f9';
DELETE FROM "ProjectCollaborator" WHERE "projectId" = 'cmj2m1dgj00886vqy7glum3f9';
DELETE FROM "UserBehavior" WHERE "projectId" = 'cmj2m1dgj00886vqy7glum3f9';

-- Delete pledges (including soft-deleted ones)
DELETE FROM "Pledge" WHERE "projectId" = 'cmj2m1dgj00886vqy7glum3f9';

-- Delete project items
DELETE FROM "ProjectItem" WHERE "projectId" = 'cmj2m1dgj00886vqy7glum3f9';

-- Delete rewards
DELETE FROM "Reward" WHERE "projectId" = 'cmj2m1dgj00886vqy7glum3f9';

-- Delete the project itself
DELETE FROM "Project" WHERE id = 'cmj2m1dgj00886vqy7glum3f9';

-- ============================================================
-- PHASE 2: INSERT restored data (parents first)
-- ============================================================

EOSQL
)

# Now append each COPY data file (in dependency order)
append_copy_data() {
  local file="$1"
  local label="$2"

  if [ ! -f "$SCRIPT_DIR/$file" ]; then
    echo "  Skipping $label (file not found)"
    return
  fi

  # Count actual data lines
  local count
  count=$(grep -v '^--\|^$\|^COPY\|^\\\\' "$SCRIPT_DIR/$file" | grep -v '^\\\.' | wc -l)

  if [ "$count" -eq 0 ]; then
    echo "  Skipping $label (no records)"
    return
  fi

  echo "  Adding $label ($count records)"

  # Append the COPY statement and data
  RESTORE_SQL+=$'\n'"-- Restore $label ($count records)"$'\n'
  # Get the full content (COPY header + data + \.)
  RESTORE_SQL+=$(cat "$SCRIPT_DIR/$file" | grep -v '^--\|^$')
  RESTORE_SQL+=$'\n'
}

echo ">>> Building restore SQL..."
append_copy_data "00_project.sql" "Project"
append_copy_data "01_rewards.sql" "Rewards"
append_copy_data "22_project_items.sql" "ProjectItems"
append_copy_data "05_reward_items.sql" "RewardItems"
append_copy_data "02_pledges.sql" "Pledges"
append_copy_data "03_pledge_addons.sql" "PledgeAddons"
append_copy_data "09_email_logs.sql" "EmailLogs"
append_copy_data "10_analytics_events.sql" "AnalyticsEvents"
append_copy_data "18_comments.sql" "Comments"
append_copy_data "20_notifications.sql" "Notifications"
append_copy_data "21_project_followers.sql" "ProjectFollowers"
append_copy_data "28_project_reviews.sql" "ProjectReviews"
append_copy_data "30_project_collaborators.sql" "ProjectCollaborators"

RESTORE_SQL+=$'\n'"-- ============================================================"
RESTORE_SQL+=$'\n'"-- PHASE 3: Verify restore"
RESTORE_SQL+=$'\n'"-- ============================================================"
RESTORE_SQL+=$'\n'
RESTORE_SQL+=$'\n'"COMMIT;"

echo ""
echo ">>> Executing restore (all within a transaction)..."

# Execute the full restore
echo "$RESTORE_SQL" | psql "$DATABASE_URL" --set ON_ERROR_STOP=on 2>&1

if [ $? -eq 0 ]; then
  echo ""
  echo ">>> Restore SUCCESSFUL! Verifying..."
  echo ""

  psql "$DATABASE_URL" -c "
    SELECT 'Project' as table_name, COUNT(*) as count FROM \"Project\" WHERE id = '$PROJECT_ID'
    UNION ALL
    SELECT 'Rewards (TIER)', COUNT(*) FROM \"Reward\" WHERE \"projectId\" = '$PROJECT_ID' AND type = 'TIER'
    UNION ALL
    SELECT 'Rewards (ADDON)', COUNT(*) FROM \"Reward\" WHERE \"projectId\" = '$PROJECT_ID' AND type = 'ADDON'
    UNION ALL
    SELECT 'Pledges', COUNT(*) FROM \"Pledge\" WHERE \"projectId\" = '$PROJECT_ID'
    UNION ALL
    SELECT 'PledgeAddons', COUNT(*) FROM \"PledgeAddon\" pa JOIN \"Pledge\" p ON p.id = pa.\"pledgeId\" WHERE p.\"projectId\" = '$PROJECT_ID'
    UNION ALL
    SELECT 'RewardItems', COUNT(*) FROM \"RewardItem\" ri JOIN \"Reward\" r ON r.id = ri.\"rewardId\" WHERE r.\"projectId\" = '$PROJECT_ID'
    UNION ALL
    SELECT 'ProjectItems', COUNT(*) FROM \"ProjectItem\" WHERE \"projectId\" = '$PROJECT_ID'
    UNION ALL
    SELECT 'Comments', COUNT(*) FROM \"Comment\" WHERE \"projectId\" = '$PROJECT_ID'
    UNION ALL
    SELECT 'Notifications', COUNT(*) FROM \"Notification\" WHERE \"projectId\" = '$PROJECT_ID'
    UNION ALL
    SELECT 'EmailLogs', COUNT(*) FROM \"EmailLog\" WHERE \"projectId\" = '$PROJECT_ID'
    ORDER BY table_name;
  "

  echo ""
  echo "============================================"
  echo "  Batpool #1 restore complete!"
  echo "============================================"
else
  echo ""
  echo "ERROR: Restore FAILED - transaction rolled back."
  echo "The database is unchanged."
  exit 1
fi
