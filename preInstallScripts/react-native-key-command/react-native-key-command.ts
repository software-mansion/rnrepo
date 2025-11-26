import { $ } from 'bun';

export default async function preInstallSetup(): Promise<void> {
    console.log(`Running pre-install setup for react-native-key-command...`);
    
    // Install explicitly react-dom@19.1.0 to avoid version mismatch issues
    console.log(`Installing react-dom@19.1.0...`);
    await $`npm install react-dom@19.1.0 --save-exact`.quiet();
    
    console.log(`✓ Pre-install setup for react-native-key-command completed.`);
};

try {
    await preInstallSetup();
} catch (error) {
    console.error('Error during pre-install setup:', error);
    throw error;
}
