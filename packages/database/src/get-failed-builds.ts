// Gets failed builds
// - Finds failed builds with unknown failed_reason (1000 limit due to GH API rate limit)
// - Verifies the error issue from known issues
// - If buildable then updates failed_reason to buildable and retry status to true when run with --write (dry run otherwise).
// Note: changing retry to false again needs to be done manually
// Note: keeping track of fixable records in DB and their retry status is on developer side, not automated
import { getSupabaseClient } from './index';
import type { BuildStatus, FailedReason, Platform } from './types';
import { $ } from 'bun';

const CONCURRENCY = 5;
const RECORDS_LIMIT = 1000;
type IssueResult = FailedReason | 'noGithubRunUrl' | 'error';

// Typeguard to keep correct types in updating DB
const KNOWN_REASONS = ['buildable', 'unbuildable', 'fixable'] as const satisfies FailedReason[];
function isKnownReason(result: IssueResult): result is (typeof KNOWN_REASONS)[number] {
  return (KNOWN_REASONS as readonly IssueResult[]).includes(result);
}

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
  github_run_url: string | null;
  failed_reason: FailedReason;
}

function getIdFromOutput(str: string): string {
  const [, id] = str.match(/gh run view (\d+)/) || [];
  if (!id) throw new Error(`No ID found in ${str}`);
  return id;
}

async function checkIssue(build: BuildRow): Promise<IssueResult> {
  if (!build.github_run_url) {
    return 'noGithubRunUrl';
  }
  const workflowId = build.github_run_url.split('/').pop() || '';
  const outputAction = await $`gh run view ${workflowId} --repo software-mansion/rnrepo`.text();

  if (outputAction.includes('The job has exceeded the maximum execution time while awaiting a runner')) {
    return 'buildable';
  } else if (!outputAction.includes('X build-library-android') && !outputAction.includes('X build-library-ios')) {
    // failed something else than building process
    return 'fixable';
  } else if (outputAction.includes('To see what failed, try:')) {
    const jobId = getIdFromOutput(outputAction);
    const outputJob = await $`gh run view ${jobId} --repo software-mansion/rnrepo --log-failed`.text();
    if (outputJob.includes('[Reanimated] Invalid version of `react-native-worklets`')) {
      return 'unbuildable';
    } else if (/\[Reanimated\] React Native .* version is not compatible with Reanimated .*/.test(outputJob)) {
      return 'unbuildable';
    } else if (outputJob.includes('[Worklets] Your installed version of React Native is not compatible')) {
      return 'unbuildable';
    } else if (outputJob.includes('VideoEventEmitter.kt:293:63 Argument type mismatch: actual type is \'Int\'')) {
      // react-native-video@6.X issue
      return 'unbuildable';
    } else {
      // todo: add more cases in future
    }
  }
  return 'unknown';
}

async function main() {
  const writeMode = process.argv.some(arg => ['--write', '-w'].includes(arg));
  const supabase = getSupabaseClient();

  console.log(`🔎 Scanning failed builds...`);
  if (!writeMode) {
    console.log('🧪 Dry run mode (no database updates). Use --write to apply.');
  }

  const [retryTrueBuilds, { data: builds, error }] = await Promise.all([
    supabase.from('builds').select('id', { count: 'exact', head: true }).eq('retry', true),
    supabase.from('builds').select('*').eq('status', 'failed').eq('retry', false).eq('failed_reason', 'unknown').limit(RECORDS_LIMIT)
  ]);

  if (error || !builds) throw new Error(`Fetch failed: ${error?.message}`);
  if (!builds.length) return console.log('✅ No failed builds found.');

  const results = { buildable: 0, unbuildable: 0, fixable: 0, noGithubRunUrl: 0, unknown: 0, error: 0, removed: 0 };

  const queue = [...builds];
  let isCancelled = false;

  async function worker() {
    while (queue.length > 0 && !isCancelled) {
      const build = queue.shift();
      if (!build) break;
      const info = `${build.package_name}@${build.version} RN ${
        build.rn_version
      }${
        build.worklets_version ? ` (worklets ${build.worklets_version})` : ''
      } [${build.platform}]`;

      try {
        const result = await checkIssue(build);
        results[result]++;

        if (isKnownReason(result)) {
          if (writeMode) {
             const { error: updateError } = await supabase.from('builds').update({
              failed_reason: result,
              retry: result === 'buildable',
              updated_at: new Date().toISOString()
            }).eq('id', build.id);
            if (updateError) {
              console.error(`❌ Error updating build ${build.id}:`, updateError);
              continue
            }
          }
          
          const icons = { buildable: '✅', unbuildable: '🚫', fixable: '🛠️' };
          console.log(`${icons[result]} ${result}: ${info} ${writeMode ? '(Updated DB)' : '(Dry run)'}`);
        } else {
          console.log(`⚠️ ${result === 'unknown' ? 'Unknown issue' : result}: ${info}. Skipping.`);
        }
      } catch (err) {
        if (err instanceof $.ShellError && err.stderr.toString().includes('HTTP 403: API rate limit exceeded')) {
          isCancelled = true;
          console.log(`⚠️ API rate limit exceeded. Stopping.`);
        } else if (err instanceof $.ShellError && err.stderr.toString().includes('failed to get run log: HTTP 410: Server Error')) {
          results.removed++;
          if (writeMode) {
            const { error: updateError } = await supabase.from('builds').update({
              failed_reason: 'fixable', // requires manual check
              updated_at: new Date().toISOString()
            }).eq('id', build.id);
            if (updateError) {
              console.error(`❌ Error updating build ${build.id}:`, updateError);
            }
          }
          console.log(`🗑️ Removed logs for ${info} ${writeMode ? '(Updated DB → fixable)' : '(Dry run)'}`);
        } else {
          results.error++;
          console.error(`❌ Error processing ${info}:`, err);
        }
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  if (isCancelled) {
    console.log("\n⚠️ Process was interrupted due to API rate limit. Results are partial.");
  }

  console.log('\n📊 Done.');
  console.log(`   Checked: ${builds.length}`);
  console.log(`   Buildable issue          -> ${results.buildable}`);
  console.log(`   Unbuildable issue        -> ${results.unbuildable}`);
  console.log(`   Fixable issue            -> ${results.fixable}`);
  console.log(`   No Github run URL        -> ${results.noGithubRunUrl}`);
  console.log(`   Unknown issue            -> ${results.unknown}`);
  console.log(`   Errors                   -> ${results.error}`);
  console.log(`   Logs unavailable (old)   -> ${results.removed}`);
  console.log(`   Retry=true builds before -> ${retryTrueBuilds?.count}`);
}

main().catch((error) => {
  console.error('❌ Failed-builds check failed:', error);
  process.exit(1);
});
