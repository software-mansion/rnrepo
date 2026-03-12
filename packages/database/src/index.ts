import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  Platform,
  BuildStatus,
  BuildRecord,
  LibrariesData
} from './types';

// Initialize Supabase client
// Uses SUPABASE_KEY with RLS policies
export function getSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_KEY environment variables are required'
    );
  }

  return createClient(supabaseUrl, supabaseKey);
}

const DatabaseCache = {
  alreadyScheduledCache: new Set<string>(),
  currentPackageCache: null as string | null,
};

/**
 * Checks if a build record exists with retry=false.
 * Returns true if such a record exists (skip scheduling).
 * Returns false if no such record exists (allow scheduling, including if record exists with retry=true).
 */
export async function isBuildAlreadyScheduled(
  packageName: string,
  version: string,
  rnVersion: string,
  platform: Platform,
  workletsVersion?: string | null
): Promise<boolean> {
  const cacheKey = `${packageName}-${version}-${rnVersion}-${platform}-${workletsVersion || 'null'}`;
  if (DatabaseCache.alreadyScheduledCache.has(cacheKey)) {
    return true;
  } else if (DatabaseCache.currentPackageCache === packageName) {
    return false;
  }
  const supabase = getSupabaseClient();

  const query = supabase
    .from('builds')
    .select('package_name, version, rn_version, platform, worklets_version')
    .eq('package_name', packageName)
    .eq('retry', false)
    // Increase limit to avoid Supabase's default 1000-row truncation
    .limit(10000);

  const { data, error } = await query;

  if (error) {
    console.error(
      `Error checking build status for ${packageName}@${version} (RN ${rnVersion}, ${platform}):`,
      error
    );
    // Clear cache on error to force re-fetch on next call
    DatabaseCache.alreadyScheduledCache.clear();
    DatabaseCache.currentPackageCache = null;
    // On error, assume not scheduled to avoid blocking builds
    return false;
  }

  DatabaseCache.currentPackageCache = packageName;
  data?.forEach((record) => {
    DatabaseCache.alreadyScheduledCache.add(
      `${record.package_name}-${record.version}-${record.rn_version}-${record.platform}-${record.worklets_version}`
    );
  });

  return DatabaseCache.alreadyScheduledCache.has(cacheKey);
}

/**
 * Creates or updates a build record with status 'scheduled'.
 */
export async function createBuildRecord(
  packageName: string,
  version: string,
  rnVersion: string,
  platform: Platform,
  githubRunUrl?: string,
  workletsVersion?: string | null
): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase.from('builds').upsert(
    {
      package_name: packageName,
      version,
      rn_version: rnVersion,
      worklets_version: workletsVersion || null,
      platform,
      status: 'scheduled',
      retry: false,
      github_run_url: githubRunUrl || null,
    },
    {
      onConflict: 'package_name,version,rn_version,platform,worklets_version',
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
  rnVersion: string,
  platform: Platform,
  status: BuildStatus,
  options?: {
    githubRunUrl?: string;
    buildDurationSeconds?: number;
    workletsVersion?: string | null;
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

  let query = supabase
    .from('builds')
    .update(updateData)
    .eq('package_name', packageName)
    .eq('version', version)
    .eq('rn_version', rnVersion)
    .eq('platform', platform);

  // Filter by worklets_version if provided
  if (options?.workletsVersion !== undefined) {
    if (options.workletsVersion === null) {
      query = query.is('worklets_version', null);
    } else {
      query = query.eq('worklets_version', options.workletsVersion);
    }
  }

  const { error } = await query;

  if (error) {
    throw new Error(`Failed to update build status: ${error.message}`);
  }
}

export async function getAllCompletedBuilds(): Promise<LibrariesData> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('completed_packages')
    .select('final_output');

  if (error) {
    throw new Error(`Failed to fetch completed builds: ${error.message}`);
  }

  return data?.[0]?.final_output || {};
}

export async function getCompletedPackagesNames(): Promise<string[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('completed_packages_names')
    .select('package_name');

  if (error) {
    throw new Error(`Failed to fetch completed build names: ${error.message}`);
  }
  return data?.map((record) => record.package_name) || [];
}

// Re-export types
export type { Platform, BuildStatus, BuildRecord, LibrariesData };
