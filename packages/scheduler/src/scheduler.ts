import libraries from '../libraries.json';
import reactNativeVersions from '../react-native-versions.json';
import type { LibraryConfig, Platform } from './types';
import {
  matchesVersionPattern,
  findMatchingVersionsFromNPM,
  type NpmVersionInfo,
} from './npm';
import { isCombinationOnMaven } from './maven';
import { scheduleLibraryBuild, hasRecentWorkflowRun } from './github';

function getVersionMatcherForPlatform(
  libraryName: string,
  config: LibraryConfig,
  platform: Platform
): string | string[] | undefined {
  const platformConfig = config[platform];

  if (platformConfig === false) {
    return undefined;
  }

  if (
    typeof platformConfig === 'object' &&
    platformConfig.versionMatcher !== undefined
  ) {
    return platformConfig.versionMatcher;
  }

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
    return platformConfig.publishedAfterDate;
  }
  return config.publishedAfterDate;
}

export async function processLibrary(
  libraryName: string,
  config: LibraryConfig,
  rnVersionsOverride?: string[]
) {
  console.log(`\n📦 Processing: ${libraryName}`);

  const platforms: Platform[] = ['android', 'ios'];
  const rnVersions = (rnVersionsOverride ?? reactNativeVersions) as string[];
  let scheduledCount = 0;

  for (const platform of platforms) {
    if (config[platform] === false) continue;

    const pkgMatcher = getVersionMatcherForPlatform(
      libraryName,
      config,
      platform
    );
    if (!pkgMatcher) continue;

    const reactNativeMatcher = getReactNativeMatcherForPlatform(
      config,
      platform
    );
    if (!reactNativeMatcher) continue;

    const publishedAfterDate = getPublishedAfterDateForPlatform(
      config,
      platform
    );

    const matchingVersions = await findMatchingVersionsFromNPM(
      libraryName,
      pkgMatcher,
      publishedAfterDate
    );

    for (const pkgVersionInfo of matchingVersions) {
      const pkgVersion = pkgVersionInfo.version;

      for (const rnVersion of rnVersions) {
        if (!matchesVersionPattern(rnVersion, reactNativeMatcher)) {
          continue;
        }

        const isOnMaven = await isCombinationOnMaven(
          libraryName,
          pkgVersion,
          rnVersion
        );
        if (isOnMaven) {
          continue;
        }

        const hasRecentRun = await hasRecentWorkflowRun(
          libraryName,
          pkgVersion,
          rnVersion,
          platform,
          3
        );
        if (hasRecentRun) {
          const platformPrefix =
            platform === 'android' ? ' 🤖 Android:' : ' 🍎 iOS:';
          console.log(
            platformPrefix,
            '⏭️  Skipping',
            libraryName,
            pkgVersion,
            'with React Native',
            rnVersion,
            '- already scheduled in the past 3 days'
          );
          continue;
        }

        await scheduleLibraryBuild(
          libraryName,
          pkgVersion,
          platform,
          rnVersion
        );
        scheduledCount++;
      }
    }
  }

  if (scheduledCount === 0) {
    console.log(' ℹ️  No builds to schedule for', libraryName);
  }
}

export async function runScheduler() {
  const librariesConfig = libraries as Record<string, LibraryConfig>;

  for (const [libraryName, config] of Object.entries(librariesConfig)) {
    await processLibrary(libraryName, config);
  }

  console.log('\n✅ Done!');
}
