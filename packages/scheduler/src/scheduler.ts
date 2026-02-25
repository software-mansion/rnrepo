import {
  libraries,
  reactNativeVersions,
  type LibraryConfig,
  type PlatformConfigOptions,
} from '@rnrepo/config';
import type { Platform } from '@rnrepo/database';
import { matchesVersionPattern, findMatchingVersionsFromNPM } from './npm';
import { scheduleLibraryBuild } from './github';
import { isBuildAlreadyScheduled, createBuildRecord } from '@rnrepo/database';

const DEFAULT_LAST_WEEK_DOWNLOADS_THRESHOLD = 10000;

export async function processLibrary(
  libraryName: string,
  config: LibraryConfig,
  limit?: number,
  currentCount: number = 0
): Promise<number> {
  console.log(`\n📦 Processing: ${libraryName}`);

  const platforms: Platform[] = ['android', 'ios'];
  const rnVersions = reactNativeVersions as string[];
  let scheduledCount = currentCount;

  for (const platform of platforms) {
    if (config[platform] === false) continue;
    // Add empty config to run from global versions
    const configPlatformList = Array.isArray(config[platform])
      ? (config[platform] as PlatformConfigOptions[])
      : [{}];

    for (const configEntry of configPlatformList) {
      const pkgMatcher = configEntry.versionMatcher ?? config.versionMatcher;
      if (!pkgMatcher) continue;
      const reactNativeMatcher =
        configEntry.reactNativeVersion ?? config.reactNativeVersion;
      const publishedAfterDate =
        configEntry.publishedAfterDate ?? config.publishedAfterDate;
      const weeklyDownloadsThreshold =
        configEntry.weeklyDownloadsThreshold ?? config.weeklyDownloadsThreshold ?? DEFAULT_LAST_WEEK_DOWNLOADS_THRESHOLD;
      const workletsMatchingVersions = await findMatchingVersionsFromNPM(
        'react-native-worklets',
        configEntry.withWorkletsVersion
      );
      const matchingVersions = await findMatchingVersionsFromNPM(
        libraryName,
        pkgMatcher,
        {
          publishedAfterDate,
          weeklyDownloadsThreshold,
        }
      );
      // If reactNativeMatcher is not set, accept any version
      const reactNativeMatchingVersions = await findMatchingVersionsFromNPM(
        'react-native',
        reactNativeMatcher ?? '*',
        {
          weeklyDownloadsThreshold: DEFAULT_LAST_WEEK_DOWNLOADS_THRESHOLD
        }
      ).then(versions => versions.map(v => v.version));

      for (const pkgVersionInfo of matchingVersions) {
        const pkgVersion = pkgVersionInfo.version;

        for (const rnVersion of rnVersions) {
          if (!matchesVersionPattern(rnVersion, reactNativeMatchingVersions)) {
            console.log(`   ❌ Skipping RN ${rnVersion} - does not match reactNativeVersion criteria`);
            continue;
          }

          for (const workletsVersionInfo of workletsMatchingVersions.length > 0
            ? workletsMatchingVersions
            : [null]) {
            const workletsVersion = workletsVersionInfo?.version;
            const alreadyScheduled = await isBuildAlreadyScheduled(
              libraryName,
              pkgVersion,
              rnVersion,
              platform,
              workletsVersion
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
                workletsVersion
                  ? 'and worklets version: ' + workletsVersion
                  : '',
                '- already scheduled or completed'
              );
              continue;
            }

            if (limit !== undefined && scheduledCount >= limit) {
              console.log(
                `\n⏸️  Reached scheduling limit of ${limit}. Stopping.`
              );
              return scheduledCount;
            }

            // Schedule the build
            try {
              await scheduleLibraryBuild(
                libraryName,
                pkgVersion,
                platform,
                rnVersion,
                workletsVersion,
                'main'
              );
            } catch (error) {
              console.error(
                `Failed to schedule build for ${libraryName}@${pkgVersion} (${platform}, RN ${rnVersion}${
                  workletsVersion ? ', worklets ' + workletsVersion : ''
                }):`,
                error
              );
              return Promise.reject(error);
            }

            // Create build record in Supabase (without run URL - will be updated later)
            try {
              await createBuildRecord(
                libraryName,
                pkgVersion,
                rnVersion,
                platform,
                undefined,
                workletsVersion
              );
            } catch (error) {
              console.error(
                `Failed to create build record for ${libraryName}@${pkgVersion} (${platform}, RN ${rnVersion}${
                  workletsVersion ? ', worklets ' + workletsVersion : ''
                }):`,
                error
              );
              // Continue anyway - the record might have been created by another process
            }

            scheduledCount++;
          }
        }
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
