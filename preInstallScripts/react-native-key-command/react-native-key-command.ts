import { $ } from 'bun';

export default async function postInstallSetup(): Promise<void> {
    console.log(`Running post-install setup for react-native-key-command...`);
    
    // Install explicitly react-dom@19.1.0 to avoid version mismatch issues
    console.log(`Installing react-dom@19.1.0...`);
    await $`npm install react-dom@19.1.0 --save-exact`.quiet();
    
    console.log(`✓ Post-install setup for react-native-key-command completed.`);
};

try {
    await postInstallSetup();
} catch (error) {
    console.error('Error during post-install setup:', error);
    throw error;
}
