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
  currentCount: number = 0,
  iosLimit?: number,
  currentIosCount: number = 0
): Promise<{ total: number; ios: number }> {
  console.log(`\n📦 Processing: ${libraryName}`);

  const platforms: Platform[] = ['android', 'ios'];
  const rnVersions = reactNativeVersions as string[];
  let scheduledCount = currentCount;
  let scheduledIosCount = currentIosCount;

  for (const platform of platforms) {
    if (config[platform] === false) continue;
    
    if (platform === 'ios' && iosLimit !== undefined && scheduledIosCount >= iosLimit) {
      console.log(`   ⚠️  Skipping iOS - reached limit of ${iosLimit} iOS builds`);
      continue;
    }

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
              return { total: scheduledCount, ios: scheduledIosCount };
            }

            if (platform === 'ios' && iosLimit !== undefined && scheduledIosCount >= iosLimit) {
              console.log(
                `\n⏸️  Reached iOS scheduling limit of ${iosLimit}. Skipping iOS build.`
              );
              continue;
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
            if (platform === 'ios') {
              scheduledIosCount++;
            }
          }
        }
      }
    }
  }

  if (scheduledCount === currentCount) {
    console.log(' ℹ️  No builds to schedule for', libraryName);
  }

  return { total: scheduledCount, ios: scheduledIosCount };
}

export async function runScheduler(limit?: number) {
  const librariesConfig = libraries as Record<string, LibraryConfig>;
  let totalScheduled = 0;
  let totalIosScheduled = 0;
  const IOS_LIMIT = 50; // Max 50 iOS builds

  if (limit !== undefined) {
    console.log(`\n📊 Scheduling limit set to: ${limit}`);
  }

  for (const [libraryName, config] of Object.entries(librariesConfig)) {
    const counts = await processLibrary(
      libraryName,
      config,
      limit,
      totalScheduled,
      IOS_LIMIT,
      totalIosScheduled
    );
    totalScheduled = counts.total;
    totalIosScheduled = counts.ios;

    if (limit !== undefined && totalScheduled >= limit) {
      break;
    }
  }

  console.log(`\n✅ Done! Scheduled ${totalScheduled} build(s) (${totalIosScheduled} iOS).`);
}
