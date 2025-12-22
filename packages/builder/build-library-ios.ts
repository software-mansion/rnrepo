import { convertToGradleProjectName } from '@rnrepo/config';
import { $ } from 'bun';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'fs';
import { arch, cpus, platform } from 'node:os';
import { join, resolve, relative } from 'path';

/**
 * Build Library iOS Script
 *
 * This script builds an iOS XCFramework from an NPM package.
 *
 * @param libraryName - Name of the library from NPM
 * @param libraryVersion - Version of the library from NPM
 * @param reactNativeVersion - React Native version to use for building
 * @param workDir - Working directory where "app" (RN project) and "outputs" (XCFramework files) will be created
 * @param workletsVersion - (Optional) react-native-worklets version to install
 */

const [libraryName, libraryVersion, reactNativeVersion, workDir, workletsVersion] =
  process.argv.slice(2);

if (!libraryName || !libraryVersion || !reactNativeVersion || !workDir) {
  console.error(
    'Usage: bun run build-library-ios.ts <library-name> <library-version> <react-native-version> <work-dir> [<worklets-version>]'
  );
  process.exit(1);
}

type AllowedLicense = 'MIT' | 'Apache-2.0' | 'BSD-3-Clause' | 'BSD-2-Clause';

const ALLOWED_LICENSES: AllowedLicense[] = [
  'MIT',
  'Apache-2.0',
  'BSD-3-Clause',
  'BSD-2-Clause',
];

const GITHUB_SERVER_URL = process.env.GITHUB_SERVER_URL;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;
const GITHUB_RUN_ID = process.env.GITHUB_RUN_ID;
const GITHUB_BUILD_URL = `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`;

// Main execution
console.log('📦 Building iOS library:');
console.log(`   Library: ${libraryName}@${libraryVersion}`);
console.log(`   React Native: ${reactNativeVersion}`);
console.log(`${workletsVersion ? `   Worklets Version: ${workletsVersion}\n` : ''}`);

try {
  await buildLibrary();
  process.exit(0);
} catch (error) {
  console.error('❌ Build failed:', error);
  process.exit(1);
}

function extractAndVerifyLicense(appDir: string): AllowedLicense {
  const packageJsonPath = join(
    appDir,
    'node_modules',
    libraryName,
    'package.json'
  );
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  const licenseName = packageJson.license;
  if (!ALLOWED_LICENSES.includes(licenseName as AllowedLicense)) {
    throw new Error(
      `License ${licenseName} is not allowed. Allowed licenses are: ${ALLOWED_LICENSES.join(
        ', '
      )}`
    );
  }
  return licenseName as AllowedLicense;
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

async function installSetup(appDir: string, phase: "preInstall" | "postInstall") {
  const libraryJsonPath = join(
    __dirname,
    '..',
    '..',
    'libraries.json'
  );
  const libraryJson = JSON.parse(readFileSync(libraryJsonPath, 'utf-8'));
  const scriptPath = libraryJson[libraryName]?.[phase + "ScriptPath"] as string | undefined;
  if (scriptPath && existsSync(scriptPath)) {
    const fullScriptPath = join(__dirname, '..', '..', scriptPath);
    if (scriptPath.endsWith('.ts') || scriptPath.endsWith('.js')) {
      await $`bun run ${fullScriptPath}`.cwd(appDir);
      console.log(`✓ Executed ${phase} script for ${libraryName}`);
    }
  } else {
    console.log(`ℹ️ No ${phase} script found for ${libraryName}`);
  }
}

function getCpuInfo() {
  return `${arch()}-${platform()}-${cpus().length}coresAt${cpus()[0].speed}`;
}

function getArtifactName(
  iosLibraryName: string,
  libraryVersion: string,
  reactNativeVersion: string,
  workletsVersion?: string
): string {
  return `${iosLibraryName}-${libraryVersion}-rn${reactNativeVersion}${workletsVersion ? `-worklets${workletsVersion}` : ''}.xcframework`;
}

function getArchiveName(
  scheme: string,
  sdk: string,
  arch: string[],
): string {
  return `${scheme}-${sdk}-${arch.join('_')}.xcarchive`;
}

async function buildXCFramework(appDir: string, license: AllowedLicense) {
  const packagePath = join(appDir, 'node_modules', libraryName);
  const projectIosPath = join(appDir, 'ios');

  // Validate that package exists
  if (!existsSync(packagePath)) {
    throw new Error(
      `Package not found: ${libraryName}. Make sure it's installed in node_modules.`
    );
  }

  let packageIosPath = null;
  const packageIosPath_ios = join(packagePath, 'ios');
  const packageIosPath_apple = join(packagePath, 'apple');
  if (existsSync(packageIosPath_ios)) {
    packageIosPath = packageIosPath_ios;
  } else if (existsSync(packageIosPath_apple)) {
    packageIosPath = packageIosPath_apple;
  } else {
    throw new Error(
      `Package ${libraryName} does not have an iOS implementation. Searched in ${packageIosPath_ios} and ${packageIosPath_apple}.`
    );
  }

  // Find *.podspec file in the package directory
  const podspecFiles = readdirSync(packagePath).filter(file => file.endsWith('.podspec'));
  if (podspecFiles.length === 0) {
    throw new Error(
      `No podspec file found for ${libraryName} in ${packagePath}`
    );
  }
  const iosProjectName = podspecFiles[0].replace('.podspec', ''); 

  try {
    // Install pods with repo update
    console.log('📦 Installing CocoaPods dependencies...');
     await $`pod install --repo-update`.cwd(projectIosPath).quiet();

    const sdkAndArch: { sdk: 'iphoneos' | 'iphonesimulator'; arch: ('arm64' | 'x86_64')[] }[] = [
      { sdk: 'iphoneos', arch: ['arm64'] },
      { sdk: 'iphonesimulator', arch: ['arm64', 'x86_64'] },
    ]

    const frameworks: string[] = []
    for (const { sdk, arch } of sdkAndArch) {
      console.log(`🔨 Building for ${sdk} (${arch})...`);
      await buildForPlatform(
        projectIosPath,
        iosProjectName,
        sdk,
        arch,
      );
      const archiveFileLib = join(
        workDir,
        `${getArchiveName(iosProjectName, sdk, arch)}/Products/usr/local/lib`,
        `lib${iosProjectName}.a`
      );
      if (!existsSync(archiveFileLib)) {
        throw new Error(`Archive file not found at ${archiveFileLib}`);
      }
      frameworks.push(archiveFileLib);
    }

    console.log("Create Header Directory");
    const headersDir = join(workDir, 'headers_dir');
    mkdirSync(headersDir, { recursive: true });
    await $`cp -r ${relative(workDir, packageIosPath)}/* ${relative(workDir, headersDir)}`.cwd(workDir);
    await $`find ${relative(workDir, headersDir)} -type f ! -name "*.h" -delete`.cwd(workDir);

    // Create XCFramework from all builds
    console.log('📦 Creating XCFramework with all architectures...');
    const xcframeworkFileName = getArtifactName(
      iosProjectName,
      libraryVersion,
      reactNativeVersion,
      workletsVersion
    );
    const xcframeworkPath = join(workDir, xcframeworkFileName);
    const headerArgs = existsSync(headersDir) ? ['-headers', relative(workDir, headersDir)] : [];
    const libraryArgs = frameworks.flatMap(fw => ['-library', `./${relative(workDir, fw)}`, ...headerArgs]);
    await $`xcodebuild -create-xcframework ${libraryArgs} -output ${xcframeworkFileName}`.cwd(workDir);

    if (!existsSync(xcframeworkPath)) {
      throw new Error(`Failed to create XCFramework at ${xcframeworkPath}`);
    }
    console.log('✓ Created XCFramework successfully');

    // Write metadata file
    const metadataPath = join(xcframeworkPath, `${xcframeworkFileName}.json`);
    const metadata = {
      name: libraryName,
      schema: iosProjectName,
      version: libraryVersion,
      reactNativeVersion,
      workletsVersion: workletsVersion || null,
      license,
      licenseUrl: `https://opensource.org/license/${license}`,
      buildUrl: GITHUB_BUILD_URL,
      cpuInfo: getCpuInfo(),
      buildDate: new Date().toISOString(),
    };
    const fs = await import('fs');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    console.log('✓ Published XCFramework metadata');
  } catch (error) {
    console.error(`❌ Build failed:`, error);
    throw error;
  }
}

async function buildForPlatform(
  iosPath: string,
  scheme: string,
  sdk: 'iphoneos' | 'iphonesimulator',
  arch: string[],
) {
  const workspaceFileName = 'rnrepo_build_app.xcworkspace'
  const workspaceFile = join(iosPath, workspaceFileName);
  if (!existsSync(workspaceFile)) {
    throw new Error(`Xcode project not found at ${workspaceFile}`);
  }

  try {
    await $`xcodebuild archive \
      -workspace ${workspaceFileName} \
      -scheme ${scheme} \
      -sdk ${sdk} \
      ${ arch.flatMap(a => ['-arch', a]) } \
      -archivePath "${resolve(workDir)}/${getArchiveName(scheme, sdk, arch)}" \
      -configuration Release \
      BUILD_LIBRARY_FOR_DISTRIBUTION=YES \
      SKIP_INSTALL=NO
      STRIP_STYLE=all \
      COPY_PHASE_STRIP=YES \
      DEBUG_INFORMATION_FORMAT=dwarf-with-dsym \
      STRIP_INSTALLED_PRODUCT=YES \
      DEPLOYMENT_POSTPROCESSING=YES \
      GCC_GENERATE_DEBUGGING_SYMBOLS=NO \
      ENABLE_BITCODE=NO`.cwd(iosPath);
      
  } catch (error) {
    throw new Error(`Failed to build for ${sdk}/${arch}: ${error}`);
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
    `🔨 Building XCFramework for ${libraryName}@${libraryVersion} with RN ${reactNativeVersion}...`
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
    await installSetup(appDir, "preInstall");

    // Install the library
    console.log(`📦 Installing ${libraryName}@${libraryVersion}...`);
    await $`npm install ${libraryName}@${libraryVersion} --save-exact`.quiet();

    // Extract license name from the library's package.json
    const license = extractAndVerifyLicense(appDir);

    // Perform any library-specific setup after installing
    await installSetup(appDir, "postInstall");

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

    // Build XCFramework
    console.log('🔨 Building XCFramework...');
    await buildXCFramework(appDir, license);

    console.log(
      `✅ Successfully built XCFramework for ${libraryName}@${libraryVersion} with RN ${reactNativeVersion}`
    );
  } catch (error) {
    console.error(
      `❌ Error building XCFramework for ${libraryName}@${libraryVersion}:`,
      error
    );
    throw error;
  }
}
