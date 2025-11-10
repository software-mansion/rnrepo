# Supabase Database Migrations

This directory contains database migration files for the scheduler's Supabase database.

## Migration File Naming

Migrations are named using the format:
```
YYYYMMDDHHMMSS_description.sql
```

Example: `20240101000000_initial_schema.sql`

- **YYYYMMDDHHMMSS** - Timestamp in UTC (year, month, day, hour, minute, second)
- **description** - Brief description of what the migration does (lowercase, underscores)

## Running Migrations

### Option 1: Using Supabase CLI (Recommended)

If you have the Supabase CLI installed:

```bash
# Link to your Supabase project
supabase link --project-ref your-project-ref

# Run all pending migrations
supabase db push
```

### Option 2: Manual Execution

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Run each migration file in order (sorted by timestamp)
4. Migrations should be idempotent (safe to run multiple times)

## Creating New Migrations

1. Create a new file with the current timestamp:
   ```bash
   # Get current timestamp
   date +%Y%m%d%H%M%S
   # Example output: 20240115143000
   ```

2. Name the file: `YYYYMMDDHHMMSS_your_description.sql`

3. Write your migration SQL:
   ```sql
   -- Migration: Add new field
   -- Created: 2024-01-15
   -- Description: Adds a new field to the builds table

   ALTER TABLE builds ADD COLUMN IF NOT EXISTS new_field TEXT;
   ```

4. Make migrations idempotent by using `IF NOT EXISTS`, `IF EXISTS`, etc.

## Migration Best Practices

1. **Always use IF NOT EXISTS / IF EXISTS** - Makes migrations idempotent
2. **Include rollback considerations** - Document how to undo if needed
3. **Test migrations** - Test on a development database first
4. **One change per migration** - Keep migrations focused and atomic
5. **Add comments** - Document what the migration does and why

## Current Migrations

- `20240101000000_initial_schema.sql` - Initial schema with builds table, indexes, triggers, and RLS policies

