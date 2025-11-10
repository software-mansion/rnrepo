import libraries from '../libraries.json';
import reactNativeVersions from '../react-native-versions.json';
import type { LibraryConfig, Platform } from './types';
import {
  matchesVersionPattern,
  findMatchingVersionsFromNPM,
  type NpmVersionInfo,
} from './npm';
import { scheduleLibraryBuild } from './github';
import { isBuildAlreadyScheduled, createBuildRecord } from '@rnrepo/database';

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

        const alreadyScheduled = await isBuildAlreadyScheduled(
          libraryName,
          pkgVersion,
          rnVersion,
          platform
        );
        if (alreadyScheduled) {
          const platformPrefix =
            platform === 'android' ? ' 🤖 Android:' : ' 🍎 iOS:';
          console.log(
            platformPrefix,
            '⏭️  Skipping',
            libraryName,
            pkgVersion,
            'with React Native',
            rnVersion,
            '- already scheduled or completed'
          );
          continue;
        }

        if (limit !== undefined && scheduledCount >= limit) {
          console.log(`\n⏸️  Reached scheduling limit of ${limit}. Stopping.`);
          return scheduledCount;
        }

        // Schedule the build
        try {
          await scheduleLibraryBuild(
            libraryName,
            pkgVersion,
            platform,
            rnVersion
          );
        } catch (error) {
          console.error(
            `Failed to schedule build for ${libraryName}@${pkgVersion} (${platform}, RN ${rnVersion}):`,
            error
          );
          continue;
        }

        // Create build record in Supabase (without run URL - will be updated later)
        try {
          await createBuildRecord(libraryName, pkgVersion, rnVersion, platform);
        } catch (error) {
          console.error(
            `Failed to create build record for ${libraryName}@${pkgVersion} (${platform}, RN ${rnVersion}):`,
            error
          );
          // Continue anyway - the record might have been created by another process
        }

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
