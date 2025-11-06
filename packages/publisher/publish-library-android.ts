import { Octokit } from '@octokit/rest';
import { existsSync, statSync } from 'fs';
import { join } from 'path';
import { $, Glob } from 'bun';

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
const MAVEN_USERNAME = process.env.MAVEN_USERNAME;
const MAVEN_PASSWORD = process.env.MAVEN_PASSWORD;
const MAVEN_REPOSITORY_URL = process.env.MAVEN_REPOSITORY_URL;

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

async function findArtifactDir(cwd: string) {
  const glob = new Glob('maven-artifacts-*/');
  for await (const file of glob.scan({ cwd, onlyFiles: false })) {
    const fullPath = join(cwd, file.replace(/\/$/, ''));
    if (existsSync(fullPath) && statSync(fullPath).isDirectory()) {
      return fullPath;
    }
  }
  throw new Error(`No maven-artifacts-* directory found in ${cwd}`);
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

    // Find the downloaded artifact directory (starts with maven-artifacts-)
    const artifactDir = await findArtifactDir(process.cwd());
    const artifactsBasePath = join(
      artifactDir,
      mavenLibraryName,
      mavenVersionString
    );

    if (!existsSync(artifactsBasePath)) {
      throw new Error(
        `Library ${libraryName}@${libraryVersion} not found in downloaded artifacts at ${artifactsBasePath}`
      );
    }

    const baseFileName = `${mavenLibraryName}-${mavenVersionString}`;
    const pomFile = join(artifactsBasePath, `${baseFileName}.pom`);
    const aarFile = join(artifactsBasePath, `${baseFileName}.aar`);
    const moduleFile = join(artifactsBasePath, `${baseFileName}.module`);

    // Deploy directly from downloaded artifacts (not from .m2/repository)
    // Pass username and password directly to mvn command
    await $`mvn deploy:deploy-file \
        -Dfile=${aarFile} \
        -DpomFile=${pomFile} \
        -DmoduleFile=${moduleFile} \
        -DgroupId=org.rnrepo.public \
        -DartifactId=${mavenLibraryName} \
        -Dversion=${mavenVersionString} \
        -Dpackaging=aar \
        -DrepositoryId=RNRepo \
        -Durl=${MAVEN_REPOSITORY_URL}`;

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
