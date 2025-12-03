import { $ } from 'bun';

export default async function postInstallSetup(): Promise<void> {
    console.log(`Running post-install setup for react-native-gesture-handler...`);
    
    // Support RN-GH only with reanimated
    await $`bun install react-native-reanimated@4.0.0 --save-exact`.quiet();
    console.log('✓ Installed react-native-reanimated@4.0.0');
    await $`bun install react-native-worklets@0.4.0 --save-exact`.quiet();
    console.log('✓ Installed react-native-worklets@0.4.0');
    // Patch react-native-gesture-handler to avoid issues with react-native-svg
    await $`bun install react-native-svg`.quiet();
    console.log('✓ Installed react-native-svg');
    const patchPath = __dirname + '/react-native-gesture-handler.patch';
    const packagePath = './node_modules/react-native-gesture-handler';
    await $`/usr/bin/patch -p1 -i ${patchPath}`.cwd(packagePath).quiet();
    console.log('✓ Patched react-native-gesture-handler for SVG compatibility');
    
    console.log(`✓ Post-install setup for react-native-gesture-handler completed.`);
};

try {
    await postInstallSetup();
} catch (error) {
    console.error('Error during post-install setup:', error);
    throw error;
}
