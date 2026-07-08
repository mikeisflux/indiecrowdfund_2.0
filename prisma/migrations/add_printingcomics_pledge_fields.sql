-- SUPERSEDED: This migration originally added per-pledge Printing
-- Comics fields, but print orders are project-level (ship to the
-- creator, who fulfills backers manually). The fields are dropped
-- by add_project_print_order.sql below. Left here as a no-op so
-- migration history is intact for any environment that already ran
-- the original.
SELECT 1;
