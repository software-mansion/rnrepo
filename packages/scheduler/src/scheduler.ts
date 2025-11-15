import {
  libraries,
  reactNativeVersions,
  type LibraryConfig,
  type PlatformConfigOptions,
} from '@rnrepo/config';
import type { Platform } from '@rnrepo/database';
import {
  matchesVersionPattern,
  findMatchingVersionsFromNPM,
  type NpmVersionInfo,
} from './npm';
import { scheduleLibraryBuild } from './github';
import { isBuildAlreadyScheduled, createBuildRecord } from '@rnrepo/database';

function allCombinations(stringList: Record<string, string[]>): string[][] {
  // Create all combinations of the versions
  const combinations: string[][] = [];
  const keys = Object.keys(stringList);
  const totalCombinations = keys.reduce((acc, key) => acc * stringList[key].length, 1);
  for (let i = 0; i < totalCombinations; i++) {
      const combination: string[] = [];
      let divisor = totalCombinations;
      for (const key of keys) {
          const versions = stringList[key];
          divisor /= versions.length;
          const index = Math.floor(i / divisor) % versions.length;
          combination.push(`${key}@${versions[index]}`);
      }
      combinations.push(combination);
  }
  return combinations;
}

async function getDependencyList(
  platformConfig: PlatformConfigOptions,
  dependencyType: "requiredDependency" | "additionalDependency"
): Promise<string[][]> {
  if (platformConfig[dependencyType] === undefined) {
    return [[""]];
  }
  const libraries: Record<string, string[]> = {};
  for (const { name: lib, version: versions } of platformConfig[dependencyType]) {
    const matchingVersions = await findMatchingVersionsFromNPM(lib, versions);
    libraries[lib] = matchingVersions.map(v => v.version);
  }
  let combinations = allCombinations(libraries);
  if (dependencyType == "additionalDependency") {
    combinations.push([""]);
  }
  return combinations;
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
    // Add empty config to run from global versions
    config[platform] = (config[platform] || [{}]) as PlatformConfigOptions[]; 
 
    for (const configEntry of config[platform]) {
      const pkgMatcher = configEntry.versionMatcher ?? config.reactNativeVersion;
      if (!pkgMatcher) continue;
      const reactNativeMatcher = configEntry.reactNativeVersion ?? config.reactNativeVersion;
      if (!reactNativeMatcher) continue;
      const publishedAfterDate = configEntry.publishedAfterDate ?? config.publishedAfterDate;
      const matchingVersions = await findMatchingVersionsFromNPM(
        libraryName,
        pkgMatcher,
        publishedAfterDate
      );

      const requiredDependencies = getDependencyList(
        configEntry,
        "requiredDependency"
      );
      const additionalDependencies = getDependencyList(
        configEntry,
        "additionalDependency"
      );

      for (const pkgVersionInfo of matchingVersions) {
        const pkgVersion = pkgVersionInfo.version;

        for (const rnVersion of rnVersions) {
          if (!matchesVersionPattern(rnVersion, reactNativeMatcher)) {
            continue;
          }

          for (const requiredLibraries of await requiredDependencies) {
            for (const additionalLibraries of await additionalDependencies) {
              // Combine required and additional libraries into a single array
              const allLibs = [...requiredLibraries, ...additionalLibraries].filter(lib => lib !== "");
              // sort all libraries to ensure consistent naming
              allLibs.sort();
              const extendedLibraryName = allLibs.length > 0 ? `${libraryName}-with-${allLibs.join("-with-")}` : libraryName;

              const alreadyScheduled = await isBuildAlreadyScheduled(
                extendedLibraryName,
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
                  extendedLibraryName,
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
                  rnVersion,
                  allLibs.join(","),
                  "rolkrado/building-postinstall"
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
                await createBuildRecord(extendedLibraryName, pkgVersion, rnVersion, platform);
              } catch (error) {
                console.error(
                  `Failed to create build record for ${extendedLibraryName}@${pkgVersion} (${platform}, RN ${rnVersion}):`,
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
