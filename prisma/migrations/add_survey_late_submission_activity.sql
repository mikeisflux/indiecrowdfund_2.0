-- Creator locks (Lock Orders / Lock Addresses) no longer shut out backers
-- who haven't answered the survey. A late response goes through, locks
-- itself, and is recorded on the fulfillment timeline with this type.
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'SURVEY_LATE_SUBMISSION';
