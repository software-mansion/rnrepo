import { $ } from 'bun';

export default async function preInstallSetup(): Promise<void> {
    console.log(`Running pre-install setup for react-native-mmkv...`);
    
    await $`npm install react-native-nitro-modules`.quiet();
    
    console.log(`✓ Pre-install setup for react-native-mmkv completed.`);
};

try {
    await preInstallSetup();
} catch (error) {
    console.error('Error during pre-install setup:', error);
    throw error;
}
