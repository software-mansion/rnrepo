-- Migration: Set pending as default for failed_reason and migrate unknown rows
-- Created: 2026-04-15
-- Description: Sets 'pending' as default reason (not yet analyzed); unknown now means analyzed but cause undetermined

ALTER TABLE builds ALTER COLUMN failed_reason SET DEFAULT 'pending';

UPDATE builds
SET failed_reason = 'pending'
WHERE failed_reason = 'unknown';

COMMENT ON COLUMN builds.failed_reason IS 'Reason a build failed: buildable (transient issue, can retry), unbuildable (incompatible versions), fixable (requires manual intervention), unknown (analyzed but cause undetermined), expired (build logs expired), pending (not yet analyzed)';
