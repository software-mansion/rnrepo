import { $, Glob } from 'bun';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join, basename } from 'path';
import { sanitizePackageName } from '@rnrepo/config';
import {
  type AllowedLicense,
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
 * @param workDir - Working directory where "app" (RN project) and "outputs" (XCFrameworks) will be created
 * @param workletsVersion - (Optional) react-native-worklets version to install
 */

const [
  libraryName,
  libraryVersion,
  reactNativeVersion,
  workDir,
  workletsVersion,
] = process.argv.slice(2);

if (
  !libraryName ||
  !libraryVersion ||
  !reactNativeVersion ||
  !workDir
) {
  console.error(
    'Usage: bun run build-library-ios.ts <library-name> <library-version> <react-native-version> <work-dir> [<worklets-version>]'
  );
  process.exit(1);
}

// Convert to Xcode configuration format (Release/Debug)
const buildConfigs = ['Release', 'Debug'];

// Note: Bitcode was deprecated in Xcode 14 and removed entirely by Apple.
// We build static frameworks instead, which provide better app size and performance.

// Main execution
console.log('📦 Building iOS library:');
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

/**
 * Get the pod name for a given library
 * This extracts the pod name from the library's podspec or package.json
 */
function getPodName(appDir: string): string {
  const packagePath = join(appDir, 'node_modules', libraryName);

  // Try to find podspec file using bun glob
  const glob = new Glob('*.podspec');
  const podspecFiles = Array.from(glob.scanSync({ cwd: packagePath })) as string[];

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
async function buildFramework(appDir: string, _license: AllowedLicense) {
  const iosPath = join(appDir, 'ios');
  const projectPath = join(iosPath, basename(appDir) + '.xcworkspace');

  // Validate that project exists
  if (!existsSync(projectPath)) {
    throw new Error(`Xcode workspace not found at ${projectPath}`);
  }

  const podName = getPodName(appDir);
  console.log(
    `📱 Building library pod: ${podName}`
  );

  const buildDir = join(workDir, 'build');
  const derivedDataPath = join(workDir, 'DerivedData');
  const outputPath = join(workDir, 'outputs');

  mkdirSync(buildDir, { recursive: true });
  mkdirSync(outputPath, { recursive: true });

  const sdks: Array<'iphoneos' | 'iphonesimulator'> = ['iphoneos', 'iphonesimulator'];

  for (const configuration of buildConfigs) {
    try {
      // Build for all SDKs
      for (const sdk of sdks) {
        await xcodebuild(
          projectPath,
          podName,
          sdk,
          configuration,
          buildDir,
          derivedDataPath
        );
      }

      // Find the built frameworks using glob
      console.log('🔍 Locating built frameworks...');

      // CocoaPods may sanitize pod names to valid C identifiers (e.g., dashes → underscores)
      // So we glob for *.framework instead of assuming the sanitization logic
      const frameworkPaths = new Map<string, string>();
      let frameworkFile = '';

      for (const sdk of sdks) {
        const sdkBuildDir = join(
          buildDir,
          `${configuration}-${sdk}`,
          podName
        );

        const glob = new Glob('*.framework');
        const frameworks = Array.from(
          glob.scanSync({ cwd: sdkBuildDir, onlyFiles: false })
        );

        if (frameworks.length === 0) {
          throw new Error(
            `No framework found in ${sdkBuildDir}\n` +
              `Pod name: ${podName}\n` +
              `Expected to find *.framework`
          );
        }

        if (frameworks.length > 1) {
          throw new Error(
            `Multiple frameworks found in ${sdkBuildDir}: ${frameworks.join(
              ', '
            )}\n` + `Expected exactly one framework for pod: ${podName}`
          );
        }

        frameworkFile = frameworks[0] as string; // e.g., "react_native_webview.framework"
        const frameworkPath = join(sdkBuildDir, frameworkFile);
        frameworkPaths.set(sdk, frameworkPath);

        console.log(`✓ Found framework for ${sdk}: ${frameworkPath}`);
      }

      // Create XCFramework using the actual framework name from CocoaPods
      console.log('🔨 Creating XCFramework...');
      const xcframeworkFile = frameworkFile.replace('.framework', '.xcframework');
      const xcframeworkPath = join(outputPath, xcframeworkFile);

      // Remove existing xcframework if present
      if (existsSync(xcframeworkPath)) {
        rmSync(xcframeworkPath, { recursive: true, force: true });
      }

      const args = ['-create-xcframework'];

      // Add frameworks and debug symbols for all SDKs
      for (const [sdk, frameworkPath] of frameworkPaths) {
        args.push('-framework', frameworkPath);
        const dsym = `${frameworkPath}.dSYM`;
        if (existsSync(dsym)) {
          args.push('-debug-symbols', dsym);
          console.log(`   Including ${sdk} debug symbols (dSYM)`);
        }
      }

      args.push('-output', xcframeworkPath);

      await $`xcodebuild ${args}`;
      console.log(`✓ Created XCFramework at ${xcframeworkPath}`);

      // Create zip archive
      console.log('📦 Creating zip archive...');
      const sanitizedLibraryName = sanitizePackageName(libraryName);
      const zipName = `${sanitizedLibraryName}-${libraryVersion}-rn${reactNativeVersion}-${configuration.toLowerCase()}.xcframework.zip`;
      await $`zip -r ${zipName} ${xcframeworkFile}`.cwd(outputPath).quiet();
      console.log(`✓ Created zip archive: ${zipName}`);
    } catch (error) {
      console.error('❌ Static XCFramework build failed:', error);
      throw error;
    }
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

    // Run pod install with USE_FRAMEWORKS=static environment variable
    // The RN template Podfile checks ENV['USE_FRAMEWORKS'] and calls use_frameworks! if set
    // This is available as early as RN 0.74.0 so safe to use here
    console.log('📦 Running pod install with static frameworks...');
    const iosPath = join(appDir, 'ios');
    await $`pod install`.cwd(iosPath).env({
      ...process.env,
      USE_FRAMEWORKS: 'static',
      USE_PREBUILT_REACT_NATIVE: '1', // Use prebuilt React Native to speed up builds
      RCT_USE_RN_DEP: '1', // Use RN dependency management
    });
    console.log('✓ Pod install completed with static frameworks');

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
