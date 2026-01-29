#!/usr/bin/env bun

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Verify that the built JAR file version matches the version in build.gradle and package.json
 */

/**
 * Extract version from build.gradle file
 */
function extractVersionFromBuildGradle(buildGradlePath: string): string {
  try {
    const buildGradleContent = readFileSync(buildGradlePath, 'utf-8');
    const versionMatch = buildGradleContent.match(/baseVersion\s*=\s*["']([^"']+)["']/);

    if (!versionMatch || !versionMatch[1]) {
      throw new Error('Version pattern not found in build.gradle');
    }

    return versionMatch[1];
  } catch (error) {
    console.error(`❌ Could not extract version from build.gradle: ${error}`);
    process.exit(1);
  }
}

/**
 * Extract version from package.json files array
 * Expected format: gradle-plugin/build/libs/prebuilds-plugin-{version}.jar
 */
function extractVersionFromPackageJson(packageJsonPath: string): string {
  try {
    const packageJsonContent = readFileSync(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageJsonContent);

    const filesArray = packageJson.files || [];
    const jarEntry = filesArray.find(
      (file: string) => typeof file === 'string' && file.includes('prebuilds-plugin-')
    );

    if (!jarEntry) {
      throw new Error('No JAR entry found in files array');
    }

    const versionMatch = jarEntry.match(/prebuilds-plugin-(.+?)\.(jar|\*)/);

    if (!versionMatch || !versionMatch[1]) {
      throw new Error('Could not extract version from JAR entry');
    }

    return versionMatch[1];
  } catch (error) {
    console.error(`❌ Could not extract version from package.json: ${error}`);
    process.exit(1);
  }
}

/**
 * Find JAR files in the build libs directory
 */
function findJarFile(libsDir: string): string {
  try {
    const jarFiles = readdirSync(libsDir).filter((file) => file.endsWith('.jar'));

    if (jarFiles.length != 1) {
      throw new Error(`Expected exactly one JAR file in libs directory, found ${jarFiles.length}`);
    }

    return jarFiles[0];
  } catch (error) {
    console.error(`❌ Could not read libs directory (${libsDir}): ${error}`);
    process.exit(1);
  }
}

/**
 * Extract version from JAR filename
 * Expected format: prebuilds-plugin-{version}.jar
 */
function extractVersionFromJar(jarFilename: string): string {
  const jarVersionMatch = jarFilename.match(/prebuilds-plugin-(.+?)\.jar/);

  if (!jarVersionMatch || !jarVersionMatch[1]) {
    console.error(`❌ Could not extract version from JAR filename: ${jarFilename}`);
    process.exit(1);
  }

  return jarVersionMatch[1];
}

/**
 * Compare versions and verify they all match
 */
function compareVersions(
  buildGradleVersion: string,
  packageJsonVersion: string,
  jarVersion: string
): boolean {
  const allMatch =
    buildGradleVersion === packageJsonVersion &&
    packageJsonVersion === jarVersion;

  if (allMatch) {
    console.log(`✅ Version verification passed: ${buildGradleVersion}`);
    return true;
  } else {
    console.error(`❌ Version mismatch detected!`);
    console.error(`   - build.gradle version: ${buildGradleVersion}`);
    console.error(`   - package.json version: ${packageJsonVersion}`);
    console.error(`   - JAR file version: ${jarVersion}`);
    return false;
  }
}

/**
 * Main verification function
 */
function main(): void {
  const prebuildsPluginDir = join(
    __dirname,
    '..',
    '..',
    '..',
    'packages',
    'prebuilds-plugin'
  );
  const gradlePluginDir = join(prebuildsPluginDir, 'gradle-plugin');
  const buildGradlePath = join(gradlePluginDir, 'build.gradle');
  const packageJsonPath = join(prebuildsPluginDir, 'package.json');
  const libsDir = join(gradlePluginDir, 'build', 'libs');

  console.log('🔍 Starting version verification...\n');

  // Extract version from build.gradle
  const buildGradleVersion = extractVersionFromBuildGradle(buildGradlePath);
  console.log(`📋 Version from build.gradle: ${buildGradleVersion}`);

  // Extract version from package.json
  const packageJsonVersion = extractVersionFromPackageJson(packageJsonPath);
  console.log(`📄 Version from package.json: ${packageJsonVersion}`);

  // Find JAR files in the build directory
  const jarFile = findJarFile(libsDir);
  console.log(`📦 Found JAR file: ${jarFile}`);

  // Extract version from first JAR file
  const jarVersion = extractVersionFromJar(jarFile);
  console.log(`🔍 Version from JAR filename: ${jarVersion}`);

  // Compare all versions
  const isValid = compareVersions(buildGradleVersion, packageJsonVersion, jarVersion);

  process.exit(isValid ? 0 : 1);
}

// Run the verification
main();

