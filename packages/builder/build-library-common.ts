import { $ } from 'bun';
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
  | 'BSD-2-Clause';

export const ALLOWED_LICENSES: AllowedLicense[] = [
  'MIT',
  'Apache-2.0',
  'BSD-3-Clause',
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
 * Extract and verify the library's license
 */
export function extractAndVerifyLicense(
  appDir: string,
  libraryName: string
): AllowedLicense {
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
 * @param platform - 'android' or 'ios'
 */
export async function installSetup(
  appDir: string,
  libraryName: string,
  phase: 'preInstall' | 'postInstall',
  platform: 'android' | 'ios'
): Promise<{ postinstallGradleScriptPath?: string }> {
  const libraryJsonPath = join(__dirname, '..', '..', 'libraries.json');
  const libraryJson = JSON.parse(readFileSync(libraryJsonPath, 'utf-8'));
  const scriptPath = libraryJson[libraryName]?.[phase + 'ScriptPath'] as
    | string
    | undefined;

  if (!scriptPath || !existsSync(join(__dirname, '..', '..', scriptPath))) {
    console.log(`ℹ️ No ${phase} script found for ${libraryName}`);
    return {};
  }

  const fullScriptPath = join(__dirname, '..', '..', scriptPath);

  // Platform-specific handling
  if (platform === 'android') {
    if (scriptPath.endsWith('.gradle')) {
      if (phase === 'preInstall') {
        throw new Error(
          'Gradle scripts are only supported in postInstall phase'
        );
      }
      console.log(`✓ Using postInstall Gradle script for ${libraryName}`);
      return { postinstallGradleScriptPath: fullScriptPath };
    } else if (scriptPath.endsWith('.ts') || scriptPath.endsWith('.js')) {
      await $`bun run ${fullScriptPath}`.cwd(appDir);
      console.log(`✓ Executed ${phase} script for ${libraryName}`);
    }
  } else if (platform === 'ios') {
    if (scriptPath.endsWith('.rb')) {
      console.log(
        `✓ Found ${phase} Ruby script for ${libraryName}, will apply during pod install`
      );
      // Ruby scripts are handled during pod install
    } else if (scriptPath.endsWith('.ts') || scriptPath.endsWith('.js')) {
      await $`bun run ${fullScriptPath}`.cwd(appDir);
      console.log(`✓ Executed ${phase} script for ${libraryName}`);
    }
  }

  return {};
}
