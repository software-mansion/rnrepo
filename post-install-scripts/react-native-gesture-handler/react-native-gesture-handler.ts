import { $ } from 'bun';

export default async function postInstallSetup(): Promise<void> {
    console.log(`Running post-install setup for react-native-gesture-handler...`);
    
    // Support RN-GH only with reanimated
    await $`bun install react-native-reanimated@4.0.0 --save-exact`.quiet();
    console.log('✓ Installed react-native-reanimated@4.0.0');
    await $`bun install react-native-worklets@0.4.0 --save-exact`.quiet();
    console.log('✓ Installed react-native-worklets@0.4.0');
    
    console.log(`✓ Post-install setup for react-native-gesture-handler completed.`);
};

try {
    await postInstallSetup();
} catch (error) {
    console.error('Error during post-install setup:', error);
    throw error;
}
