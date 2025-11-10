import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Platform } from './types';

export type BuildStatus = 'scheduled' | 'completed' | 'failed';

export interface BuildRecord {
  id?: number;
  package_name: string;
  version: string;
  platform: Platform;
  react_version: string;
  status: BuildStatus;
  retry: boolean;
  github_run_url?: string | null;
  build_duration_seconds?: number | null;
  created_at?: string;
  updated_at?: string;
}

// Initialize Supabase client
// Uses SUPABASE_ANON_KEY with RLS policies
function getSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required'
    );
  }

  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Checks if a build record exists with retry=false.
 * Returns true if such a record exists (skip scheduling).
 * Returns false if no such record exists (allow scheduling, including if record exists with retry=true).
 */
export async function isBuildAlreadyScheduled(
  packageName: string,
  version: string,
  reactVersion: string,
  platform: Platform
): Promise<boolean> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('builds')
    .select('id')
    .eq('package_name', packageName)
    .eq('version', version)
    .eq('react_version', reactVersion)
    .eq('platform', platform)
    .eq('retry', false)
    .maybeSingle();

  if (error) {
    console.error(
      `Error checking build status for ${packageName}@${version} (RN ${reactVersion}, ${platform}):`,
      error
    );
    // On error, assume not scheduled to avoid blocking builds
    return false;
  }

  // If a record exists with retry=false, skip scheduling
  // If no such record exists (either no record or record with retry=true), allow scheduling
  return data !== null;
}

/**
 * Creates or updates a build record with status 'scheduled'.
 */
export async function createBuildRecord(
  packageName: string,
  version: string,
  reactVersion: string,
  platform: Platform,
  githubRunUrl?: string
): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase.from('builds').upsert(
    {
      package_name: packageName,
      version,
      react_version: reactVersion,
      platform,
      status: 'scheduled',
      retry: false,
      github_run_url: githubRunUrl || null,
    },
    {
      onConflict: 'package_name,version,react_version,platform',
    }
  );

  if (error) {
    throw new Error(`Failed to create/update build record: ${error.message}`);
  }
}

/**
 * Updates the status of a build record.
 */
export async function updateBuildStatus(
  packageName: string,
  version: string,
  reactVersion: string,
  platform: Platform,
  status: BuildStatus,
  options?: {
    githubRunUrl?: string;
    buildDurationSeconds?: number;
  }
): Promise<void> {
  const supabase = getSupabaseClient();

  const updateData: {
    status: BuildStatus;
    updated_at: string;
    github_run_url?: string | null;
    build_duration_seconds?: number | null;
  } = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (options?.githubRunUrl !== undefined) {
    updateData.github_run_url = options.githubRunUrl || null;
  }

  if (options?.buildDurationSeconds !== undefined) {
    updateData.build_duration_seconds = options.buildDurationSeconds || null;
  }

  const { error } = await supabase
    .from('builds')
    .update(updateData)
    .eq('package_name', packageName)
    .eq('version', version)
    .eq('react_version', reactVersion)
    .eq('platform', platform);

  if (error) {
    throw new Error(`Failed to update build status: ${error.message}`);
  }
}
