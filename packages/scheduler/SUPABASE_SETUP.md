# Supabase Setup for Scheduler

> **Note:** Database setup has been moved to the `@rnrepo/database` package. See `packages/database/README.md` for details.

## Environment Variables

The scheduler requires the following environment variables to connect to Supabase:

- `SUPABASE_URL` - Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
- `SUPABASE_KEY` - Your Supabase anonymous key (uses RLS policies for security)

## Database Setup

See `packages/database/README.md` for migration instructions. Migrations are located in `packages/database/supabase/migrations/`.

## Database Schema

The `builds` table tracks build status for React Native library builds:

- `id` - Auto-incrementing primary key
- `package_name` - NPM package name (e.g., `react-native-screens`)
- `version` - Package version (e.g., `4.18.1`)
- `platform` - Target platform: `android` or `ios`
- `react_version` - React Native version (e.g., `0.79.0`)
- `status` - Build status: `scheduled`, `completed`, or `failed`
- `retry` - Boolean flag indicating if the build should be retried
- `github_run_url` - URL to the GitHub Actions workflow run (optional)
- `build_duration_seconds` - Time taken to build artifacts in seconds with 3 decimal precision (optional, only for completed builds)
- `created_at` - Timestamp when the record was created
- `updated_at` - Timestamp when the record was last updated

## Retry Mechanism

To manually retry a build:

1. Set the `retry` field to `true` in the database for the specific build record
2. The scheduler will ignore the existing `scheduled` or `completed` status and allow the build to be scheduled again
3. After scheduling, the `retry` flag should be reset to `false` manually

## Usage

The scheduler automatically:

- Checks if a build is already scheduled/completed before scheduling
- Creates a build record when scheduling a new build
- Skips builds that are already scheduled or completed (unless `retry` is `true`)
