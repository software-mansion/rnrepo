-- Migration: Initial schema for builds table
-- Created: 2025-11-10
-- Description: Creates the builds table with all initial fields, indexes, triggers, and RLS policies

-- Create ENUM types
CREATE TYPE platform_type AS ENUM ('android', 'ios');
CREATE TYPE build_status_type AS ENUM ('scheduled', 'completed', 'failed');

CREATE TABLE IF NOT EXISTS builds (
  id BIGSERIAL PRIMARY KEY,
  package_name TEXT NOT NULL,
  version TEXT NOT NULL,
  platform platform_type NOT NULL,
  rn_version TEXT NOT NULL,
  worklets_version TEXT,
  status build_status_type NOT NULL DEFAULT 'scheduled',
  retry BOOLEAN NOT NULL DEFAULT false,
  github_run_url TEXT,
  build_duration_seconds NUMERIC(10, 3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure unique combination of package, version, rn_version, platform, and worklets_version
  UNIQUE(package_name, version, rn_version, platform, worklets_version)
);

-- Create index for faster lookups (worklets_version placed after platform to take advantage of optional nature)
CREATE INDEX IF NOT EXISTS idx_builds_lookup ON builds(package_name, version, rn_version, platform, worklets_version);
CREATE INDEX IF NOT EXISTS idx_builds_status ON builds(status);
CREATE INDEX IF NOT EXISTS idx_builds_retry ON builds(retry) WHERE retry = true;

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_builds_updated_at
  BEFORE UPDATE ON builds
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE builds IS 'Tracks build status for React Native library builds';
COMMENT ON COLUMN builds.package_name IS 'NPM package name (e.g., react-native-screens)';
COMMENT ON COLUMN builds.version IS 'Package version (e.g., 4.18.1)';
COMMENT ON COLUMN builds.platform IS 'Target platform: android or ios';
COMMENT ON COLUMN builds.rn_version IS 'React Native version (e.g., 0.79.0)';
COMMENT ON COLUMN builds.worklets_version IS 'React Native Worklets version (e.g., 0.1.0), optional';
COMMENT ON COLUMN builds.status IS 'Build status: scheduled, completed, or failed';
COMMENT ON COLUMN builds.retry IS 'If true, this build should be retried (ignores existing scheduled/completed status)';
COMMENT ON COLUMN builds.github_run_url IS 'URL to the GitHub Actions workflow run';
COMMENT ON COLUMN builds.build_duration_seconds IS 'Time taken to build artifacts in seconds (3 decimal precision)';

-- Enable Row Level Security
ALTER TABLE builds ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow SELECT (reading)
CREATE POLICY "Allow select on builds" ON builds
  FOR SELECT
  USING (true);

-- RLS Policy: Allow INSERT (creating new rows)
CREATE POLICY "Allow insert on builds" ON builds
  FOR INSERT
  WITH CHECK (true);

-- RLS Policy: Allow UPDATE (but trigger will restrict which fields can be modified)
CREATE POLICY "Allow update on builds" ON builds
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- RLS Policy: Disallow DELETE
-- No policy for DELETE means DELETE operations are blocked by default

-- Trigger function to validate that only specific fields can be modified
CREATE OR REPLACE FUNCTION validate_build_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if any non-modifiable fields have changed
  IF OLD.package_name IS DISTINCT FROM NEW.package_name THEN
    RAISE EXCEPTION 'package_name cannot be modified';
  END IF;

  IF OLD.version IS DISTINCT FROM NEW.version THEN
    RAISE EXCEPTION 'version cannot be modified';
  END IF;

  IF OLD.platform IS DISTINCT FROM NEW.platform THEN
    RAISE EXCEPTION 'platform cannot be modified';
  END IF;

  IF OLD.rn_version IS DISTINCT FROM NEW.rn_version THEN
    RAISE EXCEPTION 'rn_version cannot be modified';
  END IF;

  IF OLD.worklets_version IS DISTINCT FROM NEW.worklets_version THEN
    RAISE EXCEPTION 'worklets_version cannot be modified';
  END IF;

  IF OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'created_at cannot be modified';
  END IF;

  -- updated_at is automatically set by the trigger, so we don't check it

  -- Allow status, build_duration_seconds, retry, and github_run_url to be modified
  -- All other fields are immutable after creation
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to enforce update restrictions
CREATE TRIGGER validate_build_update_trigger
  BEFORE UPDATE ON builds
  FOR EACH ROW
  EXECUTE FUNCTION validate_build_update();

