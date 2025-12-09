import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { $ } from 'bun';
import { get } from 'http';

/**
 * Library Checker Script
 *
 * This script verifies if a library can be built by checking for compile-time
 * structural requirements like:
 * - Presence of native code
 * - Compatibility with New Architecture
 * - Custom gradle plugins
 * - Custom scripts
 * - C++ code
 * - externalNativeBuild settings
 * - Dependencies on other libraries
 *
 * @param libraryName - Name of the library to check
 * @param libraryVersion - Version of the library to check
 * @param workDir - Path to the directory where the library will be checked (optional, defaults to current directory)
 */

const [libraryName, libraryVersion, workDirArg] = process.argv.slice(2);

if (!libraryName || !libraryVersion) {
  console.error(
    'Usage: bun run check-library <library-name> <library-version> (<work-dir>)'
  );
  process.exit(1);
}
const workDir = workDirArg || "TEMPORARY_LIBRARY_CHECKER_DIR";

interface CheckResult {
  hasNativeCode: boolean;
  hasAndroidImplementation: boolean;
  hasIOSImplementation: boolean;
  hasCustomGradlePlugins: boolean;
  hasCustomScripts: boolean;
  hasCppCode: boolean;
  hasExternalNativeBuild: boolean;
  nativeDependencies: string[];
  newArchitectureSupport: boolean;
  issues: string[];
  warnings: string[];
}

async function createTemporaryApp(workDir: string): Promise<void> {
  if (existsSync(workDir)) {
    console.error(`Directory ${workDir} already exists. Please provide an empty or non-existing directory.`);
    process.exit(1);
  }
  await $`mkdir -p ${workDir}`;
  await $`bun init -y`.quiet().cwd(workDir);
  console.log(`Created temporary working directory at ${workDir}.`);
}

async function installPackage(libraryName: string, libraryVersion: string, workDir: string): Promise<string> {
  console.log(`Installing package ${libraryName}@${libraryVersion} in ${workDir}...`);
  await $`npm install ${libraryName}@${libraryVersion} --save-exact`.quiet().cwd(workDir);
  console.log(`Package ${libraryName}@${libraryVersion} installed.`);
  return join(workDir, 'node_modules', libraryName);
}

function printList(title: string, items: string[]): void {
  if (items.length > 0) {
    console.log(`\n${title} (${items.length}):`);
    items.forEach((item) => {
      console.log(`  • ${item}`);
    });
  }
}

function printResults(result: CheckResult): void {
  console.log(`
📚 Library Buildability Check: ${libraryName}@${libraryVersion}
Package Path: ${workDir}
═══════════════════════════════════════════════════
📋 Structural Analysis:
  - ${result.hasAndroidImplementation ? '✓' : '✗'} Android Implementation
  - ${result.hasIOSImplementation ? '✓' : '✗'} iOS Implementation
  - ${result.hasNativeCode ? '✓' : '✗'} Native Code Detected
  - ${result.hasCppCode ? '✓' : '✗'} C++ Code Detected
  - ${result.hasCustomGradlePlugins ? '✓' : '✗'} Custom Gradle Plugins
  - ${result.hasCustomScripts ? '✓' : '✗'} Custom Scripts
  - ${result.hasExternalNativeBuild ? '✓' : '✗'} External Native Build (Android)
  - ${result.newArchitectureSupport ? '✓' : '✗'} New Architecture Support`);
  printList('🔗 Native Dependencies', result.nativeDependencies);
  printList('❌ Issues', result.issues);
  printList('⚠️  Warnings', result.warnings);
}

function checkPlatformImplementation(platformPath: string, result: CheckResult, platform: 'android' | 'ios'): void {
  if (existsSync(platformPath)) {
    if (platform === 'android') {
      result.hasAndroidImplementation = true;
    } else if (platform === 'ios') {
      result.hasIOSImplementation = true;
    }
    result.hasNativeCode = true;
  } else {
    result.issues.push(`No ${platform} implementation found`);
  }
}

function checkGradlePlugins(gradleFilePath: string, result: CheckResult): void {
  if (existsSync(gradleFilePath)) {
    try {
      const content = readFileSync(gradleFilePath, 'utf-8');
      const knownPlugins = [
        'com.android.library',
        'com.android.application',
        'org.jetbrains.kotlin.android',
        'com.facebook.react',
        'maven-publish',
        'de.undercouch.download'
      ];

      if (content.includes('plugins {')) {
        const pluginLines = content
          .split('\n')
          .filter((line) => line.includes('id '));
        for (const line of pluginLines) {
          if (
            !knownPlugins.some((plugin) =>
              line.includes(plugin)
            )
          ) {
            result.hasCustomGradlePlugins = true;
            result.warnings.push(
              `Custom gradle plugin detected: ${line.trim()}`
            );
          }
        }
      }

      if (content.includes('apply plugin:')) {
        const lines = content.split('\n');
        for (const line of lines) {
          if (line.includes('apply plugin:')) {
            const pluginName = line.split('apply plugin:')[1].trim().replace(/['"]/g, '');
            if (!knownPlugins.includes(pluginName)) {
              result.hasCustomGradlePlugins = true;
              result.warnings.push(
                `Custom gradle plugin detected: ${pluginName}`
              );
            }
          }
        }
      }
      
    } catch (error) {
      result.warnings.push(`Could not read ${gradleFilePath}`);
    }
  }
}

function checkExternalNativeBuild(gradleFilePath: string, result: CheckResult): void {
  if (existsSync(gradleFilePath)) {
    try {
      const content = readFileSync(gradleFilePath, 'utf-8');
      if (content.includes('externalNativeBuild')) {
        result.hasExternalNativeBuild = true;
      }
    } catch (error) {
      result.warnings.push(`Could not read ${gradleFilePath}`);
    }
  }
}

function getBuildGradleFile(packageDir: string): string {
  const buildGradlePath = join(packageDir, 'android', 'build.gradle');
  const buildGradleKtsPath = join(packageDir, 'android', 'build.gradle.kts');

  if (existsSync(buildGradlePath)) {
    return buildGradlePath;
  } else if (existsSync(buildGradleKtsPath)) {
    return buildGradleKtsPath;
  } else {
    throw new Error(`No build.gradle or build.gradle.kts file found in ${join(packageDir, 'android')} directory`);
  }
}

function checkCppCode(androidPath: string, result: CheckResult): void {
  if (existsSync(androidPath)) {
    const cppFiles = [
      'CMakeLists.txt',
      'Android.mk',
      'Android.bp',
    ];

    for (const cppFile of cppFiles) {
      const cppPath = join(androidPath, cppFile);
      if (existsSync(cppPath)) {
        result.hasCppCode = true;
        result.warnings.push(`C++ code detected (${cppFile})`);
      }
    }

    // Recursively check for .cpp, .cc, .c, .h, .hpp files
    const checkForCppFilesRecursive = (dir: string): boolean => {
      try {
        const files = require('fs').readdirSync(dir, { withFileTypes: true });
        for (const file of files) {
          if (
            file.name.endsWith('.cpp') ||
            file.name.endsWith('.cc') ||
            file.name.endsWith('.c') ||
            file.name.endsWith('.h') ||
            file.name.endsWith('.hpp')
          ) {
            return true;
          }
          if (file.isDirectory() && !file.name.startsWith('.')) {
            if (checkForCppFilesRecursive(join(dir, file.name))) {
              return true;
            }
          }
        }
      } catch (_error) {}
      return false;
    };

    if (checkForCppFilesRecursive(androidPath)) {
      result.hasCppCode = true;
    }
  }
}

function checkPackageJsonDependencies(packageDir: string, result: CheckResult): void {
  const packageJsonPath = join(packageDir, 'package.json');
  if (existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
     
      // Check for native dependencies
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.peerDependencies,
        ...packageJson.devDependencies,
      };

      const nativeDependencyKeywords = [
        'react-native',
        'native',
        'native-modules',
        'jni',
        'ndk',
      ];

      for (const dep of Object.keys(allDeps || {})) {
        if (nativeDependencyKeywords.some((keyword) =>
          dep.toLowerCase().includes(keyword)
        )) {
          result.nativeDependencies.push(dep);
        }
      }

    } catch (error) {
      result.warnings.push('Could not parse package.json');
    }
  }
}

function getIosPath(packageDir: string): string {
  if (existsSync(join(packageDir, 'apple'))) {
    return join(packageDir, 'apple');
  }
  return join(packageDir, 'ios');
}
function checkBuildGradleDependencies(buildGradleFile: string, result: CheckResult): void {
  console.log(`Checking build.gradle dependencies in ${buildGradleFile}...`);
  if (existsSync(buildGradleFile)) {
    try {
      const content = readFileSync(buildGradleFile, 'utf-8');
      const dependencyLines = content
        .split('\n')
        .filter((line) => line.includes('implementation') || line.includes('api') || line.includes('compileOnly'));
      for (const line of dependencyLines) {
        const dependencyMatch = line.match(/['"]([^'"]+)['"]/);
        if (dependencyMatch) {
          const dependency = dependencyMatch[1];
          result.nativeDependencies.push(dependency);
        }
      }
    } catch (error) {
      result.warnings.push(`Could not read ${buildGradleFile}`);
    }
  }
}

function checkAndroidNewArchitectureSupport(buildGradleFile: string, result: CheckResult): void {
  if (existsSync(buildGradleFile)) {
    try {
      const content = readFileSync(buildGradleFile, 'utf-8');
      if (content.includes('com.facebook.react')) {
        result.newArchitectureSupport = true;
      }
    } catch (error) {
      result.warnings.push(`Could not read ${buildGradleFile}`);
    }
  }
}

async function checkLibrary(): Promise<void> {
  await createTemporaryApp(workDir);
  const packageDir = await installPackage(libraryName, libraryVersion, workDir);

  const result: CheckResult = {
    hasNativeCode: false,
    hasAndroidImplementation: false,
    hasIOSImplementation: false,
    hasCustomGradlePlugins: false,
    hasCustomScripts: false,
    hasCppCode: false,
    hasExternalNativeBuild: false,
    nativeDependencies: [],
    newArchitectureSupport: false,
    issues: [],
    warnings: [],
  };

  try {
    checkPlatformImplementation(join(packageDir, 'android'), result, 'android');
    const iosPath = getIosPath(packageDir);
    checkPlatformImplementation(iosPath, result, 'ios');
    const buildGradleFile = getBuildGradleFile(packageDir);
    checkGradlePlugins(buildGradleFile, result);
    checkExternalNativeBuild(buildGradleFile, result);
    checkCppCode(join(packageDir, 'android'), result);
    checkPackageJsonDependencies(packageDir, result);
    checkBuildGradleDependencies(buildGradleFile, result);
    checkAndroidNewArchitectureSupport(buildGradleFile, result);
    // Final evaluation
    printResults(result);

  } catch (error) {
    console.error(`\n❌ Check failed: ${error}\n`);
    process.exit(1);
  }
}

// Run the check
await checkLibrary();
