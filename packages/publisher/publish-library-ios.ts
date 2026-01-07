import { Octokit } from '@octokit/rest';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { $ } from 'bun';
import { updateBuildStatus, type Platform } from '@rnrepo/database';
import { sanitizePackageName } from '@rnrepo/config';

/**
 * Publish Library iOS Script
 *
 * This script publishes a React Native library XCFramework to a CocoaPods-compatible repository.
 *
 * @param buildRunId - ID of the build workflow run
 */

const [buildRunId] = process.argv.slice(2);

if (!buildRunId) {
  console.error('Usage: bun run publish-library-ios.ts <build-run-id>');
  process.exit(1);
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;
const MAVEN_USERNAME = process.env.MAVEN_USERNAME;
const MAVEN_PASSWORD = process.env.MAVEN_PASSWORD;
const MAVEN_REPOSITORY_URL = process.env.MAVEN_REPOSITORY_URL;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!GITHUB_TOKEN || !GITHUB_REPOSITORY) {
  console.error(
    'Error: GITHUB_TOKEN and GITHUB_REPOSITORY environment variables are required'
  );
  process.exit(1);
}

if (!MAVEN_USERNAME || !MAVEN_PASSWORD || !MAVEN_REPOSITORY_URL) {
  console.error(
    'Error: MAVEN_USERNAME, MAVEN_PASSWORD and MAVEN_REPOSITORY_URL environment variables are required'
  );
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    'Error: SUPABASE_URL and SUPABASE_KEY environment variables are required'
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

    // Format: "Build for iOS {library_name}@{library_version} RN@{react_native_version}( with worklets@{worklets_version})?( [{configuration}])?( - snapshot)?"
    const match = buildRunName.match(
      /Build for iOS (.+?)@(.+?) RN@(.+?)( with worklets@(.+?))?( \[(.+?)\])?( - snapshot)?$/
    );
    if (!match) {
      throw new Error(`Could not parse workflow run name: ${buildRunName}`);
    }

    const [
      ,
      libraryName,
      libraryVersion,
      reactNativeVersion,
      _,
      workletsVersion,
      __,
      configuration,
      isSnapshotRun,
    ] = match;

    console.log('📤 Publishing library:');
    console.log(`   Build Run: ${buildRunName}`);
    console.log(`   Library: ${libraryName}@${libraryVersion}`);
    console.log(`   React Native: ${reactNativeVersion}`);
    console.log(`   Configuration: ${configuration || 'release'}`);
    console.log(
      `${workletsVersion ? `   Worklets Version: ${workletsVersion}\n` : ''}`
    );
    console.log(`   Snapshot Run: ${isSnapshotRun ? 'Yes' : 'No'}`);

    const sanitizedLibraryName = sanitizePackageName(libraryName);
    const buildConfig = configuration || 'release';

    // Find the downloaded artifact directory
    const artifactDir = join(process.cwd(), 'framework-artifacts');

    if (!existsSync(artifactDir)) {
      throw new Error(
        `Framework artifacts directory not found at ${artifactDir}`
      );
    }

    // List available files to find the xcframework zip
    const files = readdirSync(artifactDir);
    const xcframeworkZip = files.find((f) =>
      f.includes(`${sanitizedLibraryName}-${libraryVersion}`) &&
      f.includes(`rn${reactNativeVersion}`) &&
      f.includes(`-${buildConfig}.xcframework.zip`)
    );

    if (!xcframeworkZip) {
      throw new Error(
        `XCFramework zip not found for ${libraryName}@${libraryVersion} (config: ${buildConfig}) in ${artifactDir}\n` +
          `Available files: ${files.join(', ')}`
      );
    }

    const xcframeworkPath = join(artifactDir, xcframeworkZip);
    console.log(`\n📦 Found XCFramework: ${xcframeworkZip}`);

    // For iOS, we publish to Maven repository as a platform-specific artifact
    // The artifact follows the naming convention: {library}-{version}-rn{rnVersion}-{config}.xcframework.zip
    const classifier = `rn${reactNativeVersion}-${buildConfig}${
      workletsVersion ? `-worklets${workletsVersion}` : ''
    }`;

    // Deploy the XCFramework zip to Maven repository
    // Using the same Maven infrastructure as Android for cross-platform compatibility
    console.log('\n🚀 Deploying to Maven repository...');
    await $`mvn deploy:deploy-file \
        -Dfile=${xcframeworkPath} \
        -DgroupId=org.rnrepo.public \
        -DartifactId=${sanitizedLibraryName} \
        -Dversion=${libraryVersion} \
        -Dpackaging=zip \
        -Dclassifier=${classifier} \
        -DrepositoryId=RNRepo \
        -Durl=${MAVEN_REPOSITORY_URL}`;
    console.log('✓ XCFramework deployed successfully');

    console.log(
      `✅ Published library ${libraryName}@${libraryVersion} (${buildConfig}) to remote Maven repository`
    );

    // Update Supabase status to 'completed' after publish is fully complete
    if (isSnapshotRun) {
      console.log(
        '⚠️  Snapshot repository detected - skipping database status update'
      );
      process.exit(0);
    }

    try {
      const githubRunUrl =
        run.html_url ||
        `https://github.com/${owner}/${repo}/actions/runs/${run.id}`;

      await updateBuildStatus(
        libraryName,
        libraryVersion,
        reactNativeVersion,
        'ios' as Platform,
        'completed',
        {
          githubRunUrl: githubRunUrl,
          workletsVersion: workletsVersion || null,
          configuration: buildConfig,
        }
      );
      console.log('✓ Database status updated to completed');
    } catch (error) {
      console.warn(`⚠️  Failed to update database status: ${error}`);
      // Don't fail the publish if database update fails
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Publish failed:', error);
    process.exit(1);
  }
}

main();
