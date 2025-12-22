import { $ } from 'bun';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { convertToGradleProjectName } from '@rnrepo/config';
import {
  type AllowedLicense,
  ALLOWED_LICENSES,
  getGithubBuildUrl,
  getCpuInfo,
  extractAndVerifyLicense,
  checkRnVersion,
  installSetup,
} from './common';

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

const [
  libraryName,
  libraryVersion,
  reactNativeVersion,
  workDir,
  workletsVersion,
] = process.argv.slice(2);
let postinstallGradleScriptPath: string = '';

if (!libraryName || !libraryVersion || !reactNativeVersion || !workDir) {
  console.error(
    'Usage: bun run build-library-android.ts <library-name> <library-version> <react-native-version> <work-dir> [<worklets-version>]'
  );
  process.exit(1);
}

const GITHUB_BUILD_URL = getGithubBuildUrl();

// Main execution
console.log('📦 Building Android library:');
console.log(`   Library: ${libraryName}@${libraryVersion}`);
console.log(`   React Native: ${reactNativeVersion}`);
console.log(
  `${workletsVersion ? `   Worklets Version: ${workletsVersion}\n` : ''}`
);

try {
  await buildLibrary();
  process.exit(0);
} catch (error) {
  console.error('❌ Build failed:', error);
  process.exit(1);
}

async function runInstallSetup(
  appDir: string,
  phase: 'preInstall' | 'postInstall'
) {
  const result = await installSetup(appDir, libraryName, phase, 'android');
  if (result.postinstallGradleScriptPath) {
    postinstallGradleScriptPath = result.postinstallGradleScriptPath;
  }
}

async function buildAAR(appDir: string, license: AllowedLicense) {
  const gradleProjectName = convertToGradleProjectName(libraryName);
  const classifier = `rn${reactNativeVersion}${
    workletsVersion ? `-worklets${workletsVersion}` : ''
  }`;
  const packagePath = join(appDir, 'node_modules', libraryName);
  const androidPath = join(appDir, 'android');

  // Validate that package exists
  if (!existsSync(packagePath)) {
    throw new Error(
      `Package not found: ${libraryName}. Make sure it's installed in node_modules.`
    );
  }

  const packageAndroidPath = join(packagePath, 'android');
  if (!existsSync(packageAndroidPath)) {
    throw new Error(
      `Package ${libraryName} does not have an Android implementation`
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
    libraryVersion
  );

  if (existsSync(mavenLocalLibraryLocationPath)) {
    throw new Error(
      `Library ${libraryName}@${libraryVersion}-rn${reactNativeVersion} is already published to Maven Local`
    );
  }

  try {
    await $`./gradlew :${gradleProjectName}:publishToMavenLocal \
      --no-daemon \
      --init-script ${addPublishingGradleScriptPath} \
      --init-script ${addPrefabReduceGradleScriptPath} \
      ${
        postinstallGradleScriptPath
          ? { raw: '--init-script ' + postinstallGradleScriptPath }
          : ''
      } \
      -PrnrepoArtifactId=${gradleProjectName} \
      -PrnrepoPublishVersion=${libraryVersion} \
      -PrnrepoClassifier=${classifier} \
      -PrnrepoCpuInfo=${getCpuInfo()} \
      -PrnrepoBuildUrl=${GITHUB_BUILD_URL} \
      -PrnrepoLicenseName=${license} \
      -PrnrepoLicenseUrl=https://opensource.org/license/${license}
    `.cwd(androidPath);

    // verify that the .pom and .aar files are present aftre the publish command completes
    const pomPath = join(
      mavenLocalLibraryLocationPath,
      `${gradleProjectName}-${libraryVersion}.pom`
    );
    if (!existsSync(pomPath)) {
      throw new Error(`POM file not found at ${pomPath}`);
    }
    const aarPath = join(
      mavenLocalLibraryLocationPath,
      `${gradleProjectName}-${libraryVersion}-${classifier}.aar`
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

async function buildLibrary() {
  const appDir = join(workDir, 'rnrepo_build_app');

  // Create work directory if it doesn't exist
  mkdirSync(workDir, { recursive: true });

  // Check that app and outputs directories don't exist yet
  if (existsSync(appDir)) {
    throw new Error(`App directory ${appDir} already exists.`);
  }

  console.log(
    `🔨 Building AAR for ${libraryName}@${libraryVersion} with RN ${reactNativeVersion}...`
  );

  try {
    // Create RN project in the work directory
    console.log(
      `📱 Creating temporary React Native project (RN ${reactNativeVersion})...`
    );

    $.cwd(workDir);
    await $`bunx @react-native-community/cli@latest init rnrepo_build_app --version ${reactNativeVersion} --skip-install`.quiet();
    $.cwd(appDir);

    // Perform any library-specific setup before installing
    await runInstallSetup(appDir, 'preInstall');

    // Install the library
    console.log(`📦 Installing ${libraryName}@${libraryVersion}...`);
    await $`npm install ${libraryName}@${libraryVersion} --save-exact`.quiet();

    // Extract license name from the library's package.json
    const license = extractAndVerifyLicense(appDir, libraryName);

    // Perform any library-specific setup after installing
    await runInstallSetup(appDir, 'postInstall');

    // Install react-native-worklets if specified
    if (workletsVersion) {
      console.log(`📦 Installing react-native-worklets@${workletsVersion}...`);
      await $`npm install react-native-worklets@${workletsVersion} --save-exact`.quiet();
    }

    // Install all dependencies
    console.log('📦 Installing all dependencies...');
    await $`npm install`.quiet();

    // Check if the react-native version is correctly set
    checkRnVersion(appDir, reactNativeVersion);

    // Build AAR
    console.log('🔨 Building AAR...');
    await buildAAR(appDir, license);

    console.log(
      `✅ Successfully built AAR for ${libraryName}@${libraryVersion} with RN ${reactNativeVersion}`
    );
  } catch (error) {
    console.error(
      `❌ Error building AAR for ${libraryName}@${libraryVersion}:`,
      error
    );
    throw error;
  }
}
