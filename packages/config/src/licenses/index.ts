import { readFileSync } from 'fs';
import { join } from 'path';

export const ALLOWED_LICENSES = ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'BSD-2-Clause'] as const;

export type AllowedLicense = (typeof ALLOWED_LICENSES)[number];

/**
 * Extract and verify license from package.json
 * @param appDir - Directory containing node_modules with the library
 * @param libraryName - Name of the library to check
 * @returns The verified license
 * @throws Error if license is not in the allowed list
 */
export function extractAndVerifyLicense(
  appDir: string,
  libraryName: string
): AllowedLicense {
  const packageJsonPath = join(appDir, 'node_modules', libraryName, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  const licenseName = packageJson.license;

  if (!ALLOWED_LICENSES.includes(licenseName as AllowedLicense)) {
    throw new Error(
      `License ${licenseName} is not allowed. Allowed licenses are: ${ALLOWED_LICENSES.join(', ')}`
    );
  }
  return licenseName as AllowedLicense;
}
