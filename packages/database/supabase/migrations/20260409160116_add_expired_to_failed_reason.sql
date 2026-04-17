-- Migration: Add expired value to failed_reason_type enum
-- Created: 2026-04-09
-- Description: Adds expired reason to the failed_reason_type enum

ALTER TYPE failed_reason_type ADD VALUE IF NOT EXISTS 'expired';

COMMENT ON COLUMN builds.failed_reason IS 'Reason a build failed: buildable (transient issue, can retry), unbuildable (incompatible versions), fixable (requires manual intervention), unknown (not yet analyzed), expired (build logs expired)';
