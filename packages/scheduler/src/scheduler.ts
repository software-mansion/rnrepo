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
  rnVersionsOverride?: string[],
  limit?: number,
  currentCount: number = 0
): Promise<number> {
  console.log(`\n📦 Processing: ${libraryName}`);

  const platforms: Platform[] = ['android', 'ios'];
  const rnVersions = (rnVersionsOverride ?? reactNativeVersions) as string[];
  let scheduledCount = currentCount;

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
          5
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
            '- already scheduled in the past 5 days'
          );
          continue;
        }

        if (limit !== undefined && scheduledCount >= limit) {
          console.log(`\n⏸️  Reached scheduling limit of ${limit}. Stopping.`);
          return scheduledCount;
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

  if (scheduledCount === currentCount) {
    console.log(' ℹ️  No builds to schedule for', libraryName);
  }

  return scheduledCount;
}

export async function runScheduler(limit?: number) {
  const librariesConfig = libraries as Record<string, LibraryConfig>;
  let totalScheduled = 0;

  if (limit !== undefined) {
    console.log(`\n📊 Scheduling limit set to: ${limit}`);
  }

  for (const [libraryName, config] of Object.entries(librariesConfig)) {
    const count = await processLibrary(
      libraryName,
      config,
      undefined,
      limit,
      totalScheduled
    );
    totalScheduled = count;

    if (limit !== undefined && totalScheduled >= limit) {
      break;
    }
  }

  console.log(`\n✅ Done! Scheduled ${totalScheduled} build(s).`);
}
