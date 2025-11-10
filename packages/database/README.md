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
  type BuildStatus
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

