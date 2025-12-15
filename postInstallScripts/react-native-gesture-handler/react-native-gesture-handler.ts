import { $ } from 'bun';

export default async function postInstallSetup(): Promise<void> {
    console.log(`Running post-install setup for react-native-gesture-handler...`);
    
    const rnVersion = await getPackageVersion('react-native');
    console.log(`Detected React Native version: ${rnVersion}`);
    const reanimatedVersion = getReanimatedVersion(rnVersion);
    console.log(`Determined compatible react-native-reanimated version: ${reanimatedVersion}`);
    const workletsVersion = getWorkletsVersion(reanimatedVersion);
    console.log(`Determined compatible react-native-worklets version: ${workletsVersion}`);
    // Support RN-GH only with reanimated
    await $`bun install react-native-reanimated@${reanimatedVersion} --save-exact`.quiet();
    console.log(`✓ Installed react-native-reanimated@${reanimatedVersion}`);
    await $`bun install react-native-worklets@${workletsVersion} --save-exact`.quiet();
    console.log(`✓ Installed react-native-worklets@${workletsVersion}`);
    // Patch react-native-gesture-handler to avoid issues with react-native-svg
    await $`bun install react-native-svg`.quiet();
    console.log('✓ Installed react-native-svg');
    const patchPath = __dirname + '/react-native-gesture-handler.patch';
    const packagePath = './node_modules/react-native-gesture-handler';
    await $`/usr/bin/patch -p1 -i ${patchPath}`.cwd(packagePath).quiet();
    console.log('✓ Patched react-native-gesture-handler for SVG compatibility');
    
    console.log(`✓ Post-install setup for react-native-gesture-handler completed.`);
};

async function getPackageVersion(packageName: string): Promise<string> {
    const packageJsonPath = `node_modules/${packageName}/package.json`;
    try {
        const packageJson = JSON.parse(await Bun.file(packageJsonPath).text());
        return packageJson.version;
    } catch (error) {
        console.error(`Error retrieving version for package ${packageName}:`, error);
        throw error;
    }
}

function getReanimatedVersion(rnVersion: string): string {
    return rnVersion.startsWith('0.8') ? '4.1.4' : '4.0.0';
}

function getWorkletsVersion(reanimatedVersion: string): string {
    return reanimatedVersion === '4.1.4' ? '0.6.1' : '0.4.0';
}

try {
    await postInstallSetup();
} catch (error) {
    console.error('Error during post-install setup:', error);
    throw error;
}
