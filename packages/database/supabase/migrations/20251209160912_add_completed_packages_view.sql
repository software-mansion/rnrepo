-- Migration: Add completed_packages view
-- Created: 2025-12-09
-- Description: Creates a view for easier querying of which libraries have been successfully built
--              The view shows distinct packages and their platform availability (android/ios)
--              for all builds that have completed status

-- Create view for easier querying of completed builds
CREATE OR REPLACE VIEW completed_packages AS
SELECT
  package_name,
  bool_or(CASE WHEN platform = 'android' THEN true ELSE false END) AS android,
  bool_or(CASE WHEN platform = 'ios' THEN true ELSE false END) AS ios
FROM builds
WHERE status = 'completed'
GROUP BY package_name;

COMMENT ON VIEW completed_packages IS 'Shows distinct packages with their platform availability for completed builds. Useful for querying which libraries are ready for use.';
COMMENT ON COLUMN completed_packages.package_name IS 'NPM package name';
COMMENT ON COLUMN completed_packages.android IS 'True if library has been successfully built for Android';
COMMENT ON COLUMN completed_packages.ios IS 'True if library has been successfully built for iOS';