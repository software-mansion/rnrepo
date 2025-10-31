import libraries from '../libraries.json';
import reactNativeVersions from '../react-native-versions.json';
import type { LibraryConfig, Platform } from './types';
import {
  matchesVersionPattern,
  findMatchingVersionsFromNPM,
  type NpmVersionInfo,
} from './npm';
import { isCombinationOnMaven } from './maven';
import {
  dispatchWorkflow,
  getWorkflowFile,
  hasRecentWorkflowRun,
} from './github';

function getVersionMatcherForPlatform(
  libraryName: string,
  config: LibraryConfig,
  platform: Platform
): string | string[] | undefined {
  const platformConfig = config[platform];

  if (platformConfig === false) {
    // Platform is disabled
    return undefined;
  }

  if (
    typeof platformConfig === 'object' &&
    platformConfig.versionMatcher !== undefined
  ) {
    // Platform-specific override
    return platformConfig.versionMatcher;
  }

  // Fall back to library-level versionMatcher
  return config.versionMatcher;
}

function getReactNativeMatcherForPlatform(
  config: LibraryConfig,
  platform: Platform
): string | string[] | undefined {
  const platformConfig = config[platform];
  if (platformConfig === false) return undefined;
  if (
    typeof platformConfig === 'object' &&
    platformConfig.reactNativeVersion !== undefined
  ) {
    return platformConfig.reactNativeVersion;
  }
  return config.reactNativeVersion;
}

function getPublishedAfterDateForPlatform(
  config: LibraryConfig,
  platform: Platform
): string | undefined {
  const platformConfig = config[platform];
  if (platformConfig === false) return undefined;
  if (
    typeof platformConfig === 'object' &&
    platformConfig.publishedAfterDate !== undefined
  ) {
    // Platform-specific override
    return platformConfig.publishedAfterDate;
  }
  // Fall back to library-level publishedAfterDate
  return config.publishedAfterDate;
}

async function processLibrary(libraryName: string, config: LibraryConfig) {
  console.log(`\n📦 Processing: ${libraryName}`);

  const platforms: Platform[] = ['android', 'ios'];
  const rnVersions = reactNativeVersions as string[];
  let scheduledCount = 0;

  for (const platform of platforms) {
    // Skip disabled platforms
    if (config[platform] === false) continue;

    // Resolve package version matcher for this platform
    const pkgMatcher = getVersionMatcherForPlatform(
      libraryName,
      config,
      platform
    );
    if (!pkgMatcher) continue;

    // Resolve React Native version matcher for this platform
    const reactNativeMatcher = getReactNativeMatcherForPlatform(
      config,
      platform
    );
    if (!reactNativeMatcher) continue;

    // Resolve publishedAfterDate for this platform
    const publishedAfterDate = getPublishedAfterDateForPlatform(
      config,
      platform
    );

    // Find matching NPM package versions
    const matchingVersions = await findMatchingVersionsFromNPM(
      libraryName,
      pkgMatcher,
      publishedAfterDate
    );

    // Enumerate all combinations of package version and RN version
    for (const pkgVersionInfo of matchingVersions) {
      const pkgVersion = pkgVersionInfo.version;

      for (const rnVersion of rnVersions) {
        // Skip if RN version doesn't match the pattern
        if (!matchesVersionPattern(rnVersion, reactNativeMatcher)) {
          continue;
        }

        // Check if this combination is already on Maven
        const isOnMaven = await isCombinationOnMaven(
          libraryName,
          pkgVersion,
          rnVersion
        );
        if (isOnMaven) {
          continue; // Skip this combination
        }

        // Try to schedule this combination
        const scheduled = await scheduleLibraryBuild(
          libraryName,
          pkgVersion,
          platform,
          rnVersion
        );

        if (scheduled) {
          scheduledCount++;
        }
      }
    }
  }

  if (scheduledCount === 0) {
    console.log(' ℹ️  No builds to schedule for', libraryName);
  }
}

async function scheduleLibraryBuild(
  npmPackageName: string,
  npmPackageVersion: string,
  platform: Platform,
  reactNativeVersion: string
): Promise<boolean> {
  const platformPrefix = platform === 'android' ? ' 🤖 Android:' : ' 🍎 iOS:';

  // Check if this exact combination was already scheduled in the past 3 days
  const hasRecentRun = await hasRecentWorkflowRun(
    npmPackageName,
    npmPackageVersion,
    reactNativeVersion,
    platform,
    3
  );

  if (hasRecentRun) {
    console.log(
      platformPrefix,
      '⏭️  Skipping',
      npmPackageName,
      npmPackageVersion,
      'with React Native',
      reactNativeVersion,
      '- already scheduled in the past 3 days'
    );
    return false;
  }

  console.log(
    platformPrefix,
    'Scheduling build for',
    npmPackageName,
    npmPackageVersion,
    'with React Native',
    reactNativeVersion
  );

  // Dispatch a workflow with inputs (no platform parameter needed - workflow file is platform-specific)
  try {
    await dispatchWorkflow(getWorkflowFile(platform), {
      library_name: npmPackageName,
      library_version: npmPackageVersion,
      react_native_version: reactNativeVersion,
    });
    console.log(`  ✅ Workflow dispatched successfully`);
    return true;
  } catch (error) {
    console.error(`  ❌ Failed to dispatch workflow:`, error);
    throw error;
  }
}

async function main() {
  const librariesConfig = libraries as Record<string, LibraryConfig>;

  for (const [libraryName, config] of Object.entries(librariesConfig)) {
    await processLibrary(libraryName, config);
  }

  console.log('\n✅ Done!');
}

main().catch(console.error);
