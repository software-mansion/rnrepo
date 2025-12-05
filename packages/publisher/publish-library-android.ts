import { Octokit } from '@octokit/rest';
import { existsSync } from 'fs';
import { join } from 'path';
import { $ } from 'bun';
import { updateBuildStatus, type Platform } from '@rnrepo/database';
import { convertToGradleProjectName } from '@rnrepo/config';

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
const MAVEN_GPG_KEY = process.env.MAVEN_GPG_KEY;
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

if (!MAVEN_GPG_KEY) {
  console.error('Error: MAVEN_GPG_KEY environment variable is required');
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

    // Format: "Build for Android {library_name}@{library_version} RN@{react_native_version}( with worklets@{worklets_version})"
    const match = buildRunName.match(
      /Build for Android (.+?)@(.+?) RN@(.+?)( with worklets@(.+?))?( - snapshot)?$/
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
      isSnapshotRun,
    ] = match;

    console.log('📤 Publishing library:');
    console.log(`   Build Run: ${buildRunName}`);
    console.log(`   Library: ${libraryName}@${libraryVersion}`);
    console.log(`   React Native: ${reactNativeVersion}`);
    console.log(
      `${workletsVersion ? `   Worklets Version: ${workletsVersion}\n` : ''}`
    );
    console.log(`   Snapshot Run: ${isSnapshotRun ? 'Yes' : 'No'}`);

    const mavenLibraryName = convertToGradleProjectName(libraryName);

    // Find the downloaded artifact directory (starts with maven-artifacts-)
    const artifactDir = join(process.cwd(), 'maven-artifacts');
    const artifactsBasePath = join(
      artifactDir,
      mavenLibraryName,
      libraryVersion
    );

    if (!existsSync(artifactsBasePath)) {
      throw new Error(
        `Library ${libraryName}@${libraryVersion} not found in downloaded artifacts at ${artifactsBasePath}`
      );
    }

    const baseFileName = `${mavenLibraryName}-${libraryVersion}`;
    const pomFile = join(artifactsBasePath, `${baseFileName}.pom`);
    const classifier = `rn${reactNativeVersion}${
      workletsVersion ? `-worklets${workletsVersion}` : ''
    }`;
    const aarFile = join(
      artifactsBasePath,
      `${baseFileName}-${classifier}.aar`
    );

    // Deploy POM separately (may return 409 if already published, which is acceptable)
    try {
      await $`mvn deploy:deploy-file \
          -Dfile=${pomFile} \
          -DgroupId=org.rnrepo.public \
          -DartifactId=${mavenLibraryName} \
          -Dversion=${libraryVersion} \
          -Dpackaging=pom \
          -DrepositoryId=RNRepo \
          -Durl=${MAVEN_REPOSITORY_URL}`;
      console.log('✓ POM deployed successfully');
    } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      // 409 Conflict is acceptable - POM may already exist (shared across versions)
      if (
        error?.stdout?.includes(
          'status code: 409, reason phrase: Conflict (409)'
        )
      ) {
        console.log('⚠ POM already exists (409 conflict) - continuing...');
      } else {
        throw error;
      }
    }

    // Sign and deploy AAR using gpg:sign-and-deploy-file (signs and deploys in one step)
    // The task uses MAVEN_GPG_KEY and MAVEN_GPG_PASSPHRASE environment variables to sign the artifact
    await $`mvn gpg:sign-and-deploy-file \
        -Dfile=${aarFile} \
        -DgroupId=org.rnrepo.public \
        -DartifactId=${mavenLibraryName} \
        -Dversion=${libraryVersion} \
        -Dpackaging=aar \
        -Dclassifier=${classifier} \
        -DgeneratePom=false \
        -DrepositoryId=RNRepo \
        -Durl=${MAVEN_REPOSITORY_URL}`;
    console.log('✓ AAR signed and deployed successfully');

    console.log(
      `✅ Published library ${libraryName}@${libraryVersion} to remote Maven repository`
    );

    // Pull build duration from pom file
    let buildDurationSeconds: number | null = null;
    const pomContent = await Bun.file(pomFile).text();
    const durationMatch = pomContent.match(
      /<rnrepo\.buildDurationSeconds>(.+?)<\/rnrepo\.buildDurationSeconds>/
    );
    if (durationMatch) {
      buildDurationSeconds = parseFloat(durationMatch[1].replace(',', '.'));
      console.log(`⏱️  Build duration seconds: ${buildDurationSeconds}`);
    } else {
      console.warn('⚠️  Build duration not found in POM file');
    }

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
        'android' as Platform,
        'completed',
        {
          githubRunUrl: githubRunUrl,
          workletsVersion: workletsVersion || null,
          buildDurationSeconds: buildDurationSeconds || undefined,
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
