import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

/**
 * Build flags react-native-theoplayer is prebuilt with, for both platforms.
 *
 * The two platforms read their configuration from different places, so this
 * script is the single source of truth and writes each one out:
 *
 *  - Android: `android/build.gradle` resolves every flag through
 *    `safeExtGet(prop, fallback)`, which reads `rootProject.ext`. Gradle seeds
 *    the root project's extra properties from `gradle.properties` before any
 *    build script is evaluated, which is also how the library documents these
 *    flags to its users.
 *  - iOS: there is no equivalent of the Gradle flags. `react-native-theoplayer.podspec`
 *    reads the list of extra integrations from `react-native-theoplayer.json` in the
 *    app root and only then adds the matching pods; the Swift sources gate the
 *    integration code behind `#if canImport(...)`, so an integration that is not a
 *    pod at compile time is not part of the XCFramework we publish.
 *
 * Flag mapping between the two platforms:
 *   THEOplayer_extensionGoogleIMA + THEOplayer_extensionGoogleDAI -> GOOGLE_IMA
 *     (on iOS a single pod, THEOplayer-Integration-GoogleIMA, delivers IMA and DAI)
 *   THEOplayer_extensionTHEOads                                   -> THEO_ADS
 *
 * `THEOplayer_reparent_on_PiP` and `THEOplayer_timeUpdateRate` are Android-only
 * BuildConfig fields and have no iOS counterpart.
 */
const ANDROID_FLAGS: Record<string, string> = {
  THEOplayer_reparent_on_PiP: 'true',
  THEOplayer_extensionGoogleIMA: 'true',
  THEOplayer_extensionGoogleDAI: 'true',
  THEOplayer_extensionTHEOads: 'true',
  THEOplayer_timeUpdateRate: 'com.theoplayer.TimeUpdateRate.LIMITED_TWO_HZ',
};

const IOS_FEATURES = ['GOOGLE_IMA', 'THEO_ADS'];

const BLOCK_START = '# >>> rnrepo: react-native-theoplayer build flags';
const BLOCK_END = '# <<< rnrepo: react-native-theoplayer build flags';

/**
 * Replaces the block this script wrote before, or appends a new one, so that
 * re-running against a cached build app does not pile up duplicate entries.
 */
function upsertGradleProperties(appDir: string): void {
  const propertiesPath = join(appDir, 'android', 'gradle.properties');
  const existing = existsSync(propertiesPath)
    ? readFileSync(propertiesPath, 'utf8').replace(
        new RegExp(`\\n*${BLOCK_START}[\\s\\S]*?${BLOCK_END}\\n?`),
        '\n'
      )
    : '';

  const block = [
    BLOCK_START,
    ...Object.entries(ANDROID_FLAGS).map(([key, value]) => `${key}=${value}`),
    BLOCK_END,
  ].join('\n');

  mkdirSync(dirname(propertiesPath), { recursive: true });
  writeFileSync(
    propertiesPath,
    `${existing.trimEnd()}\n\n${block}\n`,
    'utf8'
  );

  console.log(
    `✓ Wrote android/gradle.properties flags: ${Object.keys(ANDROID_FLAGS).join(', ')}`
  );
}

function upsertIosConfig(appDir: string): void {
  // The podspec resolves the config relative to the package as `__dir__/../../`,
  // i.e. the app root.
  const configPath = join(appDir, 'react-native-theoplayer.json');
  const config = existsSync(configPath)
    ? JSON.parse(readFileSync(configPath, 'utf8'))
    : {};
  config.ios = { ...config.ios, features: IOS_FEATURES };

  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');

  console.log(
    `✓ Wrote react-native-theoplayer.json iOS features: ${IOS_FEATURES.join(', ')}`
  );
}

async function postInstallSetup(): Promise<void> {
  console.log('Running post-install setup for react-native-theoplayer...');

  // Install scripts are executed with the build app as their working directory.
  const appDir = process.cwd();
  upsertGradleProperties(appDir);
  upsertIosConfig(appDir);
}

try {
  await postInstallSetup();
} catch (error) {
  console.error('Error during post-install setup:', error);
  throw error;
}
