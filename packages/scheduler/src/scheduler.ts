import libraries from '../libraries.json';
import reactNativeVersions from '../react-native-versions.json';
import type { LibraryConfig, Platform } from './types';
import {
  matchesVersionPattern,
  findOldestMatchingVersionNotOnMaven,
} from './npm';
import { dispatchWorkflow, getWorkflowFile } from './github';

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

    // Find oldest package version that is not on Maven
    const oldest = await findOldestMatchingVersionNotOnMaven(
      libraryName,
      pkgMatcher
    );
    if (!oldest) continue;

    // schedule the library build for all supported React Native versions
    for (const rnVersion of rnVersions) {
      if (matchesVersionPattern(rnVersion, reactNativeMatcher)) {
        await scheduleLibraryBuild(
          libraryName,
          oldest.version,
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

async function scheduleLibraryBuild(
  npmPackageName: string,
  npmPackageVersion: string,
  platform: Platform,
  reactNativeVersion: string
) {
  const platformPrefix = platform === 'android' ? ' 🤖 Android:' : ' 🍎 iOS:';
  console.log(
    platformPrefix,
    'Scheduling build for',
    npmPackageName,
    npmPackageVersion,
    'with React Native',
    reactNativeVersion
  );

  // Example: Dispatch a workflow with inputs
  // try {
  //   await dispatchWorkflow(getWorkflowFile(), {
  //     package_name: npmPackageName,
  //     package_version: npmPackageVersion,
  //     platform,
  //     react_native_version: reactNativeVersion,
  //   });
  //   console.log(`  ✅ Workflow dispatched successfully`);
  // } catch (error) {
  //   console.error(`  ❌ Failed to dispatch workflow:`, error);
  //   throw error;
  // }
}

async function main() {
  const librariesConfig = libraries as Record<string, LibraryConfig>;

  for (const [libraryName, config] of Object.entries(librariesConfig)) {
    await processLibrary(libraryName, config);
  }

  console.log('\n✅ Done!');
}

main().catch(console.error);
