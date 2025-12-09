-- Migration: Add completed_builds view
-- Created: 2025-12-09
-- Description: Creates a view for easier querying of which libraries have been successfully built
--              The view shows distinct packages and their platform availability (android/ios)
--              for all builds that have completed status

-- Create view for easier querying of completed builds
CREATE OR REPLACE VIEW completed_builds AS
SELECT
  DISTINCT package_name,
  CASE WHEN platform = 'android' THEN true ELSE false END AS android,
  CASE WHEN platform = 'ios' THEN true ELSE false END AS ios
FROM
  builds
WHERE
  status = 'completed';

COMMENT ON VIEW completed_builds IS 'Shows distinct packages with their platform availability for completed builds. Useful for querying which libraries are ready for use.';
COMMENT ON VIEW completed_builds.package_name IS 'NPM package name';
COMMENT ON VIEW completed_builds.android IS 'True if library has been successfully built for Android';
COMMENT ON VIEW completed_builds.ios IS 'True if library has been successfully built for iOS';

-- Index on the view for faster lookups
CREATE INDEX IF NOT EXISTS idx_completed_builds_lookup ON completed_builds(package_name);
