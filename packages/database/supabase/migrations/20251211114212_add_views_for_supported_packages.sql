-- Migration: Add views for supported packages
-- Created: 2025-12-11
-- Description: Create json-view for supported packages based on completed builds
--              Create a view with all packages names


-- Drop previous view if exists
DROP VIEW IF EXISTS completed_packages;

-- Create view for easier querying of completed builds
CREATE OR REPLACE VIEW completed_packages AS
WITH package_details AS (
  -- First Level of Aggregation: Get package version arrays for each RN version/package combination
  SELECT
    rn_version,
    package_name,
    -- Get unique Android versions for this package
    array_remove(array_agg(DISTINCT version) FILTER (WHERE platform = 'android'), NULL) AS android_versions,
    -- Get unique iOS versions for this package
    array_remove(array_agg(DISTINCT version) FILTER (WHERE platform = 'ios'), NULL) AS ios_versions
  FROM builds
  GROUP BY 1, 2 -- Group by rn_version, package_name
),
package_json AS (
  -- Second Level of Aggregation: Build the package JSON object (key=package_name)
  SELECT
    rn_version,
    jsonb_object_agg(
      package_name,
      jsonb_build_object(
        'name', package_name,
        'android_versions', android_versions,
        'ios_versions', ios_versions
      )
    ) AS packages_by_rn_version
  FROM package_details
  GROUP BY 1 -- Group by rn_version
)
-- Final Level: Combine all RN version objects into a single JSON object
SELECT
  jsonb_object_agg(
    rn_version,
    packages_by_rn_version
  ) AS final_output
FROM package_json;

COMMENT ON VIEW completed_packages IS 'Shows distinct packages with their platform availability for completed builds. Useful for querying which libraries are ready for use.';
COMMENT ON COLUMN completed_packages.final_output IS 'JSON object mapping RN versions to their supported packages and platform versions.';

-- Create view with all package names
create view completed_packages_names as
select distinct
  package_name
from
  builds
where
  status = 'completed';

COMMENT ON VIEW completed_packages_names IS 'View containing all distinct package names from completed builds.';
COMMENT ON COLUMN completed_packages_names.package_name IS 'Name of the package from completed builds.';
