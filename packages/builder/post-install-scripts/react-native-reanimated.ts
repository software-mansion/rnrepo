import { $ } from 'bun';
import type { PostInstallScript } from './post-install-interface';

export const postInstallSetup: PostInstallScript = async (
    libraryName: string,
    libraryVersion: string,
    reactNativeVersion: string,
    workletsVersion?: string
) => {
    console.log(`Running post-install setup for ${libraryName}...`);
    
    if (workletsVersion == undefined) {
        throw new Error('workletsVersion is required for react-native-reanimated post-install setup');
    }
    await $`bun install react-native-worklets@${workletsVersion} --save-exact`.quiet();
    console.log(`✓ Installed react-native-worklets@${workletsVersion}`);
    
    console.log(`✓ Post-install setup for ${libraryName} completed.`);
};
