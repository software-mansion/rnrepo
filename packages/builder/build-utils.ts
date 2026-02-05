import { $ } from 'bun';
import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { arch, cpus, platform } from 'node:os';
import { join } from 'path';

/**
 * Common utilities shared between iOS and Android build scripts
 */

export type AllowedLicense =
  | 'MIT'
  | 'Apache-2.0'
  | 'BSD-3-Clause'
  | 'BSD-3-Clause-Clear'
  | 'BSD-2-Clause';

export const ALLOWED_LICENSES: AllowedLicense[] = [
  'MIT',
  'Apache-2.0',
  'BSD-3-Clause',
  'BSD-3-Clause-Clear',
  'BSD-2-Clause',
];

/**
 * Get GitHub Actions build URL
 */
export function getGithubBuildUrl(): string {
  const GITHUB_SERVER_URL = process.env.GITHUB_SERVER_URL;
  const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;
  const GITHUB_RUN_ID = process.env.GITHUB_RUN_ID;
  return `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`;
}

/**
 * Get CPU info for metadata
 */
export function getCpuInfo(): string {
  return `${arch()}-${platform()}-${cpus().length}coresAt${cpus()[0].speed}`;
}

/**
 * Calculate MD5 hash of a file
 */
function calculateFileMd5(filePath: string): string {
  const fileContent = readFileSync(filePath);
  return createHash('md5').update(fileContent).digest('hex');
}

/**
 * Validate that license field has "SEE LICENSE IN" format when using custom license
 */
function validateLicenseFieldFormat(
  licenseField: string,
  libraryName: string
): void {
  if (!licenseField.startsWith('SEE LICENSE IN ')) {
    throw new Error(
      `License field for ${libraryName} must reference a license file with "SEE LICENSE IN <file>" to verify MD5 hash. Got: ${licenseField}`
    );
  }
}

/**
 * Validate that license file path matches between package.json and libraries.json config
 */
function validateLicenseFilePath(
  licenseField: string,
  configFilePath: string,
  libraryName: string
): void {
  const extractedPath = licenseField.replace('SEE LICENSE IN ', '');
  if (configFilePath !== extractedPath) {
    throw new Error(
      `License file path mismatch for ${libraryName}. Expected ${configFilePath}, got ${extractedPath}`
    );
  }
}

/**
 * Verify license file exists and matches expected MD5 hash
 */
function verifyLicenseFileHash(
  packageDir: string,
  licenseFilePath: string,
  expectedHash: string,
  libraryName: string
): void {
  const fullLicenseFilePath = join(packageDir, licenseFilePath);

  if (!existsSync(fullLicenseFilePath)) {
    throw new Error(
      `License file ${licenseFilePath} not found for ${libraryName}. Verify the library[license][filePath] configuration in libraries.json.`
    );
  }

  const actualHash = calculateFileMd5(fullLicenseFilePath);
  if (actualHash !== expectedHash) {
    throw new Error(
      `License file hash mismatch for ${libraryName}. Expected ${expectedHash}, got ${actualHash}`
    );
  }

  console.log(`✓ License file verified by MD5 hash for ${libraryName}`);
}

/**
 * Load and parse libraries.json license configuration for a given library
 */
function getLibraryLicenseConfig(libraryName: string): Record<string, string> | null {
  const libraryJsonPath = join(__dirname, '..', '..', 'libraries.json');
  if (!existsSync(libraryJsonPath)) {
    return null;
  }
  const libraryJson = JSON.parse(readFileSync(libraryJsonPath, 'utf-8'));
  const licenseObject = libraryJson?.[libraryName]?.license || null;
  if (!licenseObject) return null;

  if (licenseObject?.filePath && 
    licenseObject?.fileMD5 && 
    licenseObject?.type &&
    ALLOWED_LICENSES.includes(licenseObject.type as AllowedLicense)
  ) {
    return licenseObject;
  }

  throw new Error(
    `Invalid license configuration for ${libraryName} in libraries.json. Must include filePath, fileMD5, and valid type. Got: ${JSON.stringify(licenseObject)}`
  );
}

/**
 * Extract and verify the library's license
 * Checks against ALLOWED_LICENSES, or verifies MD5 hash if configured in libraries.json
 */
export function extractAndVerifyLicense(
  appDir: string,
  libraryName: string
): AllowedLicense {
  const packageDir = join(appDir, 'node_modules', libraryName);
  const packageJsonPath = join(packageDir, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  const licenseField = packageJson.license;

  // Check if license is in allowed list
  if (ALLOWED_LICENSES.includes(licenseField as AllowedLicense)) {
    return licenseField as AllowedLicense;
  }

  // Try to verify by MD5 hash if configured in libraries.json
  const licenseConfig = getLibraryLicenseConfig(libraryName);
  if (!licenseConfig) {
    throw new Error(
      `License ${licenseField} is not allowed for ${libraryName}. Allowed licenses are: ${ALLOWED_LICENSES.join(
        ', '
      )}. You can configure a custom license with MD5 hash verification in libraries.json.`
    );
  }
  validateLicenseFieldFormat(licenseField, libraryName);
  validateLicenseFilePath(
    licenseField,
    licenseConfig.filePath,
    libraryName
  );
  verifyLicenseFileHash(
    packageDir,
    licenseConfig.filePath,
    licenseConfig.fileMD5,
    libraryName
  );
  return licenseConfig.type as AllowedLicense;
}

/**
 * Verify that the installed React Native version matches expected
 */
export function checkRnVersion(appDir: string, expectedVersion: string): void {
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

/**
 * Run pre/post install scripts for a library
 * Supports .gradle (postInstall only), .ts, and .js scripts
 * Returns the Gradle script path if found (for Android builds)
 */
export async function installSetup(
  appDir: string,
  libraryName: string,
  phase: 'preInstall' | 'postInstall'
): Promise<string | undefined> {
  const libraryJsonPath = join(__dirname, '..', '..', 'libraries.json');
  const libraryJson = JSON.parse(readFileSync(libraryJsonPath, 'utf-8'));
  const scriptPath = libraryJson[libraryName]?.[phase + 'ScriptPath'] as
    | string
    | undefined;
  if (scriptPath && existsSync(join(__dirname, '..', '..', scriptPath))) {
    const fullScriptPath = join(__dirname, '..', '..', scriptPath);
    if (scriptPath.endsWith('.gradle')) {
      if (phase === 'preInstall') {
        throw new Error(
          'Gradle scripts are only supported in postInstall phase'
        );
      }
      console.log(`✓ Using postInstall Gradle script for ${libraryName}`);
      return fullScriptPath;
    } else if (scriptPath.endsWith('.ts') || scriptPath.endsWith('.js')) {
      await $`bun run ${fullScriptPath}`.cwd(appDir);
      console.log(`✓ Executed ${phase} script for ${libraryName}`);
    }
  } else {
    console.log(`ℹ️ No ${phase} script found for ${libraryName}`);
  }
  return undefined;
}

/**
 * Setup React Native project and install library with dependencies
 * Returns appDir, license, and optional gradle script path for Android
 */
export async function setupReactNativeProject(
  workDir: string,
  libraryName: string,
  libraryVersion: string,
  reactNativeVersion: string,
  workletsVersion: string | undefined
): Promise<{
  appDir: string;
  license: AllowedLicense;
  postinstallGradleScriptPath?: string;
}> {
  const appDir = join(workDir, 'rnrepo_build_app');

  // Create work directory if it doesn't exist
  const { mkdirSync } = await import('fs');
  mkdirSync(workDir, { recursive: true });

  // Check that app directory doesn't exist yet
  if (existsSync(appDir)) {
    throw new Error(`App directory ${appDir} already exists.`);
  }

  // Create RN project in the work directory
  console.log(
    `📱 Creating temporary React Native project (RN ${reactNativeVersion})...`
  );

  await $`bunx @react-native-community/cli@latest init rnrepo_build_app --version ${reactNativeVersion} --skip-install`
    .cwd(workDir)
    .quiet();

  // Perform any library-specific setup before installing
  await installSetup(appDir, libraryName, 'preInstall');

  // Install the library
  console.log(`📦 Installing ${libraryName}@${libraryVersion}...`);
  await $`npm install ${libraryName}@${libraryVersion} --save-exact`
    .cwd(appDir)
    .quiet();

  // Extract license name from the library's package.json
  const license = extractAndVerifyLicense(appDir, libraryName);

  // Perform any library-specific setup after installing
  const postinstallGradleScriptPath = await installSetup(
    appDir,
    libraryName,
    'postInstall'
  );

  // Install react-native-worklets if specified
  if (workletsVersion) {
    console.log(`📦 Installing react-native-worklets@${workletsVersion}...`);
    await $`npm install react-native-worklets@${workletsVersion} --save-exact`
      .cwd(appDir)
      .quiet();
  }

  // Install all dependencies
  console.log('📦 Installing all dependencies...');
  await $`npm install`.cwd(appDir).quiet();

  // Check if the react-native version is correctly set
  checkRnVersion(appDir, reactNativeVersion);

  return {
    appDir,
    license,
    postinstallGradleScriptPath,
  };
}
