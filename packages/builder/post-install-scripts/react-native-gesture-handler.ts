import { $ } from 'bun';
import type { PostInstallScript } from './post-install-interface';

export const postInstallSetup: PostInstallScript = async (
    libraryName: string,
    libraryVersion: string,
    reactNativeVersion: string,
    additionalLibraries: string[]
) => {
    console.log(`Running post-install setup for ${libraryName}...`);
    
    if (additionalLibraries.some(lib => lib.includes('react-native-reanimated'))) {
        // Install react-native-reanimated version 4.0.0, so installing react-native-worklets 0.4.0
        // but version does not matter here for RN-GH
        await $`bun install react-native-worklets@0.4.0`;
        console.log('✓ Installed react-native-worklets@0.4.0');
    }
    
    console.log(`✓ Post-install setup for ${libraryName} completed.`);
};
