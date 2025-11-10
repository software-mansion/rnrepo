import { $ } from 'bun';
import type { PostInstallScript } from './post-install-interface';

export const postInstallSetup: PostInstallScript = async (
    libraryName: string,
    libraryVersion: string,
    reactNativeVersion: string
) => {
    console.log(`Running post-install setup for ${libraryName}...`);
    const workletsVersion = getWorkletsVersion(libraryVersion);
    if (!workletsVersion) {
        console.log(`React-native-reanimated <4.*.* does not require worklets installation. Skipping worklets installation.`);
        return;
    }
    try {
        await installWorklets(workletsVersion);
    } catch (error) {
        console.error(`❌ Failed to install worklets for ${libraryName}:`, error);
        throw error;
    }
    console.log(`✓ Post-install setup for ${libraryName} completed.`);
};

function getWorkletsVersion(libraryVersion: string): string | null {
    const [major, minor, patch] = libraryVersion.split('.').map(Number);
    console.log(`Detected react-native-reanimated version: ${major}.${minor}.${patch}`);
    if (major === 4 && minor === 1) {
        return '0.5.x';
    } else if (major === 4 && minor === 0) {
        return '0.4.x';
    } else {
        return null;
    }
}

async function installWorklets(version: string) {
    console.log(`Installing worklets version: ${version}`);
    await $`npm install react-native-worklets@${version} --save-exact`.quiet();
    console.log(`✓ Installed react-native-worklets@${version}`);
}