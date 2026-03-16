// Consistency checker / updater for the status field in the builds table:
// - Finds "scheduled" builds older than 10 hours.
// - Verifies artifacts exist in the Maven repo.
// - Updates build status to completed/failed when run with --write (dry run otherwise).
import { SupabaseClient } from '@supabase/supabase-js';
import { sanitizePackageName } from '@rnrepo/config';
import { getSupabaseClient } from './index';
import type { BuildStatus, Platform } from './types';

interface BuildRow {
  id: number;
  package_name: string;
  version: string;
  rn_version: string;
  worklets_version: string | null;
  platform: Platform;
  status: BuildStatus;
  created_at: string;
  updated_at: string;
}

function buildArtifactUrl(
  build: BuildRow,
  baseRepositoryUrl: string
): string[] {
  const repositoryUrl = baseRepositoryUrl.replace(/\/+$/, '');
  const artifactId = sanitizePackageName(build.package_name);
  const classifier = `rn${build.rn_version}${
    build.worklets_version ? `-worklets${build.worklets_version}` : ''
  }`;
  
  const commonPath = `${repositoryUrl}/org/rnrepo/public/${artifactId}/${encodeURIComponent(build.version)}`;
  const fileName = `${artifactId}-${build.version}-${classifier}`;

  const variants = build.platform === 'android' 
    ? ['.aar'] 
    : ['-debug.zip', '-release.zip'];
  return variants.map(suffix => `${commonPath}/${encodeURIComponent(fileName + suffix)}`);
}

async function artifactExists(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    if (response.status === 404) return false;
    return response.ok;
  } catch (error) {
    console.warn(`⚠️  Failed to check artifact at ${url}:`, error);
    return false;
  }
}

async function updateStatus(
  client: SupabaseClient,
  build: BuildRow,
  status: BuildStatus
): Promise<void> {
  const { error } = await client
    .from('builds')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', build.id);

  if (error) {
    throw new Error(
      `Failed to update status for build ${build.id} to ${status}: ${error.message}`
    );
  }
}

async function main() {
  const writeMode =
    process.argv.includes('--write') || process.argv.includes('-w');
  const supabase = getSupabaseClient();
  const baseRepositoryUrl =
    process.env.MAVEN_REPOSITORY_URL || 'https://packages.rnrepo.org/releases';
  const cutoffIso = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString();

  console.log(`🔎 Scanning scheduled builds older than ${cutoffIso}...`);
  if (!writeMode) {
    console.log('🧪 Dry run mode (no database updates). Use --write to apply.');
  }

  const { data: builds, error } = await supabase
    .from('builds')
    .select(
      'id, package_name, version, rn_version, worklets_version, platform, status, created_at, updated_at'
    )
    .lt('created_at', cutoffIso)
    .eq('status', 'scheduled')
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch builds: ${error.message}`);
  }

  const totalFetched = builds?.length ?? 0;
  console.log(`📦 Fetched ${totalFetched} rows.`);

  if (!builds || builds.length === 0) {
    console.log('✅ No stale builds found.');
    return;
  }

  let completedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const build of builds as BuildRow[]) {
    const info = `${build.package_name}@${build.version} RN ${
      build.rn_version
    }${
      build.worklets_version ? ` (worklets ${build.worklets_version})` : ''
    } [${build.platform}]`;
    console.log(`\n▶️  Checking ${info} (current: ${build.status})`);

    const artifactUrls = buildArtifactUrl(build, baseRepositoryUrl);
    const exists = (await Promise.all(artifactUrls.map(artifactExists))).every(Boolean);

    if (exists) {
      completedCount++;
      console.log(`✅ Artifact found. Status set to completed.`);
      if (writeMode) {
        try {
          await updateStatus(supabase, build, 'completed');
        } catch (updateError) {
          errorCount++;
          console.error(updateError);
        }
      }
    } else {
      if (build.status === 'failed') {
        console.log(
          `ℹ️ Artifact missing and status already failed. Leaving as-is.`
        );
        skippedCount++;
        continue;
      }

      failedCount++;
      console.log(`❌ Artifact missing. Status set to failed.`);
      if (writeMode) {
        try {
          await updateStatus(supabase, build, 'failed');
        } catch (updateError) {
          errorCount++;
          console.error(updateError);
        }
      }
    }
  }

  console.log('\n📊 Done.');
  console.log(`   Checked: ${builds.length}`);
  console.log(`   Completed -> ${completedCount}`);
  console.log(`   Failed    -> ${failedCount}`);
  console.log(`   Skipped   -> ${skippedCount}`);
  console.log(`   Errors    -> ${errorCount}`);
}

main().catch((error) => {
  console.error('❌ Consistency check failed:', error);
  process.exit(1);
});
