import { Octokit } from '@octokit/rest';
import { updateBuildStatus, type BuildStatus, type Platform } from '@rnrepo/database';

/**
 * Update Build Status Script
 *
 * Updates the build status in Supabase when a build workflow completes (success or failure).
 *
 * @param buildRunId - ID of the build workflow run
 * @param status - 'completed' or 'failed'
 */

// const [buildRunId, statusArg] = process.argv.slice(2);

// if (!buildRunId || !statusArg) {
//   console.error(
//     'Usage: bun run update-build-status.ts <build-run-id> <completed|failed>'
//   );
//   process.exit(1);
// }

// const status = statusArg as BuildStatus;
// if (status !== 'completed' && status !== 'failed') {
//   console.error('Error: status must be either "completed" or "failed"');
//   process.exit(1);
// }

// const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
// const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;
// const SUPABASE_URL = process.env.SUPABASE_URL;
// const SUPABASE_KEY = process.env.SUPABASE_KEY;

// if (!GITHUB_TOKEN || !GITHUB_REPOSITORY) {
//   console.error(
//     'Error: GITHUB_TOKEN and GITHUB_REPOSITORY environment variables are required'
//   );
//   process.exit(1);
// }

// if (!SUPABASE_URL || !SUPABASE_KEY) {
//   console.error(
//     'Error: SUPABASE_URL and SUPABASE_KEY environment variables are required'
//   );
//   process.exit(1);
// }

// const [owner, repo] = GITHUB_REPOSITORY.split('/');

// function createOctokit() {
//   return new Octokit({
//     auth: process.env.GITHUB_TOKEN,
//   });
// }

// const octokit = createOctokit();

async function main() {
  process.exit(0);
  // try {
  //   console.log(`📥 Fetching build workflow run ${buildRunId}...`);
  //   const { data: run } = await octokit.rest.actions.getWorkflowRun({
  //     owner,
  //     repo,
  //     run_id: parseInt(buildRunId, 10),
  //   });
  //   const buildRunName = run.display_title || run.name || '';

  //   if (!buildRunName) {
  //     throw new Error('Could not get build workflow run name');
  //   }

  //   // Format: "Build for {platform} {library_name}@{library_version} RN@{react_native_version}( with worklets@{worklets_version})?"
  //   const match = buildRunName.match(/Build for (Android|iOS) (.+?)@(.+?) RN@(.+?)( with worklets@(.+?))?$/);
  //   if (!match) {
  //     throw new Error(`Could not parse workflow run name: ${buildRunName}`);
  //   }

  //   const [, platform, libraryName, libraryVersion, reactNativeVersion, _, workletsVersion] = match;

  //   console.log(`📝 Updating build status:`);
  //   console.log(`   Build Run: ${buildRunName}`);
  //   console.log(`   Library: ${libraryName}@${libraryVersion}`);
  //   console.log(`   React Native: ${reactNativeVersion}`);
  //   console.log(`   Platform: ${platform}`);
  //   console.log(`   Worklets: ${workletsVersion || 'none'}`);
  //   console.log(`   Status: ${status}`);
  //   console.log('');

  //   // Get GitHub run URL
  //   const githubRunUrl =
  //     run.html_url ||
  //     `https://github.com/${owner}/${repo}/actions/runs/${run.id}`;

  //   // Update Supabase status
  //   await updateBuildStatus(
  //     libraryName,
  //     libraryVersion,
  //     reactNativeVersion,
  //     platform.toLowerCase() as Platform,
  //     status,
  //     {
  //       githubRunUrl,
  //       workletsVersion: workletsVersion || null,
  //     }
  //   );

  //   console.log(`✅ Database status updated to ${status}`);
  //   process.exit(0);
  // } catch (error) {
  //   console.error(`❌ Failed to update build status:`, error);
  //   process.exit(1);
  // }
}

main();
