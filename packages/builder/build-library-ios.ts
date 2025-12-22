import { $ } from 'bun';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  readdirSync,
} from 'fs';
import { join, basename } from 'path';
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

if (!libraryName || !libraryVersion || !reactNativeVersion || !workDir) {
  console.error(
    'Usage: bun run build-library-ios.ts <library-name> <library-version> <react-native-version> <work-dir> [<worklets-version>]'
  );
  process.exit(1);
}

const CONFIGURATION = 'Release';
const GITHUB_BUILD_URL = getGithubBuildUrl();

// Note: Bitcode was deprecated in Xcode 14 and removed entirely by Apple.
// We build static frameworks instead, which provide better app size and performance.

// Main execution
console.log('📦 Building iOS library:');
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
  await installSetup(appDir, libraryName, phase, 'ios');
}

/**
 * Get the pod name for a given library
 * This extracts the pod name from the library's podspec or package.json
 */
function getPodName(appDir: string): string {
  const packagePath = join(appDir, 'node_modules', libraryName);

  // Try to find podspec file
  const files = readdirSync(packagePath);
  const podspecFile = files.find(
    (f) => f.endsWith('.podspec') || f.endsWith('.podspec.json')
  );

  if (podspecFile) {
    const podspecName = podspecFile.replace(/\.podspec(\.json)?$/, '');
    return podspecName;
  }

  // Fallback: use library name
  return libraryName;
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
 * No longer needed! XCFramework keeps device and simulator separate.
 * Legacy function removed - we use createXCFramework instead.
 */

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

    // Find the built framework by searching the build directory
    console.log('🔍 Searching for built framework...');

    // Try exact match first
    let findResult =
      await $`find ${buildDir} -name "${podName}.framework" -type d`.quiet();
    let frameworks = findResult.stdout
      .toString()
      .trim()
      .split('\n')
      .filter((f) => f);

    // If not found, try with underscores (e.g., react-native-webview -> react_native_webview)
    if (frameworks.length === 0) {
      const podNameWithUnderscores = podName.replace(/-/g, '_');
      console.log(
        `   Trying alternative name: ${podNameWithUnderscores}.framework...`
      );
      findResult =
        await $`find ${buildDir} -name "${podNameWithUnderscores}.framework" -type d`.quiet();
      frameworks = findResult.stdout
        .toString()
        .trim()
        .split('\n')
        .filter((f) => f);
    }

    // If still not found, search in the pod's specific directory
    if (frameworks.length === 0) {
      console.log(`   Searching in pod-specific directory...`);
      const podBuildDir = join(
        buildDir,
        `${CONFIGURATION}-iphonesimulator`,
        podName
      );
      if (existsSync(podBuildDir)) {
        findResult =
          await $`find ${podBuildDir} -name "*.framework" -type d -maxdepth 1`.quiet();
        frameworks = findResult.stdout
          .toString()
          .trim()
          .split('\n')
          .filter((f) => f);
      }
    }

    if (frameworks.length === 0) {
      // Also search in DerivedData
      console.log('   No frameworks in build dir, checking DerivedData...');
      const derivedFind =
        await $`find ${derivedDataPath} -name "*.framework" -type d`.quiet();
      const allDerivedFrameworks = derivedFind.stdout
        .toString()
        .trim()
        .split('\n')
        .filter((f) => f);

      // Filter to frameworks that might match this pod
      const podNameVariations = [
        podName,
        podName.replace(/-/g, '_'),
        podName.replace(/@/g, '').replace(/\//g, '_'),
      ];

      frameworks = allDerivedFrameworks.filter((f) =>
        podNameVariations.some((variation) =>
          f.includes(`${variation}.framework`)
        )
      );
    }

    if (frameworks.length === 0) {
      // Debug: show what's actually in the directories
      console.error('❌ No frameworks found. Listing build contents:');
      try {
        const buildContents =
          await $`find ${buildDir} -type d -name "*.framework" 2>/dev/null | head -20`.quiet();
        console.error(buildContents.stdout.toString());
      } catch (e) {
        console.error('Could not list build directory');
      }
      throw new Error(
        `No frameworks found for ${podName} in build or DerivedData directories`
      );
    }

    console.log(`   Found ${frameworks.length} matching framework(s)`);

    // Prefer simulator framework
    let simulatorFrameworkPath = frameworks.find((f) =>
      f.includes('iphonesimulator')
    );

    // If no simulator-specific one, try any framework (might be universal)
    if (!simulatorFrameworkPath && frameworks.length > 0) {
      console.log(
        `   No iphonesimulator-specific framework, using: ${frameworks[0]}`
      );
      simulatorFrameworkPath = frameworks[0];
    }

    if (!simulatorFrameworkPath) {
      console.log('Available frameworks:', frameworks);
      throw new Error(`No simulator framework found for ${podName}`);
    }

    console.log(`✓ Found framework at: ${simulatorFrameworkPath}`);

    // Extract the actual framework name from the path (might differ from pod name)
    // e.g., react_native_webview.framework -> react_native_webview
    const actualFrameworkName = basename(simulatorFrameworkPath, '.framework');
    let frameworkPathToUse = simulatorFrameworkPath;

    if (actualFrameworkName !== podName) {
      console.log(
        `   Framework name: ${actualFrameworkName} (differs from pod name: ${podName})`
      );
      console.log(
        '   Renaming framework to match pod name for CocoaPods compatibility...'
      );

      // Copy the framework to a new location with the correct name
      // e.g., react_native_webview.framework -> react-native-webview.framework
      const renamedFrameworkPath = join(
        buildDir,
        `${CONFIGURATION}-iphonesimulator`,
        `${podName}.framework`
      );

      // Copy instead of move to preserve the original
      await $`cp -R ${simulatorFrameworkPath} ${renamedFrameworkPath}`;

      // Rename the binary inside the framework
      const oldBinaryPath = join(renamedFrameworkPath, actualFrameworkName);
      const newBinaryPath = join(renamedFrameworkPath, podName);
      if (existsSync(oldBinaryPath)) {
        await $`mv ${oldBinaryPath} ${newBinaryPath}`;
        console.log(`   Renamed binary: ${actualFrameworkName} -> ${podName}`);
      }

      // Update Info.plist if it exists
      const infoPlistPath = join(renamedFrameworkPath, 'Info.plist');
      if (existsSync(infoPlistPath)) {
        // Update CFBundleExecutable to match the new binary name
        await $`/usr/libexec/PlistBuddy -c "Set :CFBundleExecutable ${podName}" ${infoPlistPath}`.quiet();
        console.log(`   Updated Info.plist`);
      }

      // Also rename dSYM if it exists
      const originalDsym = `${simulatorFrameworkPath}.dSYM`;
      const renamedDsym = `${renamedFrameworkPath}.dSYM`;
      if (existsSync(originalDsym)) {
        await $`cp -R ${originalDsym} ${renamedDsym}`;

        // Rename the binary inside dSYM as well
        const oldDsymBinary = join(
          renamedDsym,
          'Contents',
          'Resources',
          'DWARF',
          actualFrameworkName
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
    const zipName = `${libraryName}-${libraryVersion}-rn${reactNativeVersion}.xcframework.zip`;
    const zipPath = join(outputPath, zipName);
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
  const appDir = join(workDir, 'rnrepo_build_app');

  // Create work directory if it doesn't exist
  mkdirSync(workDir, { recursive: true });

  // Check that app directory doesn't exist yet
  if (existsSync(appDir)) {
    throw new Error(`App directory ${appDir} already exists.`);
  }

  console.log(
    `🔨 Building static XCFramework for ${libraryName}@${libraryVersion} with RN ${reactNativeVersion}...`
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
