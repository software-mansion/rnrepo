import { $ } from 'bun';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { arch, cpus, platform } from 'node:os';
import { join } from 'path';
import { 
  convertToGradleProjectName, 
  AllowedLicense, 
  extractAndVerifyLicense,
  type BuildArgs,
  parseArgs, 
  printArgs,
  getGithubBuildUrl } from '@rnrepo/config';

/**
 * Build Library Android Script
 *
 * This script builds an Android library (AAR) from an NPM package.
 *
 * @param libraryName - Name of the library from NPM
 * @param libraryVersion - Version of the library from NPM
 * @param reactNativeVersion - React Native version to use for building
 * @param workDir - Working directory where "app" (RN project) and "outputs" (AAR files) will be created
 * @param workletsVersion - (Optional) react-native-worklets version to install
 */

const buildArgs = parseArgs(process.argv);
let postinstallGradleScriptPath: string = "";
const GITHUB_BUILD_URL = getGithubBuildUrl(process.env.GITHUB_SERVER_URL, process.env.GITHUB_REPOSITORY, process.env.GITHUB_RUN_ID);

// Main execution
printArgs(buildArgs, 'android');

try {
  await buildLibrary();
  process.exit(0);
} catch (error) {
  console.error('❌ Build failed:', error);
  process.exit(1);
}

async function installSetup(appDir: string, phase: "preInstall" | "postInstall") {
  const libraryJsonPath = join(
    __dirname,
    '..',
    '..',
    'libraries.json'
  );
  const libraryJson = JSON.parse(readFileSync(libraryJsonPath, 'utf-8'));
  const scriptPath = libraryJson[buildArgs.libraryName]?.[phase + "ScriptPath"] as string | undefined;
  if (scriptPath && existsSync(scriptPath)) {
    const fullScriptPath = join(__dirname, '..', '..', scriptPath);
    if (scriptPath.endsWith('.gradle')) {
      if (phase === 'preInstall') {
        throw new Error('Gradle scripts are only supported in postInstall phase');
      }
      postinstallGradleScriptPath = fullScriptPath;
      console.log(`✓ Using postInstall Gradle script for ${buildArgs.libraryName}`);
    } else if (scriptPath.endsWith('.ts') || scriptPath.endsWith('.js')) {
      await $`bun run ${fullScriptPath}`.cwd(appDir);
      console.log(`✓ Executed ${phase} script for ${buildArgs.libraryName}`);
    }
  } else {
    console.log(`ℹ️ No ${phase} script found for ${buildArgs.libraryName}`);
  }
}

function getCpuInfo() {
  return `${arch()}-${platform()}-${cpus().length}coresAt${cpus()[0].speed}`;
}

async function buildAAR(appDir: string, license: AllowedLicense) {
  const gradleProjectName = convertToGradleProjectName(buildArgs.libraryName);
  const classifier = `rn${buildArgs.reactNativeVersion}${buildArgs.workletsVersion ? `-worklets${buildArgs.workletsVersion}` : ''}`;
  const packagePath = join(appDir, 'node_modules', buildArgs.libraryName);
  const androidPath = join(appDir, 'android');

  // Validate that package exists
  if (!existsSync(packagePath)) {
    throw new Error(
      `Package not found: ${buildArgs.libraryName}. Make sure it's installed in node_modules.`
    );
  }

  const packageAndroidPath = join(packagePath, 'android');
  if (!existsSync(packageAndroidPath)) {
    throw new Error(
      `Package ${buildArgs.libraryName} does not have an Android implementation`
    );
  }

  const addPublishingGradleScriptPath = join(
    __dirname,
    'add-publishing.gradle'
  );

  const addPrefabReduceGradleScriptPath = join(
    __dirname,
    'prefab-reduce.gradle'
  );

  const mavenLocalLibraryLocationPath = join(
    process.env.HOME || process.env.USERPROFILE || '',
    '.m2',
    'repository',
    'org',
    'rnrepo',
    'public',
    gradleProjectName,
    buildArgs.libraryVersion
  );

  if (existsSync(mavenLocalLibraryLocationPath)) {
    throw new Error(
      `Library ${buildArgs.libraryName}@${buildArgs.libraryVersion}-rn${buildArgs.reactNativeVersion} is already published to Maven Local`
    );
  }

  try {
    await $`./gradlew :${gradleProjectName}:publishToMavenLocal \
      --no-daemon \
      --init-script ${addPublishingGradleScriptPath} \
      --init-script ${addPrefabReduceGradleScriptPath} \
      ${postinstallGradleScriptPath ? { raw: "--init-script " + postinstallGradleScriptPath} : ""} \
      -PrnrepoArtifactId=${gradleProjectName} \
      -PrnrepoPublishVersion=${buildArgs.libraryVersion} \
      -PrnrepoClassifier=${classifier} \
      -PrnrepoCpuInfo=${getCpuInfo()} \
      -PrnrepoBuildUrl=${GITHUB_BUILD_URL} \
      -PrnrepoLicenseName=${license} \
      -PrnrepoLicenseUrl=https://opensource.org/license/${license}
    `.cwd(androidPath);

    // verify that the .pom and .aar files are present aftre the publish command completes
    const pomPath = join(
      mavenLocalLibraryLocationPath,
      `${gradleProjectName}-${buildArgs.libraryVersion}.pom`
    );
    if (!existsSync(pomPath)) {
      throw new Error(`POM file not found at ${pomPath}`);
    }
    const aarPath = join(
      mavenLocalLibraryLocationPath,
      `${gradleProjectName}-${buildArgs.libraryVersion}-${classifier}.aar`
    );
    if (!existsSync(aarPath)) {
      throw new Error(`AAR file not found at ${aarPath}`);
    }

    console.log('✓ Published to Maven Local successfully');
  } catch (error) {
    console.error(`❌ Build failed:`, error);
    throw error;
  }
}

function checkRnVersion(appDir: string, expectedVersion: string) {
  const rnPackageJsonPath = join(
    appDir,
    'node_modules',
    'react-native',
    'package.json'
  );
  const rnPackageJson = JSON.parse(readFileSync(rnPackageJsonPath, 'utf-8'));
  const actualVersion = rnPackageJson.version;
  if (actualVersion !== expectedVersion) {
    throw new Error(
      `React Native version mismatch: expected ${expectedVersion}, got ${actualVersion}`
    );
  }
  console.log(`✓ React Native version ${actualVersion} is correct`);
}

async function buildLibrary() {
  const appDir = join(buildArgs.workDir, 'rnrepo_build_app');

  // Create work directory if it doesn't exist
  mkdirSync(buildArgs.workDir, { recursive: true });

  // Check that app and outputs directories don't exist yet
  if (existsSync(appDir)) {
    throw new Error(`App directory ${appDir} already exists.`);
  }

  console.log(
    `🔨 Building AAR for ${buildArgs.libraryName}@${buildArgs.libraryVersion} with RN ${buildArgs.reactNativeVersion}...`
  );

  try {
    // Create RN project in the work directory
    console.log(
      `📱 Creating temporary React Native project (RN ${buildArgs.reactNativeVersion})...`
    );

    $.cwd(buildArgs.workDir);
    await $`bunx @react-native-community/cli@latest init rnrepo_build_app --version ${buildArgs.reactNativeVersion} --skip-install`.quiet();
    $.cwd(appDir);

    // Perform any library-specific setup before installing
    await installSetup(appDir, "preInstall");

    // Install the library
    console.log(`📦 Installing ${buildArgs.libraryName}@${buildArgs.libraryVersion}...`);
    await $`npm install ${buildArgs.libraryName}@${buildArgs.libraryVersion} --save-exact`.quiet();

    // Extract license name from the library's package.json
    const license = extractAndVerifyLicense(appDir, buildArgs.libraryName);

    // Perform any library-specific setup after installing
    await installSetup(appDir, "postInstall");

    // Install react-native-worklets if specified
    if (buildArgs.workletsVersion) {
      console.log(`📦 Installing react-native-worklets@${buildArgs.workletsVersion}...`);
      await $`npm install react-native-worklets@${buildArgs.workletsVersion} --save-exact`.quiet();
    }

    // Install all dependencies
    console.log('📦 Installing all dependencies...');
    await $`npm install`.quiet();

    // Check if the react-native version is correctly set
    checkRnVersion(appDir, buildArgs.reactNativeVersion);

    // Build AAR
    console.log('🔨 Building AAR...');
    await buildAAR(appDir, license);

    console.log(
      `✅ Successfully built AAR for ${buildArgs.libraryName}@${buildArgs.libraryVersion} with RN ${buildArgs.reactNativeVersion}`
    );
  } catch (error) {
    console.error(
      `❌ Error building AAR for ${buildArgs.libraryName}@${buildArgs.libraryVersion}:`,
      error
    );
    throw error;
  }
}
