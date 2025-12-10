-- Migration: Align unique index with ON CONFLICT columns
-- Created: 2025-12-10
-- Description: Replace expression-based unique index with a column-based
--              unique index using NULLS NOT DISTINCT so upsert on
--              (package_name, version, rn_version, platform, worklets_version)
--              matches the constraint when worklets_version is NULL.

-- Remove the previous expression index
DROP INDEX IF EXISTS idx_builds_unique;

-- Create a unique index that treats NULLs as equal for worklets_version
CREATE UNIQUE INDEX IF NOT EXISTS idx_builds_unique
ON builds (
  package_name,
  version,
  rn_version,
  platform,
  worklets_version
) NULLS NOT DISTINCT;

