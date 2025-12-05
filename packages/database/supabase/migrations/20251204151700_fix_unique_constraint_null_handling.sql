-- Migration: Fix unique constraint to properly handle NULL values in worklets_version
-- Created: 2025-12-04
-- Description: Replaces the UNIQUE constraint with a unique index that treats NULL values as equal
--              This ensures only one row can exist with NULL worklets_version for the same combination
--              of package_name, version, rn_version, and platform

-- Create a unique index that treats NULL as empty string for uniqueness purposes
-- This ensures NULL values are considered equal to each other
CREATE UNIQUE INDEX IF NOT EXISTS idx_builds_unique
ON builds (
  package_name,
  version,
  rn_version,
  platform,
  COALESCE(worklets_version, '')
);

-- Drop the existing UNIQUE constraint
ALTER TABLE builds DROP CONSTRAINT IF EXISTS builds_package_name_version_rn_version_platform_worklets_ve_key;

-- Drop the old non-unique index since the unique index serves the same purpose
DROP INDEX IF EXISTS idx_builds_lookup;

