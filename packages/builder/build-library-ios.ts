import { $, Glob } from 'bun';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { join, basename } from 'path';
import { sanitizePackageName } from '@rnrepo/config';
import {
  type AllowedLicense,
  getGithubBuildUrl,
  getCpuInfo,
  setupReactNativeProject,
} from './build-utils';

/**
 * Build Library iOS Script
 *
 * This script builds an iOS XCFramework from an NPM package.
 * Uses the modern XCFramework format which keeps device and simulator variants separate.
 *
 * @param libraryName - Name of the library from NPM
 * @param libraryVersion - Version of the library from NPM
 * @param reactNativeVersion - React Native version to use for building
 * @param buildConfig - Build configuration: "release" or "debug"
 * @param workDir - Working directory where "app" (RN project) and "outputs" (XCFrameworks) will be created
 * @param workletsVersion - (Optional) react-native-worklets version to install
 */

const [
  libraryName,
  libraryVersion,
  reactNativeVersion,
  buildConfig,
  workDir,
  workletsVersion,
] = process.argv.slice(2);

if (
  !libraryName ||
  !libraryVersion ||
  !reactNativeVersion ||
  !buildConfig ||
  !workDir
) {
  console.error(
    'Usage: bun run build-library-ios.ts <library-name> <library-version> <react-native-version> <build-config> <work-dir> [<worklets-version>]'
  );
  process.exit(1);
}

// Validate build configuration (must be lowercase)
if (buildConfig !== 'release' && buildConfig !== 'debug') {
  console.error(
    `Invalid build configuration: ${buildConfig}. Must be "release" or "debug" (lowercase)`
  );
  process.exit(1);
}

// Convert to Xcode configuration format (Release/Debug)
const CONFIGURATION =
  buildConfig.charAt(0).toUpperCase() + buildConfig.slice(1);
const GITHUB_BUILD_URL = getGithubBuildUrl();

// Note: Bitcode was deprecated in Xcode 14 and removed entirely by Apple.
// We build static frameworks instead, which provide better app size and performance.

// Main execution
console.log('📦 Building iOS library:');
console.log(`   Library: ${libraryName}@${libraryVersion}`);
console.log(`   React Native: ${reactNativeVersion}`);
console.log(`   Configuration: ${CONFIGURATION}`);
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

/**
 * Get the pod name for a given library
 * This extracts the pod name from the library's podspec or package.json
 */
function getPodName(appDir: string): string {
  const packagePath = join(appDir, 'node_modules', libraryName);

  // Try to find podspec file using bun glob
  const glob = new Glob('*.podspec');
  const podspecFiles = Array.from(glob.scanSync(packagePath));

  if (podspecFiles.length > 0) {
    return basename(podspecFiles[0], '.podspec');
  }

  throw new Error(
    `Could not find podspec file for ${libraryName} in ${packagePath}`
  );
}

/**
 * Build static framework for iOS using xcodebuild
 * Creates static libraries that are linked at compile time (better for distribution)
 */
async function xcodebuild(
  projectPath: string,
  scheme: string,
  sdk: 'iphoneos' | 'iphonesimulator',
  configuration: string,
  buildDir: string,
  derivedDataPath: string
): Promise<void> {
  const args = [
    '-workspace',
    projectPath,
    '-scheme',
    scheme,
    '-configuration',
    configuration,
    '-sdk',
    sdk,
    'BUILD_DIR=' + buildDir,
    'SYMROOT=' + buildDir,
    'OBJROOT=' + join(buildDir, 'obj'),
    '-derivedDataPath',
    derivedDataPath,
    'ONLY_ACTIVE_ARCH=NO',
    'BUILD_LIBRARY_FOR_DISTRIBUTION=YES',
    // Build as static framework (not dynamic)
    'MACH_O_TYPE=staticlib',
    // Skip install step (we only need the build products)
    'SKIP_INSTALL=NO',
    // Enable module support for Swift
    'DEFINES_MODULE=YES',
  ];

  // For simulator, build only x86_64 and arm64 (Apple Silicon)
  if (sdk === 'iphonesimulator') {
    args.push('ARCHS=x86_64 arm64');
  }

  console.log(`   Building static framework for ${sdk}...`);

  try {
    await $`xcodebuild ${args} build`.quiet();
  } catch (error) {
    console.error(`❌ xcodebuild failed for ${sdk}:`, error);
    throw error;
  }
}

/**
 * Build the iOS XCFramework
 */
async function buildFramework(appDir: string, license: AllowedLicense) {
  const iosPath = join(appDir, 'ios');
  const projectPath = join(iosPath, basename(appDir) + '.xcworkspace');

  // Validate that project exists
  if (!existsSync(projectPath)) {
    throw new Error(`Xcode workspace not found at ${projectPath}`);
  }

  const podName = getPodName(appDir);
  const appScheme = basename(appDir); // The main app scheme (e.g., "rnrepo_build_app")
  console.log(
    `📱 Building app scheme: ${appScheme} (to generate pod: ${podName})`
  );

  const buildDir = join(workDir, 'build');
  const derivedDataPath = join(workDir, 'DerivedData');
  const outputPath = join(workDir, 'outputs');

  mkdirSync(buildDir, { recursive: true });
  mkdirSync(outputPath, { recursive: true });

  try {
    // TEMPORARILY DISABLED: Build for device (uncomment when needed for full XCFramework)
    // await xcodebuild(
    //   projectPath,
    //   appScheme, // Build the app, not individual pods
    //   'iphoneos',
    //   CONFIGURATION,
    //   buildDir,
    //   derivedDataPath
    // );

    // Build for simulator (for faster testing)
    // Building the app will build all pods including the one we want
    await xcodebuild(
      projectPath,
      appScheme, // Build the app, not individual pods
      'iphonesimulator',
      CONFIGURATION,
      buildDir,
      derivedDataPath
    );

    // Find the built framework using predictable CocoaPods structure
    console.log('🔍 Locating built framework...');

    // CocoaPods always sanitizes pod names to valid C identifiers (dashes → underscores)
    // Framework location: build/Release-iphonesimulator/{podName}/{frameworkName}.framework
    const frameworkName = podName.replace(/-/g, '_');
    const simulatorFrameworkPath = join(
      buildDir,
      `${CONFIGURATION}-iphonesimulator`,
      podName,
      `${frameworkName}.framework`
    );

    if (!existsSync(simulatorFrameworkPath)) {
      throw new Error(
        `Framework not found at expected location: ${simulatorFrameworkPath}\n` +
          `Pod name: ${podName}\n` +
          `Expected framework name: ${frameworkName}.framework`
      );
    }

    console.log(`✓ Found framework at: ${simulatorFrameworkPath}`);

    // Rename framework to match pod name if they differ
    // This happens when pod names contain dashes (e.g., react-native-webview)
    // CocoaPods builds as react_native_webview but we need react-native-webview for linking
    let frameworkPathToUse = simulatorFrameworkPath;

    if (frameworkName !== podName) {
      console.log(
        `   Framework name (${frameworkName}) differs from pod name (${podName})`
      );
      console.log(
        '   Renaming framework to match pod name for CocoaPods compatibility...'
      );

      // Copy the framework to a new location with the pod name
      // e.g., react_native_webview.framework -> react-native-webview.framework
      const renamedFrameworkPath = join(
        buildDir,
        `${CONFIGURATION}-iphonesimulator`,
        `${podName}.framework`
      );

      // Copy instead of move to preserve the original
      await $`cp -R ${simulatorFrameworkPath} ${renamedFrameworkPath}`;

      // Rename the binary inside the framework to match pod name
      const oldBinaryPath = join(renamedFrameworkPath, frameworkName);
      const newBinaryPath = join(renamedFrameworkPath, podName);
      if (existsSync(oldBinaryPath)) {
        await $`mv ${oldBinaryPath} ${newBinaryPath}`;
        console.log(`   Renamed binary: ${frameworkName} -> ${podName}`);
      }

      // Update Info.plist CFBundleExecutable to match the new binary name
      const infoPlistPath = join(renamedFrameworkPath, 'Info.plist');
      if (existsSync(infoPlistPath)) {
        await $`/usr/libexec/PlistBuddy -c "Set :CFBundleExecutable ${podName}" ${infoPlistPath}`.quiet();
        console.log(`   Updated Info.plist`);
      }

      // Also rename dSYM if it exists
      const originalDsym = `${simulatorFrameworkPath}.dSYM`;
      const renamedDsym = `${renamedFrameworkPath}.dSYM`;
      if (existsSync(originalDsym)) {
        await $`cp -R ${originalDsym} ${renamedDsym}`;

        // Rename the binary inside dSYM to match pod name
        const oldDsymBinary = join(
          renamedDsym,
          'Contents',
          'Resources',
          'DWARF',
          frameworkName
        );
        const newDsymBinary = join(
          renamedDsym,
          'Contents',
          'Resources',
          'DWARF',
          podName
        );
        if (existsSync(oldDsymBinary)) {
          await $`mv ${oldDsymBinary} ${newDsymBinary}`;
        }
        console.log('   Renamed dSYM as well');
      }

      frameworkPathToUse = renamedFrameworkPath;
      console.log(`   ✓ Framework renamed to: ${podName}.framework`);
    }

    // Create XCFramework (use pod name for consistency with CocoaPods plugin)
    console.log('🔨 Creating XCFramework...');
    const xcframeworkPath = join(outputPath, `${podName}.xcframework`);

    // Remove existing xcframework if present
    if (existsSync(xcframeworkPath)) {
      rmSync(xcframeworkPath, { recursive: true, force: true });
    }

    const args = ['-create-xcframework', '-framework', frameworkPathToUse];

    // Add simulator dSYM if present (use the renamed path)
    const simulatorDsym = `${frameworkPathToUse}.dSYM`;
    if (existsSync(simulatorDsym)) {
      args.push('-debug-symbols', simulatorDsym);
      console.log('   Including debug symbols (dSYM)');
    }

    // When device build is enabled, add it here:
    // const deviceFrameworkPath = ...
    // args.push('-framework', deviceFrameworkPath);
    // if (existsSync(deviceDsym)) args.push('-debug-symbols', deviceDsym);

    args.push('-output', xcframeworkPath);

    await $`xcodebuild ${args}`;
    console.log(`✓ Created XCFramework at ${xcframeworkPath}`);

    // Create zip archive
    console.log('📦 Creating zip archive...');
    const sanitizedLibraryName = sanitizePackageName(libraryName);
    const zipName = `${sanitizedLibraryName}-${libraryVersion}-rn${reactNativeVersion}-${buildConfig}.xcframework.zip`;
    await $`zip -r ${zipName} ${podName}.xcframework`.cwd(outputPath).quiet();
    console.log(`✓ Created zip archive: ${zipName}`);

    // Create metadata file
    const metadataPath = join(outputPath, `${podName}.metadata.json`);
    const metadata = {
      libraryName,
      libraryVersion,
      reactNativeVersion,
      podName,
      frameworkType: 'static',
      configuration: CONFIGURATION,
      workletsVersion: workletsVersion || null,
      license,
      cpuInfo: getCpuInfo(),
      buildUrl: GITHUB_BUILD_URL,
      buildDate: new Date().toISOString(),
      note: 'Framework has been renamed to match pod name for CocoaPods compatibility',
    };
    writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    console.log(`✓ Metadata written to ${metadataPath}`);
  } catch (error) {
    console.error('❌ Static XCFramework build failed:', error);
    throw error;
  }
}

async function buildLibrary() {
  console.log(
    `🔨 Building static XCFramework for ${libraryName}@${libraryVersion} with RN ${reactNativeVersion}...`
  );

  try {
    // Setup React Native project and install library
    const { appDir, license } = await setupReactNativeProject(
      workDir,
      libraryName,
      libraryVersion,
      reactNativeVersion,
      workletsVersion
    );

    // Modify Podfile to build frameworks
    console.log('📝 Modifying Podfile to build frameworks...');
    const iosPath = join(appDir, 'ios');
    const podfilePath = join(iosPath, 'Podfile');
    const podfileContent = readFileSync(podfilePath, 'utf-8');

    // Add use_frameworks! :linkage => :static after the platform line
    const modifiedPodfile = podfileContent.replace(
      /(platform :ios.*)/,
      `$1\n\n# Force frameworks to be built (added by buildle)\nuse_frameworks! :linkage => :static`
    );
    writeFileSync(podfilePath, modifiedPodfile);
    console.log('✓ Podfile modified to build static frameworks');

    // Run pod install
    console.log('📦 Running pod install...');
    await $`pod install`.cwd(iosPath);
    console.log('✓ Pod install completed');

    // Build static XCFramework
    console.log('🔨 Building iOS static XCFramework...');
    await buildFramework(appDir, license);

    console.log(
      `✅ Successfully built static XCFramework for ${libraryName}@${libraryVersion} with RN ${reactNativeVersion}`
    );
  } catch (error) {
    console.error(
      `❌ Error building static XCFramework for ${libraryName}@${libraryVersion}:`,
      error
    );
    throw error;
  }
}
