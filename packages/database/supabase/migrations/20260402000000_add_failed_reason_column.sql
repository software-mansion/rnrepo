-- Migration: Add failed_reason column to builds table
-- Created: 2026-04-02
-- Description: Adds failed_reason column to track why a build failed

-- Create ENUM type for failed reason
CREATE TYPE failed_reason_type AS ENUM ('buildable', 'unbuildable', 'actionNeeded', 'unknown');

-- Add failed_reason column with default value 'unknown'
ALTER TABLE builds
  ADD COLUMN failed_reason failed_reason_type NOT NULL DEFAULT 'unknown';

COMMENT ON COLUMN builds.failed_reason IS 'Reason a build failed: buildable (transient issue, can retry), unbuildable (incompatible versions), actionNeeded (requires manual intervention), unknown (not yet analyzed)';
