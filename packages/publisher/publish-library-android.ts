import { Octokit } from '@octokit/rest';
import { existsSync } from 'fs';
import { join } from 'path';
import { $ } from 'bun';

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

function convertToGradleProjectName(packageName: string): string {
  // Convert npm package name to Gradle project name following React Native's pattern
  // @react-native-community/slider -> react-native-community_slider
  return packageName.replace(/^@/, '').replace(/\//g, '_');
}

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

    const mavenLibraryName = convertToGradleProjectName(libraryName);
    const mavenVersionString = `${libraryVersion}-rn${reactNativeVersion}`;

    const mavenLocalLibraryLocationPath = join(
      process.env.HOME || process.env.USERPROFILE || '',
      '.m2',
      'repository',
      'org',
      'rnrepo',
      'public',
      mavenLibraryName,
      mavenVersionString
    );

    if (!existsSync(mavenLocalLibraryLocationPath)) {
      throw new Error(
        `Library ${libraryName}@${libraryVersion} not found in Maven Local`
      );
    }

    // publish all the files from the mavenLocalLibraryLocationPath to the remote Maven repository
    const baseFileName = `${mavenLibraryName}-${mavenVersionString}`;
    const pomFile = join(mavenLocalLibraryLocationPath, `${baseFileName}.pom`);
    const aarFile = join(mavenLocalLibraryLocationPath, `${baseFileName}.aar`);
    const moduleFile = join(
      mavenLocalLibraryLocationPath,
      `${baseFileName}.module`
    );

    const repositoryUrl = 'https://packages.rnrepo.org/snapshots';

    await $`mvn deploy:deploy-file \
      -Dfile=${aarFile} \
      -DpomFile=${pomFile} \
      -DmoduleFile=${moduleFile} \
      -DgroupId=org.rnrepo.public \
      -DartifactId=${mavenLibraryName} \
      -Dversion=${mavenVersionString} \
      -Dpackaging=aar \
      -DrepositoryId=RNRepo \
      -Durl=${repositoryUrl}`;

    console.log(
      `✅ Published library ${libraryName}@${libraryVersion} to remote Maven repository`
    );
    process.exit(0);
  } catch (error) {
    console.error('❌ Publish failed:', error);
    process.exit(1);
  }
}

main();
