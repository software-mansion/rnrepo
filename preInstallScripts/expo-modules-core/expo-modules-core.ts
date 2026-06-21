import { $ } from 'bun';

export default async function preInstallSetup(): Promise<void> {
    console.log(`Running pre-install setup for expo-modules-core...`);
    
    console.log(`Running npm install during pre-install to ensure react-native and related packages are installed...`);
    await $`npm install`.quiet();
    
    console.log(`Installing expo-modules with 'install-expo-modules@latest' command...`);
    await $`npx install-expo-modules@latest --non-interactive`.quiet();
    
    console.log(`✓ Pre-install setup for expo-modules-core completed.`);
};

try {
    await preInstallSetup();
} catch (error) {
    console.error('Error during pre-install setup:', error);
    throw error;
}
