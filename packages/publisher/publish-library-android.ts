import { Octokit } from '@octokit/rest';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
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
 * Probes the remote Maven repository for a specific version+classifier AAR. Existence is checked per
 * classifier because the artifact filename embeds the classifier and each build job publishes exactly
 * one; a rebuild re-dispatches every classifier of the release together, so they advance in lockstep
 * to the same revision.
 */
async function classifierAarExists(
  artifactId: string,
  version: string,
  classifier: string
): Promise<boolean> {
  const base = MAVEN_REPOSITORY_URL!.replace(/\/+$/, '');
  const url = `${base}/org/rnrepo/public/${artifactId}/${version}/${artifactId}-${version}-${classifier}.aar`;
  const res = await fetch(url, {
    method: 'HEAD',
  });
  if (res.status === 200) return true;
  if (res.status === 404) return false;
  throw new Error(
    `Unexpected HTTP ${res.status} while probing ${url} for an existing artifact`
  );
}

/**
 * Lists the versions already published for an artifact by reading the remote repository's
 * `maven-metadata.xml`. Returns an empty array when the artifact has never been published (404).
 * Unlike {@link classifierAarExists} this is classifier-agnostic — it reports which version
 * directories exist regardless of which classifier populated them.
 */
async function fetchPublishedVersions(artifactId: string): Promise<string[]> {
  const base = MAVEN_REPOSITORY_URL!.replace(/\/+$/, '');
  const url = `${base}/org/rnrepo/public/${artifactId}/maven-metadata.xml`;
  const res = await fetch(url);
  if (res.status === 404) return [];
  if (res.status !== 200) {
    throw new Error(
      `Unexpected HTTP ${res.status} while fetching ${url} to list published versions`
    );
  }
  const xml = await res.text();
  return [...xml.matchAll(/<version>([^<]+)<\/version>/g)].map((m) => m[1].trim());
}

/**
 * Decides the Maven version to deploy under, replacing the old operator-supplied build revision.
 *
 * The release line for `npmVersion` is the bare `npmVersion` (revision 0) plus any rebuild
 * revisions `${npmVersion}.${n}` (n ≥ 1). We deploy to the HIGHEST revision already present in that
 * line so a lagging classifier catches up to the release's current revision, rather than back-filling
 * a lower or gap slot. If this classifier is already published at that highest revision, the release
 * is being rebuilt again, so we advance to `n+1`.
 */
async function computeDeployVersion(
  artifactId: string,
  npmVersion: string,
  classifier: string
): Promise<string> {
  const published = await fetchPublishedVersions(artifactId);

  // Highest existing revision in the `npmVersion` line: 0 == the bare `npmVersion`, -1 == none yet.
  const esc = npmVersion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const revRe = new RegExp(`^${esc}(?:\\.(\\d+))?$`);
  let maxN = -1;
  for (const v of published) {
    const m = v.match(revRe);
    if (!m) continue;
    const n = m[1] ? parseInt(m[1], 10) : 0;
    if (n > maxN) maxN = n;
  }

  // Nothing in this line has ever been published — deploy the bare npm version.
  if (maxN < 0) return npmVersion;

  const maxVersion = maxN === 0 ? npmVersion : `${npmVersion}.${maxN}`;

  // If our classifier already occupies the highest revision, this is a rebuild of it — bump to n+1.
  if (await classifierAarExists(artifactId, maxVersion, classifier)) {
    return `${npmVersion}.${maxN + 1}`;
  }
  return maxVersion;
}

/**
 * Rewrites the project's own `<version>` in the baked POM so the deployed coordinate and the POM body
 * agree when the publisher bumps to a rebuild revision. Only the `org.rnrepo.public:${artifactId}`
 * coordinate is touched — third-party dependency versions (different groupIds) are left intact.
 */
function rewritePomProjectVersion(
  pomXml: string,
  artifactId: string,
  fromVersion: string,
  toVersion: string
): string {
  if (fromVersion === toVersion) return pomXml;
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `(<groupId>org\\.rnrepo\\.public</groupId>\\s*<artifactId>${esc(
      artifactId
    )}</artifactId>\\s*<version>)${esc(fromVersion)}(</version>)`
  );
  if (!re.test(pomXml)) {
    throw new Error(
      `Could not locate the org.rnrepo.public:${artifactId}:${fromVersion} project version in the POM to rewrite it to ${toVersion}`
    );
  }
  return pomXml.replace(re, `$1${toVersion}$2`);
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

    // Decide the deployed coordinate: the bare npm version for a first publish, or the next free
    // `${npmVersion}.${n}` rebuild suffix when this version+classifier already exists remotely.
    const publishVersion = await computeDeployVersion(
      mavenLibraryName,
      libraryVersion,
      classifier
    );
    console.log(
      publishVersion === libraryVersion
        ? `   Publish version: ${publishVersion}`
        : `   Publish version: ${publishVersion} (rebuild revision of ${libraryVersion})`
    );

    // The baked POM carries the built (bare) version internally; when deploying under a rebuild
    // revision, rewrite its project version so the POM body matches the deployed coordinate.
    let pomFileToDeploy = pomFile;
    if (publishVersion !== libraryVersion) {
      const rewrittenPom = rewritePomProjectVersion(
        readFileSync(pomFile, 'utf-8'),
        mavenLibraryName,
        libraryVersion,
        publishVersion
      );
      pomFileToDeploy = join(artifactsBasePath, `${mavenLibraryName}-${publishVersion}.pom`);
      writeFileSync(pomFileToDeploy, rewrittenPom, 'utf-8');
    }

    // Deploy POM separately (may return 409 if already published, which is acceptable)
    try {
      await $`mvn org.apache.maven.plugins:maven-deploy-plugin:3.1.4:deploy-file \
          -Dfile=${pomFileToDeploy} \
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
