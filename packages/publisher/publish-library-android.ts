import { Octokit } from '@octokit/rest';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { $ } from 'bun';
import { updateBuildStatus, type Platform } from '@rnrepo/database';
import { sanitizePackageName } from '@rnrepo/config';

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

/**
 * Discovers the Maven version to deploy by inspecting the downloaded artifact layout under
 * [libraryArtifactsDir] (`maven-artifacts/<artifactId>/<version>/`).
 *
 * The builder bakes the final coordinate into the artifacts: the bare npm version for a normal
 * build, or `${npmVersion}.${revision}` for a rebuild of a faulty release. The publisher deploys
 * exactly what was built rather than re-deriving the coordinate, so the version decision lives in a
 * single place and is immune to the eventual consistency / concurrency of maven-metadata reads.
 *
 * A build produces exactly one version directory; anything else means the bundle is malformed.
 */
function discoverPublishVersion(
  libraryArtifactsDir: string,
  npmVersion: string
): string {
  if (!existsSync(libraryArtifactsDir)) {
    throw new Error(
      `No downloaded artifacts for this library at ${libraryArtifactsDir}`
    );
  }
  const versionDirs = readdirSync(libraryArtifactsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  if (versionDirs.length !== 1) {
    throw new Error(
      `Expected exactly one version directory under ${libraryArtifactsDir}, found: ${
        versionDirs.join(', ') || '(none)'
      }`
    );
  }
  const version = versionDirs[0];
  // The built version must be the bare npm version or a build revision of it (`${npm}.${N}`);
  // otherwise the wrong artifact was downloaded.
  if (version !== npmVersion && !version.startsWith(`${npmVersion}.`)) {
    throw new Error(
      `Built version "${version}" under ${libraryArtifactsDir} is neither the npm version ${npmVersion} nor a build revision of it`
    );
  }
  return version;
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
    console.log(workletsVersion ? `   Worklets Version: ${workletsVersion}\n` : '');
    console.log(`   Snapshot Run: ${isSnapshotRun ? 'Yes' : 'No'}`);

    const mavenLibraryName = sanitizePackageName(libraryName);

    // Find the downloaded artifact directory (starts with maven-artifacts-)
    const artifactDir = join(process.cwd(), 'maven-artifacts');
    const libraryArtifactsDir = join(artifactDir, mavenLibraryName);
    // resolve the library version with possible build revision (e.g. 3.0.0.1)
    const publishVersion = discoverPublishVersion(
      libraryArtifactsDir,
      libraryVersion
    );
    console.log(
      publishVersion === libraryVersion
        ? `   Publish version: ${publishVersion}`
        : `   Publish version: ${publishVersion} (build revision of ${libraryVersion})`
    );

    const artifactsBasePath = join(libraryArtifactsDir, publishVersion);
    if (!existsSync(artifactsBasePath)) {
      throw new Error(
        `Library ${libraryName}@${publishVersion} not found in downloaded artifacts at ${artifactsBasePath}`
      );
    }

    const baseFileName = `${mavenLibraryName}-${publishVersion}`;
    const pomFile = join(artifactsBasePath, `${baseFileName}.pom`);
    const baseClassifier = `rn${reactNativeVersion}${
      workletsVersion ? `-worklets${workletsVersion}` : ''
    }`;
    const codegenClassifier = `${baseClassifier}-codegen`;

    const aarFileBase = join(artifactsBasePath, `${baseFileName}-${baseClassifier}.aar`);
    const aarFileWithCodegen = join(
      artifactsBasePath,
      `${baseFileName}-${codegenClassifier}.aar`
    );

    // Exactly one of the two AAR variants is produced per build, depending on
    // whether the library uses codegen. Pick whichever was published.
    let classifier: string;
    let aarFile: string;
    if (existsSync(aarFileBase)) {
      classifier = baseClassifier;
      aarFile = aarFileBase;
    } else if (existsSync(aarFileWithCodegen)) {
      classifier = codegenClassifier;
      aarFile = aarFileWithCodegen;
    } else {
      throw new Error(
        `AAR file not found in ${artifactsBasePath} matching ${baseFileName}-${baseClassifier}.aar or ${baseFileName}-${codegenClassifier}.aar`
      );
    }

    // Deploy POM separately (may return 409 if already published, which is acceptable)
    try {
      await $`mvn org.apache.maven.plugins:maven-deploy-plugin:3.1.4:deploy-file \
          -Dfile=${pomFile} \
          -DgroupId=org.rnrepo.public \
          -DartifactId=${mavenLibraryName} \
          -Dversion=${publishVersion} \
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
    let publishStatus = 'failed' as 'failed' | 'completed';
    const result = await $`mvn org.apache.maven.plugins:maven-gpg-plugin:3.2.8:sign-and-deploy-file \
        -Dfile=${aarFile} \
        -DgroupId=org.rnrepo.public \
        -DartifactId=${mavenLibraryName} \
        -Dversion=${publishVersion} \
        -Dpackaging=aar \
        -Dclassifier=${classifier} \
        -DgeneratePom=false \
        -DrepositoryId=RNRepo \
        -Durl=${MAVEN_REPOSITORY_URL}`.nothrow();

    if (result.exitCode === 0) {
      console.log('✓ AAR signed and deployed successfully');

      console.log(
        `✅ Published library ${libraryName}@${publishVersion} to remote Maven repository`
      );
      publishStatus = 'completed';
    } else {
      console.error('❌ Failed to sign and deploy AAR:', result.stderr.toString());
      publishStatus = 'failed';
    }

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

      // The build record is keyed on the npm version (see createBuildRecord), so update it with
      // `libraryVersion`, not the deployed coordinate — a rebuild's `x.y.z.N` would
      // match no row and silently leave the status stale.
      await updateBuildStatus(
        libraryName,
        libraryVersion,
        reactNativeVersion,
        'android' as Platform,
        publishStatus,
        {
          githubRunUrl: githubRunUrl,
          workletsVersion: workletsVersion || null,
          buildDurationSeconds: buildDurationSeconds || undefined,
        }
      );
      console.log('✓ Database status updated successfully');
    } catch (error) {
      console.warn(`⚠️  Failed to update database status: ${error}`);
      // Don't fail the publish if database update fails
    }

    process.exit(publishStatus === 'completed' ? 0 : 1);
  } catch (error) {
    console.error('❌ Publish failed:', error);
    process.exit(1);
  }
}

main();
