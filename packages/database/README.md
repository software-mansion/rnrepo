# Database Package

This package contains all database-related code for build tracking, including Supabase client functions and migrations.

## Structure

```
packages/database/
├── src/
│   ├── index.ts      # Main database functions
│   └── types.ts      # TypeScript types
├── supabase/
│   ├── migrations/   # SQL migration files
│   └── config.toml   # Supabase CLI configuration
└── package.json
```

## Usage

### Running Migrations

From the `packages/database` directory:

```bash
# Push migrations to remote Supabase project
bun run migrate

# Or use Supabase CLI directly
supabase db push
```

### Using Database Functions

Import functions from this package:

```typescript
import {
  isBuildAlreadyScheduled,
  createBuildRecord,
  updateBuildStatus,
  type Platform,
  type BuildStatus,
} from '@rnrepo/database';
```

## Environment Variables

Required environment variables:

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_KEY` - Your Supabase anonymous key (uses RLS policies)

## Supabase CLI Setup

To use Supabase CLI from this package:

1. Install Supabase CLI globally or locally:

   ```bash
   npm install -g supabase
   ```

2. Link to your project:

   ```bash
   cd packages/database
   supabase link --project-ref your-project-ref
   ```

3. Run migrations:
   ```bash
   supabase db push
   ```

## Database Schema

The `builds` table tracks build status for React Native library builds:

- `id` - Auto-incrementing primary key
- `package_name` - NPM package name (e.g., `react-native-screens`)
- `version` - Package version (e.g., `4.18.1`)
- `platform` - Target platform: `android` or `ios` (ENUM type)
- `react_version` - React Native version (e.g., `0.79.0`)
- `status` - Build status: `scheduled`, `completed`, or `failed` (ENUM type)
- `retry` - Boolean flag indicating if the build should be retried
- `github_run_url` - URL to the GitHub Actions workflow run (optional)
- `build_duration_seconds` - Time taken to build artifacts in seconds with 3 decimal precision (optional, only for completed builds)
- `created_at` - Timestamp when the record was created
- `updated_at` - Timestamp when the record was last updated

### Unique Constraint

The table has a unique constraint on `(package_name, version, react_version, platform)` to ensure only one build record exists per combination.

## Retry Mechanism

To manually retry a build:

1. Set the `retry` field to `true` in the database for the specific build record
2. The scheduler will ignore the existing `scheduled` or `completed` status and allow the build to be scheduled again
3. After scheduling, the `retry` flag should be reset to `false` manually

## How It Works

The database functions are used by the scheduler and publisher:

- **Scheduler**: Checks if builds are already scheduled/completed before scheduling new ones, and creates build records when scheduling
- **Publisher**: Updates build status to `completed` or `failed` when builds finish

Builds are automatically skipped if they already exist with `retry=false`. If `retry=true`, the scheduler will allow rescheduling.
