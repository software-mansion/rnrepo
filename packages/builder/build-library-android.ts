import { $ } from 'bun';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
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

async function buildAAR(appDir: string, license: AllowedLicense) {
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
  
  // we don't want to build codegen version if custom codegen is present since e.g. with custom shadow nodes, additional headers should be linked
  const shouldBuildCodegen = hasCodegenConfig && !hasCustomCodegen;
  
  if (hasCodegenConfig && hasCustomCodegen) {
    console.log(`⚠️ Library probably has custom codegen configuration in react-native.config.js, skipping codegen build`);
    process.exit(1);
  } else if (shouldBuildCodegen) {
    console.log(`✓ Library has codegen configuration: ${packageJson.codegenConfig.name}`);
  }

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
    // console.log('📦 Publishing standard version...');
    // await $`./gradlew :${gradleProjectName}:publishToMavenLocal \
    //   --no-daemon \
    //   --init-script ${addPublishingGradleScriptPath} \
    //   --init-script ${addPrefabReduceGradleScriptPath} \
    //   ${
    //     postinstallGradleScriptPath
    //       ? { raw: '--init-script ' + postinstallGradleScriptPath }
    //       : ''
    //   } \
    //   -PrnrepoArtifactId=${gradleProjectName} \
    //   -PrnrepoPublishVersion=${libraryVersion} \
    //   -PrnrepoClassifier=${classifier} \
    //   -PrnrepoCpuInfo=${getCpuInfo()} \
    //   -PrnrepoBuildUrl=${GITHUB_BUILD_URL} \
    //   -PrnrepoLicenseName=${license} \
    //   -PrnrepoLicenseUrl=https://opensource.org/license/${license}
    // `.cwd(androidPath);

    // // verify that the .pom and .aar files are present after the publish command completes
    // const pomPath = join(
    //   mavenLocalLibraryLocationPath,
    //   `${gradleProjectName}-${libraryVersion}.pom`
    // );
    // if (!existsSync(pomPath)) {
    //   throw new Error(`POM file not found at ${pomPath}`);
    // }
    // const aarPath = join(
    //   mavenLocalLibraryLocationPath,
    //   `${gradleProjectName}-${libraryVersion}-${classifier}.aar`
    // );
    // if (!existsSync(aarPath)) {
    //   throw new Error(`AAR file not found at ${aarPath}`);
    // }

    // console.log('✓ Standard version published to Maven Local successfully');

    // If library has codegen, build codegen version as well
    if (shouldBuildCodegen) {
      // first build the app so we can get codegen artifacts generated
      console.log('🔨 Building Android app to generate codegen static libraries');
      await $`./gradlew assembleRelease --no-daemon`.cwd(androidPath);

      console.log('📦 Publishing codegen version...');
      await $`./gradlew :${gradleProjectName}:publishToMavenLocal \
        --no-daemon \
        --init-script ${addPublishingGradleScriptPath} \
        --init-script ${addPrefabReduceGradleScriptPath} \
        ${postinstallGradleScriptPath ? { raw: "--init-script " + postinstallGradleScriptPath} : ""} \
        -PrnrepoArtifactId=${gradleProjectName} \
        -PrnrepoPublishVersion=${libraryVersion} \
        -PrnrepoClassifier=${classifier} \
        -PrnrepoCpuInfo=${getCpuInfo()} \
        -PrnrepoBuildUrl=${GITHUB_BUILD_URL} \
        -PrnrepoLicenseName=${license} \
        -PrnrepoLicenseUrl=https://opensource.org/license/${license} \
        -PrnrepoCodegenName=${packageJson.codegenConfig.name}
      `.cwd(androidPath);

      // verify codegen version
      const codegenAarPath = join(
        mavenLocalLibraryLocationPath,
        `${gradleProjectName}-${libraryVersion}-${classifier}-codegen.aar`
      );
      if (!existsSync(codegenAarPath)) {
        throw new Error(`Codegen AAR file not found at ${codegenAarPath}`);
      }
      console.log('✓ Codegen version published successfully');
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
