import { $ } from 'bun';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { sanitizePackageName } from '@rnrepo/config';
import {
  type AllowedLicense,
  getGithubBuildUrl,
  getCpuInfo,
  setupReactNativeProject,
} from './build-utils';

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

const addPublishingGradleScriptPath = join(
  __dirname,
  'gradle_init_scripts',
  'add-publishing.gradle'
);

const addPrefabReduceGradleScriptPath = join(
  __dirname,
  'gradle_init_scripts',
  'prefab-reduce.gradle'
);

const codegenBuildGradleScriptPath = join(
  __dirname,
  'gradle_init_scripts',
  'codegen-build.gradle'
);

/**
 * The library's postinstall script is optional, so its --init-script flag is
 * only added when a path was resolved during project setup.
 */
function postinstallInitScriptArgs(): string[] {
  return postinstallGradleScriptPath
    ? ['--init-script', postinstallGradleScriptPath]
    : [];
}

/**
 * Publishes the library to Maven Local. The standard and codegen builds share
 * the same publish invocation; the codegen build passes the extra
 * `-PrnrepoCodegenName` prop via `extraArgs`.
 */
async function publishToMavenLocal(
  androidPath: string,
  gradleProjectName: string,
  classifier: string,
  license: AllowedLicense[],
  extraArgs: string[] = []
): Promise<void> {
  const args = [
    `:${gradleProjectName}:publishToMavenLocal`,
    '--no-daemon',
    '--init-script', addPublishingGradleScriptPath,
    '--init-script', addPrefabReduceGradleScriptPath,
    ...postinstallInitScriptArgs(),
    `-PrnrepoArtifactId=${gradleProjectName}`,
    `-PrnrepoPublishVersion=${libraryVersion}`,
    `-PrnrepoClassifier=${classifier}`,
    `-PrnrepoCpuInfo=${getCpuInfo()}`,
    `-PrnrepoBuildUrl=${GITHUB_BUILD_URL}`,
    // Comma-separated list of SPDX license ids; the publishing init script
    // emits one <license> POM node per entry, deriving the url from the name.
    `-PrnrepoLicenseName=${license.join(',')}`,
    ...extraArgs,
  ];
  await $`./gradlew ${args}`.cwd(androidPath);
}

/**
 * Verifies that the expected .pom and .aar files exist after publishing.
 */
function verifyPublishedArtifacts(
  mavenLocalLibraryLocationPath: string,
  gradleProjectName: string,
  aarFileName: string
): void {
  const pomPath = join(
    mavenLocalLibraryLocationPath,
    `${gradleProjectName}-${libraryVersion}.pom`
  );
  if (!existsSync(pomPath)) {
    throw new Error(`POM file not found at ${pomPath}`);
  }
  const aarPath = join(mavenLocalLibraryLocationPath, aarFileName);
  if (!existsSync(aarPath)) {
    throw new Error(`AAR file not found at ${aarPath}`);
  }
}

/**
 * Builds the gradle args for the codegen `assemble*` tasks. The debug and
 * release builds differ only by the task name and a couple of extra props.
 */
function assembleArgs(
  task: string,
  codegenName: string,
  extraArgs: string[] = []
): string[] {
  return [
    task,
    '--no-daemon',
    '--init-script', addPublishingGradleScriptPath,
    '--init-script', codegenBuildGradleScriptPath,
    ...postinstallInitScriptArgs(),
    `-PrnrepoCodegenName=${codegenName}`,
    ...extraArgs,
  ];
}

/**
 * Builds the app in debug and then release mode so the codegen static
 * libraries are generated before publishing the codegen AAR.
 */
async function assembleCodegenStaticLibraries(
  androidPath: string,
  codegenName: string
): Promise<void> {
  console.log('🔨 Building Android app in debug mode to generate debug codegen static libraries');
  await $`./gradlew ${assembleArgs('assembleDebug', codegenName)}`.cwd(
    androidPath
  );

  // Clean .cxx folder between builds to avoid conflicts
  console.log(`🧹 Cleaning .cxx and build folders between builds...`);
  await $`rm -rf ./app/.cxx ./app/build`.cwd(androidPath);

  console.log('🔨 Building Android app in release mode to generate release codegen static libraries');
  await $`./gradlew ${assembleArgs('assembleRelease', codegenName, [
    `-PrnrepoNpmName=${libraryName}`,
  ])}`.cwd(androidPath);
}

/**
 * Builds and publishes the standard (non-codegen) AAR.
 */
async function buildStandardAar(
  androidPath: string,
  gradleProjectName: string,
  classifier: string,
  license: AllowedLicense[],
  mavenLocalLibraryLocationPath: string
): Promise<void> {
  console.log('ℹ️ No codegen configuration found, building standard AAR version');
  await publishToMavenLocal(androidPath, gradleProjectName, classifier, license);
  verifyPublishedArtifacts(
    mavenLocalLibraryLocationPath,
    gradleProjectName,
    `${gradleProjectName}-${libraryVersion}-${classifier}.aar`
  );
  console.log('✓ Simple aar version published successfully');
}

/**
 * Builds the codegen static libraries and publishes the codegen AAR.
 */
async function buildCodegenAar(
  androidPath: string,
  gradleProjectName: string,
  classifier: string,
  license: AllowedLicense[],
  mavenLocalLibraryLocationPath: string,
  codegenName: string
): Promise<void> {
  await assembleCodegenStaticLibraries(androidPath, codegenName);

  console.log('📦 Publishing codegen version...');
  await publishToMavenLocal(androidPath, gradleProjectName, classifier, license, [
    `-PrnrepoCodegenName=${codegenName}`,
  ]);
  verifyPublishedArtifacts(
    mavenLocalLibraryLocationPath,
    gradleProjectName,
    `${gradleProjectName}-${libraryVersion}-${classifier}-codegen.aar`
  );
  console.log('✓ Codegen version published successfully');
}

/**
 * Patches CMakeLists.txt in libraries with custom codegen to use STATIC instead of SHARED.
 * Many libraries like react-native-screens build their codegen as shared library,
 * but we need static libraries to create AAR artifacts.
 */
async function patchCMakeListsToStatic(packagePath: string): Promise<void> {
  const configPath = join(packagePath, 'react-native.config.js');
  
  if (!existsSync(configPath)) {
    console.log('   No react-native.config.js found, skipping CMakeLists patch');
    return;
  }

  try {
    // Load the config file - use dynamic import with absolute path
    const config = await import(resolve(configPath));
    const configModule = config.default || config;
    let cmakeListsPath = configModule?.dependency?.platforms?.android?.cmakeListsPath;
    
    if (!cmakeListsPath) {
      console.log('   No cmakeListsPath found in react-native.config.js');
      return;
    }

    // CMakeLists path is relative to package root, remove leading "../" if present
    cmakeListsPath = cmakeListsPath.replace(/^\.\.\//, '');
    
    // Resolve the path relative to the package
    let absoluteCMakePath = join(packagePath, cmakeListsPath);
    
    if (!existsSync(absoluteCMakePath)) {
      console.log(`   CMakeLists.txt not found at ${absoluteCMakePath}`);
      absoluteCMakePath = join(packagePath, 'android', cmakeListsPath);
      if (!existsSync(absoluteCMakePath)) {
        throw new Error(`   CMakeLists.txt not found at ${absoluteCMakePath}`);
      }
    }
    console.log(`   CMakeLists.txt found at ${absoluteCMakePath}`);

    // Read CMakeLists.txt
    let cmakeContent = readFileSync(absoluteCMakePath, 'utf-8');
    
    // Check if it contains add_library with SHARED
    if (!cmakeContent.includes('add_library') || !cmakeContent.includes('SHARED')) {
      console.log('   CMakeLists.txt does not contain add_library with SHARED');
      return;
    }

    // Replace SHARED with STATIC in add_library calls
    const originalContent = cmakeContent;
    cmakeContent = cmakeContent.replace(
      /add_library\s*\(\s*([^\s)]+)\s+SHARED/g,
      'add_library(\n  $1\n  STATIC'
    );

    if (cmakeContent !== originalContent) {
      writeFileSync(absoluteCMakePath, cmakeContent, 'utf-8');
      console.log(`   ✓ Patched ${absoluteCMakePath}: SHARED → STATIC`);
    } else {
      console.log('   No SHARED libraries found to patch');
    }
  } catch (error) {
    console.error(`   ⚠️ Failed to patch CMakeLists.txt:`, error);
    // Don't throw - continue with build even if patching fails
  }
}

// Main execution
console.log('📦 Building Android library:');
console.log(`   Library: ${libraryName}@${libraryVersion}`);
console.log(`   React Native: ${reactNativeVersion}`);
console.log(workletsVersion ? `   Worklets Version: ${workletsVersion}\n` : '');

try {
  await buildLibrary();
  process.exit(0);
} catch (error) {
  console.error('❌ Build failed:', error);
  process.exit(1);
}

async function buildAAR(appDir: string, license: AllowedLicense[]) {
  const gradleProjectName = sanitizePackageName(libraryName);
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

  // Check if library has codegen configuration
  const packageJsonPath = join(packagePath, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  const hasCodegenConfig = !!packageJson.codegenConfig?.name;
  
  // Check if library has custom react-native.config.js file, which may override codegen settings
  const hasCustomCodegen = existsSync(join(packagePath, 'react-native.config.js'));
  
  // If library has custom codegen, we need to patch CMakeLists.txt to use STATIC instead of SHARED
  if (hasCustomCodegen) {
    console.log('⚠️ Library has custom codegen configuration in react-native.config.js');
    await patchCMakeListsToStatic(packagePath);
  }

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
    // If library has codegen, build codegen version as well
    if (!hasCodegenConfig) {
      await buildStandardAar(
        androidPath,
        gradleProjectName,
        classifier,
        license,
        mavenLocalLibraryLocationPath
      );
    } else {
      await buildCodegenAar(
        androidPath,
        gradleProjectName,
        classifier,
        license,
        mavenLocalLibraryLocationPath,
        packageJson.codegenConfig.name
      );
    }

  } catch (error) {
    console.error(`❌ Build failed:`, error);
    throw error;
  }
}

async function buildLibrary() {
  console.log(
    `🔨 Building AAR for ${libraryName}@${libraryVersion} with RN ${reactNativeVersion}...`
  );

  try {
    // Setup React Native project and install library
    const {
      appDir,
      license,
      postinstallGradleScriptPath: gradleScriptPath,
    } = await setupReactNativeProject(
      workDir,
      libraryName,
      libraryVersion,
      reactNativeVersion,
      workletsVersion
    );

    // Set gradle script path if returned
    if (gradleScriptPath) {
      postinstallGradleScriptPath = gradleScriptPath;
    }

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
