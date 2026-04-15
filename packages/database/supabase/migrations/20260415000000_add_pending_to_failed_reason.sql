-- Migration: Add pending value to failed_reason_type enum and change default
-- Created: 2026-04-15
-- Description: Adds pending as default reason (not yet analyzed); unknown now means analyzed but cause undetermined

ALTER TYPE failed_reason_type ADD VALUE IF NOT EXISTS 'pending';

ALTER TABLE builds ALTER COLUMN failed_reason SET DEFAULT 'pending';

COMMENT ON COLUMN builds.failed_reason IS 'Reason a build failed: buildable (transient issue, can retry), unbuildable (incompatible versions), fixable (requires manual intervention), unknown (analyzed but cause undetermined), expired (build logs expired), pending (not yet analyzed)';
