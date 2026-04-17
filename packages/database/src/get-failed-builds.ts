// Gets failed builds
// - Finds failed builds with pending failed_reason (1000 limit due to GH API rate limit)
// - Verifies the error issue from known issues
// - If buildable then updates failed_reason to buildable and retry status to true when run with --write (dry run otherwise).
// Note: changing retry to false again needs to be done manually
// Note: keeping track of fixable records in DB and their retry status is on developer side, not automated
import { getSupabaseClient } from './index';
import type { BuildRecord, FailedReason } from './types';
import { $ } from 'bun';

const CONCURRENCY = 5;
const RECORDS_LIMIT = 1000;

// failed something else than building process
const BUILD_STEP_PATTERNS = ['X build-library-android', 'X build-library-ios'];
const TIMEOUT_PATTERN = 'The job has exceeded the maximum execution time while awaiting a runner';

const JOB_PATTERNS: { text: string | RegExp; result: Exclude<FailedReason, 'pending'> }[] = [
  { text: '[Reanimated] Invalid version of `react-native-worklets`', result: 'unbuildable' },
  // issue with gradle@9.0.0 syntax
  { text: 'Cannot locate matching tasks for an empty path', result: 'buildable' },
  { text: /\[Reanimated\] React Native .* version is not compatible/, result: 'unbuildable' },
  { text: '[Worklets] Your installed version of React Native is not compatible', result: 'unbuildable' },
  // fails on gradle@9.0.0 - https://github.com/Shopify/react-native-skia/pull/3332
  { text: "Could not get unknown property 'destinationDir' for task ':shopify", result: 'unbuildable' },
  // react-native-video@6.X issue
  { text: "VideoEventEmitter.kt:293:63 Argument type mismatch", result: 'unbuildable' },
];

function getIdFromOutput(str: string): string {
  const [, id] = str.match(/gh run view (\d+)/) || [];
  if (!id) throw new Error(`No ID found in ${str}`);
  return id;
}

async function checkIssue(url: string | null | undefined): Promise<Exclude<FailedReason, 'pending'>> {
  if (!url) return 'unknown';
  const workflowId = url.split('/').pop() || '';
  const outputAction = await $`gh run view ${workflowId} --repo software-mansion/rnrepo`.text();

  if (outputAction.includes(TIMEOUT_PATTERN)) return 'buildable';
  if (!BUILD_STEP_PATTERNS.some(t => outputAction.includes(t))) return 'fixable';

  if (outputAction.includes('To see what failed, try:')) {
    const jobId = getIdFromOutput(outputAction);
    const outputJob = await $`gh run view ${jobId} --repo software-mansion/rnrepo --log-failed`.text();

    for (const { text, result } of JOB_PATTERNS) {
      if (typeof text === 'string' ? outputJob.includes(text) : text.test(outputJob)) return result;
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
    supabase.from('builds').select('*').eq('status', 'failed').eq('retry', false).eq('failed_reason', 'pending').limit(RECORDS_LIMIT)
  ]);

  if (error || !builds?.length) return console.log(error ? `Error: ${error.message}` : '✅ No failed builds found.');
  const activeBuilds: BuildRecord[] = builds;
  const results = { buildable: 0, unbuildable: 0, fixable: 0, unknown: 0, error: 0, expired: 0 };

  const updateBuild = async (id: number | undefined, reason: FailedReason, info: string) => {
    const icons = { buildable: '✅', unbuildable: '🚫', fixable: '🛠️', unknown: '❓', expired: '🗑️', pending: '⏳' };
    console.log(`${icons[reason]} ${reason.padEnd(12)}: ${info} ${writeMode ? '(Updated DB)' : '(Dry run)'}`);
    if (!writeMode) return;
    const { error: updateError } = await supabase.from('builds').update({ 
      failed_reason: reason, 
      retry: reason === 'buildable', 
      updated_at: new Date().toISOString() 
    }).eq('id', id);
    if (updateError) {
      console.error(`❌ Error updating build ${info}:`, updateError);
    }
  };

  async function worker() {
    while (activeBuilds.length > 0) {
      const build = activeBuilds.shift();
      if (!build) break;
      const info = `${build.package_name}@${build.version} RN ${
        build.rn_version
      }${
        build.worklets_version ? ` (worklets ${build.worklets_version})` : ''
      } [${build.platform}]`;

      try {
        const result = await checkIssue(build.github_run_url);
        results[result]++;
        await updateBuild(build.id, result, info);
      } catch (err) {
        if (err instanceof $.ShellError && err.stderr.toString().includes('HTTP 403: API rate limit exceeded')) {
          return console.log(`⚠️ API rate limit exceeded. Stopping.`);
        } else if (err instanceof $.ShellError && err.stderr.toString().includes('failed to get run log: HTTP 410: Server Error')) {
          results.expired++;
          await updateBuild(build.id, 'expired', info);
        } else {
          results.error++;
          console.error(`❌ Error processing ${info}:`, err);
        }
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  console.log('\n📊 Done.');
  console.log(`   Retry=true builds before -> ${retryTrueBuilds?.count}`);
  console.table(results);
}

main().catch((error) => {
  console.error('❌ Failed-builds check failed:', error);
  process.exit(1);
});
