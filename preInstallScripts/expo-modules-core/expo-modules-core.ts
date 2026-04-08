import { $ } from 'bun';

export default async function preInstallSetup(): Promise<void> {
    console.log(`Running pre-install setup for expo-modules-core...`);
    
    console.log(`Running npm install during pre-install to ensure react-native and related packages are installed...`);
    await $`npm install`.quiet();
    
    console.log(`Installing expo-modules with 'install-expo-modules@latest' command...`);
    await $`rm -rf ios`.quiet(); // skip pod install from install-expo-modules
    try {
        await $`npx install-expo-modules@latest --non-interactive`.quiet();
    } catch (error) {
        let isExpectedFailure = false;

        if (error instanceof $.ShellError) {
            const output = (error.stderr.toString() + error.stdout.toString()).toLowerCase();
            isExpectedFailure = output.includes('command `pod install` failed');
        }

        if (isExpectedFailure) {
            console.warn('⚠️  iOS Pod install failed as expected, continuing...');
        } else {
            console.error('❌ Error during expo-modules installation:', error);
            throw error;
        }
    }
    
    console.log(`✓ Pre-install setup for expo-modules-core completed.`);
};

try {
    await preInstallSetup();
} catch (error) {
    console.error('Error during pre-install setup:', error);
    throw error;
}
