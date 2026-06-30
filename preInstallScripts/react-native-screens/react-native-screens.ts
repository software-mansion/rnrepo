import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Enable the react-native-screens "Gamma" project for the native build.
 *
 *  - Android: android/build.gradle's isGammaEnabled() reads the Gradle property
 *    `rnsGammaEnabled` -> write it into android/gradle.properties.
 *  - iOS: RNScreens.podspec reads ENV['RNS_GAMMA_ENABLED'] during pod install
 *    -> set it from the top of ios/Podfile, which the same Ruby process
 *    evaluates before any podspec.
 */
export default async function preInstallSetup(): Promise<void> {
    console.log(`Running pre-install setup for react-native-screens...`);

    const appDir = process.cwd();

    enableGammaForAndroid(join(appDir, 'android', 'gradle.properties'));
    enableGammaForIOS(join(appDir, 'ios', 'Podfile'));

    console.log(`✓ Pre-install setup for react-native-screens completed.`);
};

function enableGammaForAndroid(gradlePropertiesPath: string): void {
    if (!existsSync(gradlePropertiesPath)) {
        throw new Error(`No ${gradlePropertiesPath}, skipping Android gamma setup.`);
    }

    const contents = readFileSync(gradlePropertiesPath, 'utf-8');
    writeFileSync(
        gradlePropertiesPath,
        `${contents}\nrnsGammaEnabled=true\n`
    );
    console.log(`✓ Enabled rnsGammaEnabled=true in android/gradle.properties.`);
}

function enableGammaForIOS(podfilePath: string): void {
    if (!existsSync(podfilePath)) {
        throw new Error(`No ${podfilePath}, iOS gamma setup failed.`);
    }

    const contents = readFileSync(podfilePath, 'utf-8');
    writeFileSync(
        podfilePath,
        `ENV['RNS_GAMMA_ENABLED'] = '1'\n${contents}`
    );
    console.log(`✓ Set ENV['RNS_GAMMA_ENABLED']='1' at the top of ios/Podfile.`);
}

try {
    await preInstallSetup();
} catch (error) {
    console.error('Error during pre-install setup:', error);
    throw error;
}
