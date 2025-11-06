import { Octokit } from '@octokit/rest';
import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Publish Library Android Script
 *
 * This script publishes a React Native library to a repository.
 *
 * @param buildRunId - ID of the build workflow run
 */

const [buildRunId] = process.argv.slice(2);

if (!buildRunId) {
  console.error('Usage: bun run publish-library-android.ts <build-run-id>');
  process.exit(1);
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;

if (!GITHUB_TOKEN || !GITHUB_REPOSITORY) {
  console.error(
    'Error: GITHUB_TOKEN and GITHUB_REPOSITORY environment variables are required'
  );
  process.exit(1);
}

const [owner, repo] = GITHUB_REPOSITORY.split('/');

function createOctokit() {
  return new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });
}

const octokit = createOctokit();

async function main() {
  try {
    console.log(`📥 Fetching build workflow run ${buildRunId}...`);
    const { data: run } = await octokit.rest.actions.getWorkflowRun({
      owner,
      repo,
      run_id: parseInt(buildRunId, 10),
    });
    const buildRunName = run.display_title || run.name || '';

    if (!buildRunName) {
      throw new Error('Could not get build workflow run name');
    }

    // Format: "Build for Android {library_name}@{library_version} RN@{react_native_version}"
    const match = buildRunName.match(/Build for Android (.+?)@(.+?) RN@(.+?)$/);
    if (!match) {
      throw new Error(`Could not parse workflow run name: ${buildRunName}`);
    }

    const [, libraryName, libraryVersion, reactNativeVersion] = match;

    console.log('📤 Publishing library:');
    console.log(`   Build Run: ${buildRunName}`);
    console.log(`   Library: ${libraryName}@${libraryVersion}`);
    console.log(`   React Native: ${reactNativeVersion}`);
    console.log('');

    const mavenLocalLibraryLocationPath = join(
      process.env.HOME || process.env.USERPROFILE || '',
      '.m2',
      'repository',
      'org',
      'rnrepo',
      'public',
      libraryName,
      `${libraryVersion}-rn${reactNativeVersion}`
    );

    if (!existsSync(mavenLocalLibraryLocationPath)) {
      throw new Error(
        `Library ${libraryName}@${libraryVersion} not found in Maven Local`
      );
    }

    console.log(
      `📂 Found library in Maven Local: ${mavenLocalLibraryLocationPath}`
    );
    process.exit(0);
  } catch (error) {
    console.error('❌ Publish failed:', error);
    process.exit(1);
  }
}

main();
